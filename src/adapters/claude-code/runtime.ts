/**
 * Claude Code Runtime 适配器
 *
 * 通过 Claude Code 的 Agent tool (子代理) 启动 Agent，
 * 通过 Hooks 系统 (settings.json / hooks.json) 接收事件并更新状态，
 * 通过 Pipeline Server REST API 管理状态。
 *
 * Claude Code 特有能力：
 * - Agent tool：替代 Cursor 的 Task tool，支持自定义子代理
 * - .claude/agents/*.md：Markdown + YAML frontmatter 格式定义子代理
 * - hooks.json：SessionStart / PreToolUse / PostToolUse / Stop 事件
 * - permissionMode：可为每个子代理独立配置权限模式
 * - isolation: worktree：子代理可在独立 git worktree 中执行
 * - skills 注入：子代理启动时预加载 Skill 内容
 * - memory：跨会话持久记忆
 * - Agent Teams：多 Agent 独立会话协作（实验性功能）
 *
 * 与 Cursor 适配器的核心差异：
 * - 子代理定义格式不同（.md + frontmatter vs 纯 .md）
 * - Hook 事件类型不同（PreToolUse/PostToolUse vs subagentStart/Stop）
 * - 子代理不能嵌套生成子代理（Cursor SubAgent 亦同）
 * - 支持 worktree 隔离模式
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  PipelineRuntime,
  SpawnAgentOpts,
  AgentResult,
  GateContext,
  GateDecision,
  StatusReport,
  AgentMeta,
} from "../../../spec/runtime-interface.ts";
import { getAdapterPaths } from "../paths.ts";

const SERVER_BASE = "http://127.0.0.1:19090";
const PATHS = getAdapterPaths("claude-code");

export interface ClaudeCodeRuntimeConfig {
  projectRoot?: string;
  serverUrl?: string;
  /** .claude/agents 目录路径 */
  agentsDir?: string;
  /** 用户级 agents 目录 ~/.claude/agents */
  userAgentsDir?: string;
}

export class ClaudeCodeRuntime implements PipelineRuntime {
  readonly name = "claude-code";
  private config: Required<ClaudeCodeRuntimeConfig>;

  constructor(config: ClaudeCodeRuntimeConfig = {}) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    this.config = {
      projectRoot: config.projectRoot ?? process.cwd(),
      serverUrl: config.serverUrl ?? SERVER_BASE,
      agentsDir: config.agentsDir ?? PATHS.agentsDir,
      userAgentsDir: config.userAgentsDir ?? join(home, ".claude", "agents"),
    };
  }

  /**
   * 启动 Agent
   *
   * Claude Code 中通过 Agent tool 调用子代理。
   * Orchestrator 会读取 pipeline 定义后自行发出 Agent tool 调用。
   * 子代理定义文件需预先放置在 .claude/agents/ 目录下。
   */
  async spawnAgent(opts: SpawnAgentOpts): Promise<AgentResult> {
    await this.reportStatus({
      pipelineId: opts.pipelineId,
      stage: opts.agent,
      status: "active",
      timestamp: new Date().toISOString(),
      detail: `Spawning agent via Agent tool: ${opts.agent}`,
    });

    return {
      status: "completed",
      output: {
        _claude_code_agent: opts.agent,
        _claude_code_task: opts.task,
      },
      summary: `Task delegated to subagent: ${opts.agent}`,
      duration_ms: 0,
    };
  }

  /**
   * 生成 Agent tool 调用指令
   *
   * Claude Code 使用 Agent(agent_type) tool 而非 Cursor 的 Task tool
   */
  generateTaskInstruction(opts: SpawnAgentOpts): string {
    const lines = [
      `使用 Agent tool 启动子代理：`,
      `- agent_type: "${opts.agent}"`,
      `- prompt: "[pipeline:${opts.pipelineId}] ${opts.task}"`,
    ];
    if (opts.scope) {
      lines.push(`- 限制范围: ${opts.scope}`);
    }
    if (opts.input && Object.keys(opts.input).length > 0) {
      lines.push(`- 上下文数据: ${JSON.stringify(opts.input)}`);
    }
    return lines.join("\n");
  }

  async presentGate(context: GateContext): Promise<GateDecision> {
    return { action: "approve" };
  }

  generateGateInstruction(context: GateContext, pipelineId: string): string {
    return [
      `## 质量门: ${context.description}`,
      "",
      context.previousSummary ? `上一阶段摘要: ${context.previousSummary}` : "",
      "",
      `**请暂停并等待用户确认后再继续。**`,
      "",
      `用户确认后执行:`,
      "```bash",
      `curl -s http://127.0.0.1:19090/api/v1/pipeline/gate -X POST \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"gate":"${context.stageName}","result":"passed","pipeline":"${pipelineId}"}'`,
      "```",
    ].filter(Boolean).join("\n");
  }

  async reportStatus(report: StatusReport): Promise<void> {
    try {
      await fetch(`${this.config.serverUrl}/api/v1/pipeline/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: report.stage,
          status: report.status,
          pipeline: report.pipelineId,
        }),
      });
    } catch {}
  }

  /**
   * 发现可用 Agent
   *
   * Claude Code 的 Agent 定义文件为 Markdown + YAML frontmatter 格式，
   * 搜索路径优先级：.claude/agents/ > ~/.claude/agents/
   */
  async listAvailableAgents(): Promise<AgentMeta[]> {
    const agents: AgentMeta[] = [];
    const seen = new Set<string>();

    for (const dir of [
      join(this.config.projectRoot, this.config.agentsDir),
      this.config.userAgentsDir,
    ]) {
      try {
        const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
        for (const f of files) {
          const parsed = parseAgentFrontmatter(readFileSync(join(dir, f), "utf-8"));
          const name = parsed.name ?? f.replace(/\.md$/, "");
          if (seen.has(name)) continue;
          seen.add(name);
          agents.push({
            name,
            description: parsed.description,
            definitionPath: join(dir, f),
          });
        }
      } catch {}
    }
    return agents;
  }

  supportsParallel(): boolean {
    return true;
  }
}

// ─── YAML frontmatter 解析 ───

interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string;
  model?: string;
  permissionMode?: string;
  isolation?: string;
  skills?: string[];
  [key: string]: unknown;
}

function parseAgentFrontmatter(content: string): AgentFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: AgentFrontmatter = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      result[kv[1]] = kv[2].trim();
    }
  }
  return result;
}

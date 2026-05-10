/**
 * Codex Runtime 适配器
 *
 * 通过 Codex 的内置 SubAgent 系统启动 Agent，
 * 通过 Hooks 系统 (hooks.json) 接收事件并更新状态，
 * 通过 Pipeline Server REST API 管理状态。
 *
 * Codex 特有能力：
 * - 内置 SubAgent 系统：default / worker / explorer + 自定义 Agent
 * - .codex/agents/*.toml：TOML 格式定义自定义 Agent
 * - hooks.json：SessionStart / PreToolUse / PostToolUse / Stop 等事件
 * - spawn_agents_on_csv：CSV 批量派发 Agent（适合并行审查场景）
 * - sandbox_mode：per-agent 沙箱隔离（read-only / workspace-write）
 * - codex exec：非交互式命令行执行（适合 CI/CD）
 * - MCP Server 模式：codex 自身可作为 MCP Server 暴露 codex() 工具
 *
 * 与其他适配器的核心差异：
 * | 特性           | Cursor          | Claude Code       | Codex                      |
 * |----------------|-----------------|-------------------|----------------------------|
 * | Agent 定义格式 | .md             | .md + frontmatter | .toml                      |
 * | Agent 定义目录 | agents/         | .claude/agents/   | .codex/agents/             |
 * | Agent 启动方式 | Task tool       | Agent tool        | 内置 SubAgent / codex exec |
 * | Hook 配置      | hooks.json      | hooks.json        | hooks.json + config.toml   |
 * | 并行机制       | 多 Task tool    | 多 Agent tool     | 原生并行 + CSV fan-out     |
 * | 沙箱隔离       | 无              | worktree          | sandbox_mode per-agent     |
 * | CI/CD 友好度   | 低（依赖IDE）   | 中（CLI 可用）     | 高（codex exec）           |
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
const PATHS = getAdapterPaths("codex");

export interface CodexRuntimeConfig {
  projectRoot?: string;
  serverUrl?: string;
  /** .codex/agents 目录路径 */
  agentsDir?: string;
  /** 用户级 agents 目录 ~/.codex/agents */
  userAgentsDir?: string;
  /** 是否在非交互式模式（codex exec）下运行 */
  nonInteractive?: boolean;
}

export class CodexRuntime implements PipelineRuntime {
  readonly name = "codex";
  private config: Required<CodexRuntimeConfig>;

  constructor(config: CodexRuntimeConfig = {}) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "~";
    this.config = {
      projectRoot: config.projectRoot ?? process.cwd(),
      serverUrl: config.serverUrl ?? SERVER_BASE,
      agentsDir: config.agentsDir ?? PATHS.agentsDir,
      userAgentsDir: config.userAgentsDir ?? join(home, ".codex", "agents"),
      nonInteractive: config.nonInteractive ?? false,
    };
  }

  /**
   * 启动 Agent
   *
   * Codex 中可以通过以下方式启动 SubAgent：
   * 1. 交互式：在对话中请求 Codex 生成子代理（"Spawn an agent..."）
   * 2. 自定义 Agent：匹配 .codex/agents/*.toml 中的定义
   * 3. codex exec：非交互式批量执行
   *
   * Orchestrator 通过 Prompt 指令让 Codex 触发 SubAgent。
   */
  async spawnAgent(opts: SpawnAgentOpts): Promise<AgentResult> {
    await this.reportStatus({
      pipelineId: opts.pipelineId,
      stage: opts.agent,
      status: "active",
      timestamp: new Date().toISOString(),
      detail: `Spawning agent: ${opts.agent}`,
    });

    return {
      status: "completed",
      output: {
        _codex_agent: opts.agent,
        _codex_task: opts.task,
        _codex_mode: this.config.nonInteractive ? "exec" : "interactive",
      },
      summary: `Task delegated to Codex subagent: ${opts.agent}`,
      duration_ms: 0,
    };
  }

  /**
   * 生成 Codex SubAgent 调用指令
   *
   * Codex 的 SubAgent 通过自然语言指令触发。
   * 格式：Spawn {agent_name} agent to {task}
   */
  generateTaskInstruction(opts: SpawnAgentOpts): string {
    const lines: string[] = [];

    if (this.config.nonInteractive) {
      lines.push(`执行 codex exec 子任务：`);
      lines.push(`\`\`\`bash`);
      lines.push(`codex exec "[pipeline:${opts.pipelineId}] ${opts.task}"`);
      lines.push(`\`\`\``);
    } else {
      lines.push(`请 spawn ${opts.agent} agent 执行以下任务：`);
      lines.push(`"[pipeline:${opts.pipelineId}] ${opts.task}"`);
    }

    if (opts.scope) {
      lines.push(`限制范围: ${opts.scope}`);
    }
    if (opts.input && Object.keys(opts.input).length > 0) {
      lines.push(`上下文数据: ${JSON.stringify(opts.input)}`);
    }
    return lines.join("\n");
  }

  /**
   * 生成批量并行调用指令（CSV fan-out）
   *
   * Codex 独有能力：spawn_agents_on_csv 可将 CSV 每行映射为一个 Agent
   */
  generateCsvFanoutInstruction(
    pipelineId: string,
    csvPath: string,
    instruction: string,
    outputPath?: string,
  ): string {
    return [
      `使用 spawn_agents_on_csv 批量执行：`,
      `- csv_path: "${csvPath}"`,
      `- instruction: "[pipeline:${pipelineId}] ${instruction}"`,
      outputPath ? `- output_csv_path: "${outputPath}"` : "",
    ].filter(Boolean).join("\n");
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
   * Codex Agent 定义为 TOML 格式，搜索路径：
   * .codex/agents/ > ~/.codex/agents/
   * 同名时 project-level 优先
   */
  async listAvailableAgents(): Promise<AgentMeta[]> {
    const agents: AgentMeta[] = [];
    const seen = new Set<string>();

    // 内置 Agent
    for (const builtin of [
      { name: "default", description: "General-purpose fallback agent" },
      { name: "worker", description: "Execution-focused agent for implementation and fixes" },
      { name: "explorer", description: "Read-heavy codebase exploration agent" },
    ]) {
      agents.push(builtin);
      seen.add(builtin.name);
    }

    // 自定义 Agent（TOML 文件）
    for (const dir of [
      join(this.config.projectRoot, this.config.agentsDir),
      this.config.userAgentsDir,
    ]) {
      try {
        const files = readdirSync(dir).filter((f) => f.endsWith(".toml"));
        for (const f of files) {
          const content = readFileSync(join(dir, f), "utf-8");
          const parsed = parseTomlAgentConfig(content);
          const name = parsed.name ?? f.replace(/\.toml$/, "");
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

// ─── 简易 TOML 解析（仅提取顶层 key = "value" 对） ───

interface TomlAgentConfig {
  name?: string;
  description?: string;
  model?: string;
  sandbox_mode?: string;
  developer_instructions?: string;
  [key: string]: unknown;
}

function parseTomlAgentConfig(content: string): TomlAgentConfig {
  const result: TomlAgentConfig = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed.startsWith("[")) continue;

    const match = trimmed.match(/^(\w+)\s*=\s*"([^"]*)"/);
    if (match) {
      result[match[1]] = match[2];
      continue;
    }

    // 多行字符串开始（简化处理，仅提取第一行）
    const multiMatch = trimmed.match(/^(\w+)\s*=\s*"""/);
    if (multiMatch) {
      const endIdx = content.indexOf('"""', content.indexOf(trimmed) + trimmed.length);
      if (endIdx > 0) {
        const start = content.indexOf(trimmed) + trimmed.length;
        result[multiMatch[1]] = content.slice(start, endIdx).trim();
      }
    }
  }

  return result;
}

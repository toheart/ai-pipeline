/**
 * Cursor Runtime 适配器
 *
 * 通过 Cursor 的 Task tool (SubAgent) 启动 Agent，
 * 通过 Hook 系统接收事件并更新状态，
 * 通过 Pipeline Server REST API 管理状态。
 *
 * Cursor 特有能力：
 * - Task tool：在同一消息中并行启动多个 SubAgent
 * - hooks.json：sessionStart / subagentStart / subagentStop 事件
 * - SubAgent context isolation：每个 SubAgent 独立上下文
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
const PATHS = getAdapterPaths("cursor");

export interface CursorRuntimeConfig {
  /** 项目根目录 */
  projectRoot?: string;
  /** Pipeline Server 地址 */
  serverUrl?: string;
  /** Agent 定义文件目录（.md 文件） */
  agentsDir?: string;
}

export class CursorRuntime implements PipelineRuntime {
  readonly name = "cursor";
  private config: Required<CursorRuntimeConfig>;

  constructor(config: CursorRuntimeConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot ?? process.cwd(),
      serverUrl: config.serverUrl ?? SERVER_BASE,
      agentsDir: config.agentsDir ?? PATHS.agentsDir,
    };
  }

  /**
   * 启动 Agent
   *
   * Cursor 中通过 Task tool 调用 SubAgent。
   * 实际上这个函数不会直接执行 —— AI Agent 读取 Orchestrator Skill 后
   * 自行发出 Task tool 调用。这里生成 Task tool 的指令文本。
   */
  async spawnAgent(opts: SpawnAgentOpts): Promise<AgentResult> {
    const taskDescription = [
      `[pipeline:${opts.pipelineId}]`,
      `Agent: ${opts.agent}`,
      opts.task,
      opts.scope ? `Scope: ${opts.scope}` : "",
    ].filter(Boolean).join(" | ");

    await this.reportStatus({
      pipelineId: opts.pipelineId,
      stage: opts.agent,
      status: "active",
      timestamp: new Date().toISOString(),
      detail: `Spawning agent via Task tool: ${opts.agent}`,
    });

    /**
     * Cursor 中 Agent 通过 Task tool 异步执行，
     * 结果通过 Hook (subagentStop) 回传。
     * 这里返回一个占位结果，实际状态由 Hook 驱动更新。
     */
    return {
      status: "completed",
      output: { _cursor_task_description: taskDescription },
      summary: `Task delegated to SubAgent: ${opts.agent}`,
      duration_ms: 0,
    };
  }

  /**
   * 生成 Task tool 调用指令
   *
   * Orchestrator Skill 中嵌入此指令，AI 读取后自行发出 Task tool
   */
  generateTaskInstruction(opts: SpawnAgentOpts): string {
    const agentMd = this.resolveAgentDefinition(opts.agent);
    const lines = [
      `使用 Task tool 启动 SubAgent：`,
      `- description: "[pipeline:${opts.pipelineId}] ${opts.agent}: ${opts.task}"`,
      `- prompt: "你是 ${opts.agent}。请阅读 ${agentMd ?? `agents/${opts.agent}.md`} 获取完整指令。"`,
    ];
    if (opts.scope) {
      lines.push(`- 限制范围: ${opts.scope}`);
    }
    return lines.join("\n");
  }

  /**
   * Gate 通过 Pipeline Server API 实现
   *
   * Orchestrator 发送 curl 到 Server，然后在 Skill 指令中
   * 要求 AI 暂停并等待用户回复。
   */
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
      `\`\`\`bash`,
      `curl -s http://127.0.0.1:19090/api/v1/pipeline/gate -X POST \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"gate":"${context.stageName}","result":"passed","pipeline":"${pipelineId}"}'`,
      `\`\`\``,
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
    } catch {
      // Server 可能未启动，静默忽略
    }
  }

  async listAvailableAgents(): Promise<AgentMeta[]> {
    const agents: AgentMeta[] = [];
    const dir = join(this.config.projectRoot, this.config.agentsDir);
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const f of files) {
        const name = f.replace(/\.md$/, "");
        const content = readFileSync(join(dir, f), "utf-8");
        const descMatch = content.match(/description:\s*(.+)/i);
        agents.push({
          name,
          description: descMatch?.[1]?.trim(),
          definitionPath: join(dir, f),
        });
      }
    } catch {}
    return agents;
  }

  supportsParallel(): boolean {
    return true;
  }

  private resolveAgentDefinition(agentName: string): string | null {
    const candidates = [
      join(this.config.agentsDir, `${agentName}.md`),
      join(".cursor", "agents", `${agentName}.md`),
    ];
    for (const p of candidates) {
      if (existsSync(join(this.config.projectRoot, p))) return p;
    }
    return null;
  }
}

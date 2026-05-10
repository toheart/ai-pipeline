/**
 * Claude Code Agent 解析器
 *
 * 从 Hook 事件中识别 Agent 和 Stage。
 *
 * Claude Code Hook 事件结构与 Cursor 不同：
 * - 没有 subagentStart/subagentStop，使用 PreToolUse / PostToolUse / Stop
 * - tool_name 当前仅支持 "Bash"
 * - Agent 启动信息通过 SessionStart 的 additionalContext 注入
 *
 * 识别策略：
 * 1. 从 curl 命令中匹配 pipeline API 调用（如 /api/v1/pipeline/stage）
 * 2. 从 Bash command 中匹配 [pipeline:ID] 标记
 * 3. 从 prompt 文本中匹配 Agent 名称
 */

import type { TemplateConfig } from "../../engine/types.ts";

export interface ClaudeCodeHookEvent {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  model?: string;
  /** SessionStart 事件 */
  source?: string;
  /** PreToolUse / PostToolUse 事件 */
  turn_id?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: {
    command?: string;
    description?: string;
  };
  tool_response?: unknown;
  /** UserPromptSubmit 事件 */
  prompt?: string;
  /** Stop 事件 */
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  transcript_path?: string | null;
  [key: string]: unknown;
}

export function extractAgentFromCommand(
  command: string,
  template?: TemplateConfig,
): string | null {
  if (template) {
    for (const name of template.agentRefs) {
      if (command.includes(name)) return name;
    }
  }

  const stageMatch = command.match(/"stage"\s*:\s*"([^"]+)"/);
  if (stageMatch) return stageMatch[1];

  const agentMatch = command.match(/\[pipeline:[^\]]+\]\s*(?:Agent:\s*)?(\S+)/);
  if (agentMatch) return agentMatch[1];

  return null;
}

export function extractPipelineId(event: ClaudeCodeHookEvent): string | null {
  const sources = [
    event.tool_input?.command ?? "",
    event.prompt ?? "",
    event.last_assistant_message ?? "",
  ].join(" ");

  const match = sources.match(/\[pipeline:([^\]]+)\]/);
  if (match) return match[1];

  const apiMatch = sources.match(/"pipeline"\s*:\s*"([^"]+)"/);
  if (apiMatch) return apiMatch[1];

  return null;
}

export function extractStageFromCurl(command: string): {
  stage?: string;
  status?: string;
  gate?: string;
  result?: string;
} {
  const info: { stage?: string; status?: string; gate?: string; result?: string } = {};

  if (command.includes("/api/v1/pipeline/stage")) {
    const stageMatch = command.match(/"stage"\s*:\s*"([^"]+)"/);
    const statusMatch = command.match(/"status"\s*:\s*"([^"]+)"/);
    if (stageMatch) info.stage = stageMatch[1];
    if (statusMatch) info.status = statusMatch[1];
  }

  if (command.includes("/api/v1/pipeline/gate")) {
    const gateMatch = command.match(/"gate"\s*:\s*"([^"]+)"/);
    const resultMatch = command.match(/"result"\s*:\s*"([^"]+)"/);
    if (gateMatch) info.gate = gateMatch[1];
    if (resultMatch) info.result = resultMatch[1];
  }

  return info;
}

export function inferStageFromPrompt(
  prompt: string,
  template?: TemplateConfig,
): string {
  const text = prompt.toLowerCase();

  if (template) {
    for (const s of template.stages) {
      if (s.agent && text.includes(s.agent)) return s.name;
      if (Array.isArray(s.parallel)) {
        for (const p of s.parallel) {
          if (p.agent && text.includes(p.agent)) return s.name;
        }
      }
    }
  }

  if (/\bexplor/i.test(text)) return "explore";
  if (/\bimplement/i.test(text)) return "implement";
  if (/\breview/i.test(text)) return "code-review";
  if (/\bqa[\s-]?test|e2e|playwright/i.test(text)) return "qa-test";

  return "";
}

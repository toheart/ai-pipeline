/**
 * Codex Agent 解析器
 *
 * 从 Hook 事件中识别 Agent 和 Stage。
 *
 * Codex Hook 事件结构：
 * - SessionStart：source=startup|resume
 * - PreToolUse：tool_name=Bash, tool_input.command
 * - PostToolUse：tool_name=Bash, tool_input.command, tool_response
 * - UserPromptSubmit：prompt
 * - PermissionRequest：tool_name=Bash, tool_input.command
 * - Stop：last_assistant_message
 *
 * 与 Claude Code Hook 的差异：
 * - Codex Hook 事件通过 stdin JSON 传入
 * - Codex 支持 PermissionRequest 事件（Claude Code 也支持）
 * - Codex 当前仅拦截 Bash tool（PreToolUse/PostToolUse）
 * - exit code 2 + stderr 可阻止操作（与 Claude Code 相同）
 */

import type { TemplateConfig } from "../../engine/types.ts";

export interface CodexHookEvent {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  model?: string;
  transcript_path?: string | null;
  /** SessionStart */
  source?: string;
  /** PreToolUse / PostToolUse / PermissionRequest */
  turn_id?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: {
    command?: string;
    description?: string;
  };
  tool_response?: unknown;
  /** UserPromptSubmit */
  prompt?: string;
  /** Stop */
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  [key: string]: unknown;
}

export function extractPipelineId(event: CodexHookEvent): string | null {
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

export function extractAgentFromPrompt(
  prompt: string,
  template?: TemplateConfig,
): string | null {
  const text = prompt.toLowerCase();

  if (template) {
    for (const name of template.agentRefs) {
      if (text.includes(name)) return name;
    }
  }

  const spawnMatch = prompt.match(/spawn\s+(\S+)\s+agent/i);
  if (spawnMatch) return spawnMatch[1];

  return null;
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

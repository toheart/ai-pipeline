/**
 * Cursor Agent 解析器 —— 从 Hook 事件中识别 Agent 和 Stage
 *
 * 这是 Cursor 专属逻辑：通过 task/description 文本匹配推断
 * Agent 类型和所属 Stage。其他 IDE 适配器不需要这个。
 */

import type { TemplateConfig } from "../../engine/types.ts";

export interface HookEvent {
  hook_event_name?: string;
  conversation_id?: string;
  subagent_id?: string;
  subagent_type?: string;
  task?: string;
  status?: string;
  duration_ms?: number;
  summary?: string;
  command?: string;
  description?: string;
  [key: string]: unknown;
}

export function extractAgentLabel(
  event: HookEvent,
  template?: TemplateConfig,
): string {
  const text = [event.task ?? "", event.description ?? ""].join(" ").toLowerCase();

  if (template) {
    for (const name of template.agentRefs) {
      if (text.includes(name)) return name;
    }
  }

  if (/backend.?implement|后端.?实现/i.test(text)) return "backend-implementer";
  if (/frontend.?implement|前端.?实现/i.test(text)) return "frontend-implementer";
  if (/backend.?review|后端.?审查/i.test(text)) return "backend-reviewer";
  if (/frontend.?review|前端.?审查/i.test(text)) return "frontend-reviewer";
  if (/code.?review|代码.?审查/i.test(text)) return "code-reviewer";
  if (/qa.?test|e2e|playwright|功能.?验收/i.test(text)) return "qa-tester";
  if (/integration.?test|集成.?测试/i.test(text)) return "test-writer";
  if (/review|审查/i.test(text)) return "reviewer";
  if (/implement|实现/i.test(text)) return "implementer";

  return event.subagent_type || "unknown";
}

export function inferStage(
  event: HookEvent,
  template?: TemplateConfig,
): string {
  const searchText = [
    event.task ?? "",
    event.description ?? "",
    event.subagent_type ?? "",
  ].join(" ").toLowerCase();

  if (template) {
    for (const s of template.stages) {
      if (s.agent && searchText.includes(s.agent)) return s.name;
      if (Array.isArray(s.parallel)) {
        for (const p of s.parallel) {
          if (p.agent && searchText.includes(p.agent)) return s.name;
        }
      }
    }
  }

  if (/\bexplor/i.test(searchText)) return "explore";
  if (/\b(backend.?implement|frontend.?implement|implement)/i.test(searchText)) return "implement";
  if (/\b(code.?review|backend.?review|frontend.?review)/i.test(searchText)) return "code-review";
  if (/\b(qa.?test|e2e.?test|playwright)/i.test(searchText)) return "qa-test";
  if (/\b(integration.?test|集成.?测试)/i.test(searchText)) return "integration-test";

  return "";
}

/**
 * 从 Hook 事件中提取 pipeline ID
 * 优先匹配 [pipeline:ID] 标记
 */
export function extractPipelineId(event: HookEvent): string | null {
  const text = [event.task ?? "", event.description ?? ""].join(" ");
  const match = text.match(/\[pipeline:([^\]]+)\]/);
  return match ? match[1] : null;
}

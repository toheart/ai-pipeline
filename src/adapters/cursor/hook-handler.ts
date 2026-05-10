/**
 * Cursor Hook 事件处理器
 *
 * 将 Cursor 的 Hook 事件（subagentStart/Stop、sessionStart 等）
 * 翻译为 Engine 层的状态机操作。
 */

import {
  advanceStage,
  addActiveAgent,
  completeAgent,
} from "../../engine/state-machine.ts";
import type { PipelineState, PipelineInstance, TemplateConfig } from "../../engine/types.ts";
import { extractAgentLabel, inferStage, extractPipelineId, type HookEvent } from "./agent-resolver.ts";

export interface HookResponse {
  additional_context?: string;
  env?: Record<string, string>;
  continue?: boolean;
  permission?: string;
  user_message?: string;
  agent_message?: string;
}

export function handleSessionStart(
  event: HookEvent,
  activePipelines: PipelineInstance[],
): HookResponse {
  const ctx: string[] = [];
  const active = activePipelines.filter(
    (p) => p.state.current_stage && p.state.change_name,
  );
  if (active.length > 0) {
    ctx.push(
      `[活跃流水线] ${active.map((p) => `${p.id}(${p.state.change_name}@${p.state.current_stage})`).join(", ")}`,
    );
  }
  return {
    additional_context: ctx.join(" "),
    env: {
      PIPELINE_SERVER: "http://127.0.0.1:19090",
      PIPELINE_COUNT: String(activePipelines.length),
    },
  };
}

export function handleSubagentStart(
  event: HookEvent,
  instance: PipelineInstance,
): PipelineState {
  const now = new Date().toISOString();
  const agentLabel = extractAgentLabel(event, instance.template);
  const stage = inferStage(event, instance.template);

  let state = instance.state;
  state = addActiveAgent(
    state,
    event.subagent_id ?? "",
    agentLabel,
    (event.task ?? "").slice(0, 100),
    now,
  );

  if (stage) {
    const existing = state.stages.find((s) => s.name === stage);
    if (existing && existing.status === "pending") {
      state = advanceStage(state, stage, "active", now);
    }
  }

  return state;
}

export function handleSubagentStop(
  event: HookEvent,
  instance: PipelineInstance,
): PipelineState {
  const now = new Date().toISOString();
  const agentLabel = extractAgentLabel(event, instance.template);
  const agentStatus = event.status === "completed" ? "completed" : "error";

  let state = completeAgent(
    instance.state,
    event.subagent_id ?? "",
    agentLabel,
    agentStatus as any,
    event.duration_ms ?? 0,
    now,
    event.summary,
  );

  const stage = inferStage(event, instance.template);
  if (stage) {
    const stillActive = state.active_agents.some(
      (a) => inferStage({ task: a.task, subagent_type: a.type }, instance.template) === stage,
    );
    if (!stillActive) {
      const existing = state.stages.find((s) => s.name === stage);
      if (existing && existing.status === "active") {
        state = advanceStage(
          state,
          stage,
          agentStatus === "error" ? "failed" : "completed",
          now,
        );
      }
    }
  }

  return state;
}

export function handleBeforeShellExecution(event: HookEvent): HookResponse {
  const cmd = event.command ?? "";
  if (/git\s+push\s+.*(-f|--force)/.test(cmd)) {
    return {
      continue: true,
      permission: "deny",
      user_message: "Force push 已被拦截。如确需执行，请手动在终端操作。",
      agent_message: "Force push 被安全策略拦截。请告知用户需要手动执行。",
    };
  }
  if (/git\s+reset\s+--hard/.test(cmd)) {
    return {
      continue: true,
      permission: "ask",
      user_message: "git reset --hard 会丢失未提交的变更，是否继续？",
    };
  }
  if (/kubectl\s+apply.*prod|docker\s+push/.test(cmd)) {
    return {
      continue: true,
      permission: "ask",
      user_message: "检测到生产环境操作，请确认是否继续。",
    };
  }
  return { continue: true, permission: "allow" };
}

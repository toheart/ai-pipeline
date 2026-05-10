/**
 * Pipeline 状态机 —— 纯函数，零 IO
 *
 * 所有函数接收当前 state，返回新 state（不可变更新）。
 * 不读写文件、不调用网络、不依赖任何 IDE 能力。
 * 这是整个 AI Pipeline 语言的"解释器核心"。
 */

import type { PipelineState, Stage, GateRecord, StageDef, TemplateConfig } from "./types.ts";

// ─── 状态初始化 ───

export function createInitialState(
  pipelineId: string,
  template: TemplateConfig,
): PipelineState {
  const gates = template.stages
    .filter((d) => d.gate)
    .map((d) => ({ name: d.name, result: "pending" as const }));

  return {
    pipeline_id: pipelineId,
    _template_name: template.name,
    change_name: "",
    current_stage: "",
    stages: template.stages.map((d) => ({
      name: d.name,
      status: "pending" as const,
    })),
    active_agents: [],
    completed_agents: [],
    gates,
  };
}

// ─── 阶段推进 ───

export function advanceStage(
  state: PipelineState,
  stageName: string,
  status: Stage["status"],
  timestamp: string,
): PipelineState {
  const next = structuredClone(state);
  const stage = next.stages.find((s) => s.name === stageName);
  if (!stage) return next;

  stage.status = status;

  if (status === "active") {
    if (!stage.started_at) stage.started_at = timestamp;
    next.current_stage = stageName;

    const idx = next.stages.indexOf(stage);
    for (let i = 0; i < idx; i++) {
      const prev = next.stages[i];
      if (prev.status === "active") {
        prev.status = "completed";
        prev.completed_at = timestamp;
        if (prev.started_at) {
          prev.duration_ms =
            new Date(timestamp).getTime() - new Date(prev.started_at).getTime();
        }
      }
    }
  }

  if (status === "completed" || status === "failed") {
    stage.completed_at = timestamp;
    if (stage.started_at) {
      stage.duration_ms =
        new Date(timestamp).getTime() - new Date(stage.started_at).getTime();
    }
  }

  return next;
}

// ─── Gate 决策 ───

export function resolveGate(
  state: PipelineState,
  gateName: string,
  decision: "passed" | "failed",
  timestamp: string,
  comment?: string,
): PipelineState {
  const next = structuredClone(state);
  const gate = next.gates.find((g) => g.name === gateName);
  if (!gate) return next;

  gate.result = decision;
  gate.decided_at = timestamp;
  if (comment) gate.comment = comment;

  const stage = next.stages.find((s) => s.name === gateName);
  if (stage) {
    stage.status = decision === "passed" ? "completed" : "failed";
    stage.completed_at = timestamp;
    if (stage.started_at) {
      stage.duration_ms =
        new Date(timestamp).getTime() - new Date(stage.started_at).getTime();
    }

    if (decision === "passed") {
      const idx = next.stages.indexOf(stage);
      for (let i = 0; i < idx; i++) {
        const prev = next.stages[i];
        if (prev.status === "active") {
          prev.status = "completed";
          prev.completed_at = timestamp;
          if (prev.started_at) {
            prev.duration_ms =
              new Date(timestamp).getTime() - new Date(prev.started_at).getTime();
          }
        }
      }
    }
  }

  return next;
}

// ─── Agent 跟踪 ───

export function addActiveAgent(
  state: PipelineState,
  agentId: string,
  agentType: string,
  task: string,
  timestamp: string,
): PipelineState {
  const next = structuredClone(state);
  next.active_agents.push({
    id: agentId,
    type: agentType,
    task: task.slice(0, 100),
    started_at: timestamp,
  });
  if (!next.started_at) next.started_at = timestamp;
  return next;
}

export function completeAgent(
  state: PipelineState,
  agentId: string,
  agentType: string,
  status: "completed" | "error" | "aborted",
  durationMs: number,
  timestamp: string,
  summary?: string,
): PipelineState {
  const next = structuredClone(state);

  if (agentId) {
    next.active_agents = next.active_agents.filter((a) => a.id !== agentId);
  } else {
    next.active_agents = next.active_agents.filter((a) => a.type !== agentType);
  }

  next.completed_agents.push({
    type: agentType,
    status,
    duration: formatDuration(durationMs),
    duration_ms: durationMs,
    completed_at: timestamp,
    summary: summary?.slice(0, 200),
  });

  return next;
}

// ─── 查询 ───

export function nextPendingStage(state: PipelineState): string | null {
  const currentIdx = state.stages.findIndex(
    (s) => s.name === state.current_stage,
  );
  for (let i = currentIdx + 1; i < state.stages.length; i++) {
    if (state.stages[i].status === "pending") return state.stages[i].name;
  }
  return null;
}

export function isPipelineComplete(state: PipelineState): boolean {
  return state.stages.every(
    (s) => s.status === "completed" || s.status === "skipped",
  );
}

export function isPipelineFailed(state: PipelineState): boolean {
  return state.stages.some((s) => s.status === "failed");
}

export function getStageByName(
  state: PipelineState,
  name: string,
): Stage | undefined {
  return state.stages.find((s) => s.name === name);
}

export function getGateByName(
  state: PipelineState,
  name: string,
): GateRecord | undefined {
  return state.gates.find((g) => g.name === name);
}

/**
 * 判断某个阶段是否还有活跃的 Agent
 * 用于并行阶段判断是否全部完成
 */
export function hasActiveAgentsForStage(
  state: PipelineState,
  stageName: string,
  template: TemplateConfig,
): boolean {
  const stageDef = template.stages.find((s) => s.name === stageName);
  if (!stageDef?.parallel) return false;

  const agentNames = stageDef.parallel.map((p) => p.agent);
  return state.active_agents.some((a) => agentNames.includes(a.type));
}

// ─── 辅助 ───

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return sec > 60 ? `${Math.floor(sec / 60)}m${sec % 60}s` : `${sec}s`;
}

/**
 * 核心类型定义 —— 平台无关，被 Engine / SDK / Server / Adapter 共享
 */

// ─── 模板类型 ───

export interface ParallelAgentDef {
  agent: string;
  scope?: string;
}

export interface StageDef {
  name: string;
  label?: string;
  agent?: string;
  skill?: string;
  gate?: boolean;
  gate_description?: string;
  optional?: boolean;
  parallel?: ParallelAgentDef[];
  on_fail?: "retry" | "skip" | "abort";
  retries?: number;
}

export interface TemplateConfig {
  name: string;
  description: string;
  variables: Record<string, string>;
  stages: StageDef[];
  agentRefs: string[];
  raw: unknown;
}

// ─── Pipeline 实例状态 ───

export interface Stage {
  name: string;
  status: "pending" | "active" | "completed" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface ActiveAgent {
  id: string;
  type: string;
  task: string;
  started_at: string;
}

export interface CompletedAgent {
  type: string;
  status: "completed" | "error" | "aborted";
  duration: string;
  duration_ms: number;
  completed_at: string;
  summary?: string;
}

export interface GateRecord {
  name: string;
  result: "pending" | "passed" | "failed";
  decided_at?: string;
  comment?: string;
}

export interface PipelineState {
  pipeline_id: string;
  _template_name?: string;
  change_name: string;
  current_stage: string;
  started_at?: string;
  last_checkpoint?: string;
  last_status?: string;
  stages: Stage[];
  active_agents: ActiveAgent[];
  completed_agents: CompletedAgent[];
  gates: GateRecord[];
  /** 运行时动态产生的阶段（条件分支 / 循环重试中新增的） */
  runtime_stages?: Stage[];
}

export interface PipelineInstance {
  id: string;
  template: TemplateConfig;
  state: PipelineState;
  stateFile: string;
}

// ─── Manifest（编译时产出） ───

export interface ManifestConditional {
  /** 条件分支在哪个 stage 之后 */
  after: string;
  /** 可能的路径描述 */
  branches: string[];
}

export interface ManifestLoop {
  /** 涉及的 stages */
  stages: string[];
  /** 循环条件描述 */
  condition: string;
  /** 建议最大次数 */
  max?: number;
}

export interface ManifestStageDef {
  name: string;
  label?: string;
  agent?: string;
  skill?: string;
  gate?: boolean;
  gate_description?: string;
  optional?: boolean;
  parallel?: string[];
  on_fail?: string;
}

export interface PipelineManifest {
  name: string;
  version?: string;
  description?: string;
  stages: ManifestStageDef[];
  conditionals: ManifestConditional[];
  loops: ManifestLoop[];
  agents: string[];
  source: string;
}

// ─── 事件 ───

export interface PipelineEvent {
  type: string;
  pipeline_id?: string;
  data: unknown;
  timestamp: string;
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  agent_type: string;
  detail: string;
  pipeline_id: string;
}

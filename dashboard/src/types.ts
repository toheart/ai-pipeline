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
  stages: Stage[];
  active_agents: ActiveAgent[];
  completed_agents: CompletedAgent[];
  gates: GateRecord[];
}

export interface StageDef {
  name: string;
  label?: string;
  agent?: string;
  skill?: string;
  gate?: boolean;
  gate_description?: string;
  optional?: boolean;
  parallel?: { agent: string; scope?: string }[];
}

export interface PipelineSummary {
  id: string;
  template: string;
  description?: string;
  change_name: string;
  current_stage: string;
  started_at?: string;
  stage_summary: {
    total: number;
    completed: number;
    active: number;
    failed: number;
  };
}

export interface AuditEntry {
  timestamp: string;
  event: string;
  agent_type: string;
  detail: string;
  pipeline_id: string;
}

export interface PendingGate {
  name: string;
  description: string;
  previous_stage?: string;
}

import type {
  PipelineSummary,
  PipelineState,
  StageDef,
  AuditEntry,
  PendingGate,
} from "../types";

const BASE = window.location.origin;

export async function fetchPipelines(): Promise<PipelineSummary[]> {
  const res = await fetch(`${BASE}/api/v1/pipelines`);
  return res.json();
}

export async function fetchPipelineState(id: string): Promise<PipelineState> {
  const res = await fetch(`${BASE}/api/v1/pipeline/state?pipeline=${id}`);
  return res.json();
}

export async function fetchStages(id: string): Promise<StageDef[]> {
  const res = await fetch(`${BASE}/api/v1/pipeline/stages?pipeline=${id}`);
  return res.json();
}

export async function fetchAudit(
  id: string,
  limit = 30,
): Promise<AuditEntry[]> {
  const res = await fetch(
    `${BASE}/api/v1/pipeline/audit?limit=${limit}&pipeline=${id}`,
  );
  return res.json();
}

export async function fetchPendingGates(
  id: string,
): Promise<PendingGate[]> {
  const res = await fetch(
    `${BASE}/api/v1/pipeline/pending-gates?pipeline=${id}`,
  );
  return res.json();
}

export async function resolveGate(
  pipelineId: string,
  gateName: string,
  result: "passed" | "failed",
  comment?: string,
): Promise<void> {
  await fetch(`${BASE}/api/v1/pipeline/gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pipeline: pipelineId,
      gate: gateName,
      result,
      comment,
    }),
  });
}

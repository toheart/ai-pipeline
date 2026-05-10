/**
 * 审计日志模块
 */

import { appendFileSync, readFileSync } from "node:fs";
import type { AuditEntry } from "../engine/types.ts";

export function appendAudit(
  filePath: string,
  event: string,
  agentType?: string,
  detail?: string,
  pipelineId?: string,
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    event,
    agent_type: agentType ?? "",
    detail: detail ?? "",
    pipeline_id: pipelineId ?? "",
  };
  appendFileSync(filePath, JSON.stringify(entry) + "\n");
}

export function readRecentAudit(
  filePath: string,
  limit = 20,
  pipelineId?: string,
): AuditEntry[] {
  try {
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    let entries: AuditEntry[] = lines.map((l) => JSON.parse(l));
    if (pipelineId) {
      entries = entries.filter(
        (e) => !e.pipeline_id || e.pipeline_id === pipelineId,
      );
    }
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

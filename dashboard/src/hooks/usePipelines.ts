import { useState, useEffect, useCallback } from "react";
import {
  fetchPipelines,
  fetchPipelineState,
  fetchStages,
  fetchAudit,
  fetchPendingGates,
} from "../api/pipeline";
import type {
  PipelineSummary,
  PipelineState,
  StageDef,
  AuditEntry,
  PendingGate,
} from "../types";

export function usePipelines() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<PipelineState | null>(null);
  const [stages, setStages] = useState<StageDef[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [pendingGates, setPendingGates] = useState<PendingGate[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchPipelines();
      setPipelines(list);
      if (selectedId) {
        const [s, sd, a, pg] = await Promise.all([
          fetchPipelineState(selectedId),
          fetchStages(selectedId),
          fetchAudit(selectedId),
          fetchPendingGates(selectedId),
        ]);
        setState(s);
        setStages(sd);
        setAudit(a);
        setPendingGates(pg);
      }
    } catch {
      /* server might not be ready */
    }
  }, [selectedId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId((prev) => (prev === id ? null : id));
      setState(null);
      setStages([]);
      setAudit([]);
      setPendingGates([]);
    },
    [],
  );

  return {
    pipelines,
    selectedId,
    select,
    state,
    stages,
    audit,
    pendingGates,
    refresh,
  };
}

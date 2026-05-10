import { useCallback } from "react";
import { usePipelines } from "./hooks/usePipelines";
import { useWebSocket } from "./hooks/useWebSocket";
import { PipelineSelector } from "./components/PipelineSelector";
import { StageBar } from "./components/StageBar";
import { TimelineView } from "./components/TimelineView";
import { GatePanel } from "./components/GatePanel";
import { AgentPanel } from "./components/AgentPanel";
import { AuditLog } from "./components/AuditLog";

export default function App() {
  const {
    pipelines,
    selectedId,
    select,
    state,
    stages,
    audit,
    pendingGates,
    refresh,
  } = usePipelines();

  const onWsMessage = useCallback(() => {
    refresh();
  }, [refresh]);

  const connected = useWebSocket(onWsMessage);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-7 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">
            Pipeline Dashboard
          </h1>
          {state && (
            <p className="text-sm text-slate-500 mt-1">
              Change:{" "}
              <span className="text-sky-400 font-medium">
                {state.change_name || "-"}
              </span>
              {state._template_name && (
                <span className="text-purple-400 text-xs ml-2">
                  Template: {state._template_name}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="text-right">
          <span
            className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              state?.current_stage
                ? "bg-sky-900/50 text-sky-400"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {state?.current_stage || "idle"}
          </span>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500 justify-end">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {connected ? "Connected" : "Reconnecting..."}
          </div>
        </div>
      </div>

      {/* Pipeline Selector */}
      <PipelineSelector
        pipelines={pipelines}
        selectedId={selectedId}
        onSelect={select}
      />

      {/* Detail View */}
      {selectedId && state && (
        <div className="space-y-5">
          {/* Stage Progress Bar */}
          <StageBar stages={stages} state={state} />

          {/* Gate Panel */}
          {pendingGates.length > 0 && (
            <GatePanel
              gates={pendingGates}
              pipelineId={selectedId}
              onResolved={refresh}
            />
          )}

          {/* Timeline */}
          <TimelineView stages={stages} state={state} />

          {/* Agents + Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AgentPanel
              active={state.active_agents}
              completed={state.completed_agents}
            />
            <AuditLog entries={audit} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {pipelines.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          No pipelines registered. Run{" "}
          <code className="text-sky-400">npx ai-pipeline init cursor</code> to
          get started.
        </div>
      )}
    </div>
  );
}

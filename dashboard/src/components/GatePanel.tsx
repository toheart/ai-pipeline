import { useState } from "react";
import { resolveGate } from "../api/pipeline";
import type { PendingGate } from "../types";

interface Props {
  gates: PendingGate[];
  pipelineId: string;
  onResolved: () => void;
}

export function GatePanel({ gates, pipelineId, onResolved }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const handleResolve = async (
    gateName: string,
    result: "passed" | "failed",
  ) => {
    setLoading(gateName);
    try {
      await resolveGate(pipelineId, gateName, result, comment || undefined);
      setComment("");
      onResolved();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Gate — Waiting for Approval
      </h3>

      {gates.map((gate) => (
        <div key={gate.name} className="space-y-3">
          <div>
            <div className="text-base font-medium text-slate-100">
              {gate.description}
            </div>
            {gate.previous_stage && (
              <div className="text-xs text-slate-400 mt-1">
                Previous stage:{" "}
                <span className="text-slate-300">{gate.previous_stage}</span>
              </div>
            )}
          </div>

          <textarea
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
            placeholder="Optional comment..."
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={() => handleResolve(gate.name, "passed")}
              disabled={loading === gate.name}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading === gate.name ? "..." : "Approve"}
            </button>
            <button
              onClick={() => handleResolve(gate.name, "failed")}
              disabled={loading === gate.name}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              Request Changes
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

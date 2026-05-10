import type { StageDef, PipelineState } from "../types";

interface Props {
  stages: StageDef[];
  state: PipelineState;
}

const statusStyles: Record<string, string> = {
  pending: "bg-slate-900 text-slate-500",
  active: "bg-sky-900/60 text-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.12)] animate-pulse",
  completed: "bg-emerald-900/50 text-emerald-400",
  failed: "bg-red-900/40 text-red-400",
  skipped: "bg-slate-800 text-slate-600 line-through",
};

export function StageBar({ stages, state }: Props) {
  if (!stages.length) return null;

  const stageMap = new Map(state.stages.map((s) => [s.name, s]));
  const gateMap = new Map(state.gates.map((g) => [g.name, g]));

  return (
    <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-1.5 flex-wrap">
      {stages.map((def, i) => {
        const runtime = stageMap.get(def.name);
        const status = runtime?.status ?? "pending";

        if (def.gate) {
          const gate = gateMap.get(def.name);
          const gateResult = gate?.result ?? "pending";
          let gateStyle =
            "border border-dashed border-amber-500 text-amber-400 text-xs";
          if (gateResult === "passed")
            gateStyle =
              "border border-dashed border-emerald-500 text-emerald-400 text-xs";
          if (gateResult === "failed")
            gateStyle =
              "border border-dashed border-red-500 text-red-400 text-xs";

          return (
            <StageNode key={def.name} isFirst={i === 0}>
              <span
                className={`px-2.5 py-2 rounded-lg font-medium whitespace-nowrap ${gateStyle}`}
              >
                {def.gate_description ?? def.label ?? def.name}
              </span>
            </StageNode>
          );
        }

        const durationSec =
          runtime?.duration_ms && runtime.duration_ms > 0
            ? Math.round(runtime.duration_ms / 1000)
            : null;

        return (
          <StageNode key={def.name} isFirst={i === 0}>
            <span
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                statusStyles[status] ?? statusStyles.pending
              }`}
            >
              {def.label ?? def.name}
              {def.parallel && def.parallel.length > 0 && (
                <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded ml-1 align-top">
                  ∥
                </span>
              )}
              {durationSec !== null && (
                <span className="text-[10px] text-slate-500 ml-1">
                  {durationSec}s
                </span>
              )}
            </span>
          </StageNode>
        );
      })}
    </div>
  );
}

function StageNode({
  children,
  isFirst,
}: {
  children: React.ReactNode;
  isFirst: boolean;
}) {
  return (
    <>
      {!isFirst && (
        <span className="text-slate-600 text-base select-none">→</span>
      )}
      {children}
    </>
  );
}

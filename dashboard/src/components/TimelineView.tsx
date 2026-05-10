import type { StageDef, PipelineState } from "../types";

interface Props {
  stages: StageDef[];
  state: PipelineState;
}

const statusColors: Record<string, string> = {
  pending: "bg-slate-700",
  active: "bg-sky-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-slate-600",
};

export function TimelineView({ stages, state }: Props) {
  if (!stages.length || !state.stages.length) return null;

  const stageMap = new Map(state.stages.map((s) => [s.name, s]));

  // 计算时间范围
  let minTime = Infinity;
  let maxTime = -Infinity;
  const now = Date.now();

  for (const s of state.stages) {
    if (s.started_at) {
      const t = new Date(s.started_at).getTime();
      if (t < minTime) minTime = t;
    }
    if (s.completed_at) {
      const t = new Date(s.completed_at).getTime();
      if (t > maxTime) maxTime = t;
    }
  }

  if (minTime === Infinity) {
    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3">
          Timeline
        </h3>
        <p className="text-sm text-slate-500 italic">
          No stages started yet
        </p>
      </div>
    );
  }

  if (maxTime <= minTime) maxTime = now;
  const totalDuration = maxTime - minTime || 1;

  const rows = stages.filter((d) => !d.gate);

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-4">
        Timeline
      </h3>

      {/* Time axis header */}
      <div className="flex mb-2">
        <div className="w-28 shrink-0" />
        <div className="flex-1 flex justify-between text-[10px] text-slate-500">
          <span>{formatTime(minTime)}</span>
          <span>{formatTime(minTime + totalDuration / 2)}</span>
          <span>{formatTime(maxTime)}</span>
        </div>
      </div>

      {/* Stage rows */}
      <div className="space-y-1.5">
        {rows.map((def) => {
          const runtime = stageMap.get(def.name);
          if (!runtime) return null;

          const status = runtime.status;
          const started = runtime.started_at
            ? new Date(runtime.started_at).getTime()
            : null;
          const ended = runtime.completed_at
            ? new Date(runtime.completed_at).getTime()
            : status === "active"
              ? now
              : started;

          if (!started) {
            return (
              <div key={def.name} className="flex items-center h-7">
                <div className="w-28 shrink-0 text-xs text-slate-500 truncate pr-2">
                  {def.label ?? def.name}
                </div>
                <div className="flex-1 h-5 rounded bg-slate-900" />
              </div>
            );
          }

          const left = ((started - minTime) / totalDuration) * 100;
          const width = Math.max(
            ((ended! - started) / totalDuration) * 100,
            1,
          );

          return (
            <div key={def.name} className="flex items-center h-7">
              <div className="w-28 shrink-0 text-xs text-slate-400 truncate pr-2 font-medium">
                {def.label ?? def.name}
              </div>
              <div className="flex-1 relative h-5 rounded bg-slate-900">
                <div
                  className={`absolute top-0 h-full rounded ${
                    statusColors[status] ?? statusColors.pending
                  } ${status === "active" ? "animate-pulse" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${def.label ?? def.name}: ${runtime.duration_ms ? Math.round(runtime.duration_ms / 1000) + "s" : "running..."}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

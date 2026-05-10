import type { PipelineSummary } from "../types";

interface Props {
  pipelines: PipelineSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PipelineSelector({ pipelines, selectedId, onSelect }: Props) {
  if (pipelines.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Tab Buttons */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          Pipelines
        </span>
        {pipelines.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              selectedId === p.id
                ? "bg-sky-900/50 text-sky-400 border-sky-500"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:border-sky-500 hover:text-slate-200"
            }`}
          >
            {p.current_stage ? "▶" : "○"} {p.id}
            <span className="opacity-70 ml-1">
              {p.stage_summary.completed}/{p.stage_summary.total}
            </span>
          </button>
        ))}
      </div>

      {/* Overview Cards (when nothing selected) */}
      {!selectedId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pipelines.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="bg-slate-800 rounded-xl p-4 cursor-pointer border border-transparent hover:border-sky-500 transition-all"
            >
              <div className="text-sm font-semibold text-slate-50 mb-1">
                {p.id}
              </div>
              <div className="text-xs text-slate-500">
                {p.template}
                {p.change_name && ` · ${p.change_name}`}
                {p.current_stage && (
                  <span className="text-sky-400"> @{p.current_stage}</span>
                )}
              </div>
              <ProgressBar summary={p.stage_summary} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  summary,
}: {
  summary: PipelineSummary["stage_summary"];
}) {
  const total = summary.total || 1;
  const pending =
    total - summary.completed - summary.active - (summary.failed ?? 0);

  return (
    <div className="flex gap-0.5 mt-2 h-1 rounded overflow-hidden">
      {Array.from({ length: summary.completed }).map((_, i) => (
        <div key={`d${i}`} className="flex-1 bg-emerald-400 rounded-sm" />
      ))}
      {Array.from({ length: summary.active }).map((_, i) => (
        <div key={`a${i}`} className="flex-1 bg-sky-400 rounded-sm" />
      ))}
      {Array.from({ length: summary.failed ?? 0 }).map((_, i) => (
        <div key={`f${i}`} className="flex-1 bg-red-400 rounded-sm" />
      ))}
      {Array.from({ length: Math.max(0, pending) }).map((_, i) => (
        <div key={`p${i}`} className="flex-1 bg-slate-700 rounded-sm" />
      ))}
    </div>
  );
}

import type { ActiveAgent, CompletedAgent } from "../types";

interface Props {
  active: ActiveAgent[];
  completed: CompletedAgent[];
}

export function AgentPanel({ active, completed }: Props) {
  return (
    <div className="space-y-4">
      {/* Active Agents */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3">
          Active Agents
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No active agents</p>
        ) : (
          <div className="space-y-2">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-2 border-b border-slate-900 last:border-b-0"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {a.type}
                  </div>
                  <div
                    className="text-xs text-slate-500 max-w-[220px] truncate"
                    title={a.task}
                  >
                    {a.task}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-900/50 text-sky-400">
                  running
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Agents */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3">
          Completed Agents
        </h3>
        {completed.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            No completed agents yet
          </p>
        ) : (
          <div className="space-y-2">
            {completed.map((a, i) => {
              const isDone =
                a.status === "completed";
              return (
                <div
                  key={`${a.type}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-slate-900 last:border-b-0"
                >
                  <div className="text-sm font-medium text-slate-200">
                    {a.type}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        isDone
                          ? "bg-emerald-900/50 text-emerald-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {isDone ? "done" : a.status}
                    </span>
                    {a.duration && (
                      <span className="text-xs text-slate-500">
                        {a.duration}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

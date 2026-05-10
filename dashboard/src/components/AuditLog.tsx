import type { AuditEntry } from "../types";

interface Props {
  entries: AuditEntry[];
}

export function AuditLog({ entries }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3">
        Recent Events
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No events yet</p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {[...entries].reverse().map((e, i) => {
            const time = e.timestamp
              ? new Date(e.timestamp).toLocaleTimeString("zh-CN")
              : "";
            return (
              <div
                key={i}
                className="flex gap-3 text-xs font-mono py-1"
              >
                <span className="text-slate-500 shrink-0 w-18">
                  {time}
                </span>
                <span className="text-slate-300">{e.event}</span>
                {e.agent_type && (
                  <span className="text-purple-400">{e.agent_type}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

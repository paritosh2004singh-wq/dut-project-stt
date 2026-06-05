import { memo } from "react";
import { FaClockRotateLeft } from "react-icons/fa6";

const formatDateTime = (value) => {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

export const RecentSessionsPanel = memo(({ sessions, isLoading, onSelect }) => {
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-500 font-medium">
          Loading history...
        </div>
      ) : null}

      {!isLoading && sessions.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No archive yet.
        </div>
      ) : null}

      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelect(session.id)}
          className="w-full group rounded-2xl bg-white border border-slate-100 p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-0.5"
        >
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-[#1d1d1f] group-hover:text-blue-600 transition-colors">{session.target_language} Session</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{session.status}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1.5 bg-[#f5f5f7] px-2 py-1 rounded-md font-medium">
                <FaClockRotateLeft className="text-[10px]" />
                {formatDateTime(session.created_at)}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

RecentSessionsPanel.displayName = "RecentSessionsPanel";

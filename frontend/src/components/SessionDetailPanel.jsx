import { memo } from "react";
import { FaClock, FaLanguage, FaWaveSquare } from "react-icons/fa6";

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

const formatLanguage = (value) => value || "Unknown";

export const SessionDetailPanel = memo(({
  session,
  selectedSegmentId,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500 font-medium">
        Loading session details...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-8 lg:p-12 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100">
      <div className="border-b border-slate-100 pb-8 mb-8">
        <h3 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{session.target_language} Session</h3>

        <div className="mt-6 flex flex-wrap gap-4">
          <div className="inline-flex items-center gap-2 bg-[#f5f5f7] px-4 py-2 rounded-xl">
            <FaClock className="text-slate-400 text-sm" />
            <span className="text-sm font-medium text-slate-600">{formatDateTime(session.created_at)}</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-[#f5f5f7] px-4 py-2 rounded-xl">
            <FaLanguage className="text-slate-400 text-sm" />
            <span className="text-sm font-medium text-slate-600">
              {formatLanguage(session.source_language)} &rarr; {formatLanguage(session.target_language)}
            </span>
          </div>
          <div className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-50 text-blue-600">
            <span className="text-[10px] font-bold uppercase tracking-wider">{session.status}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {session.segments?.length ? (
          session.segments.map((segment, index) => {
            const isHighlighted = segment.id === selectedSegmentId;

            return (
              <article
                key={segment.id}
                className={`p-6 rounded-3xl transition-all ${
                  isHighlighted
                    ? "bg-blue-50 border border-blue-100"
                    : "bg-[#fbfbfd] border border-slate-100"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <FaWaveSquare /> Segment {index + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{formatDateTime(segment.created_at)}</span>
                </div>
                <p className="text-lg leading-relaxed text-[#1d1d1f]">{segment.translation || segment.text}</p>
              </article>
            );
          })
        ) : (
          <div className="py-12 text-center text-sm text-slate-500 font-medium bg-[#f5f5f7] rounded-3xl">
            This session does not have any stored transcript segments yet.
          </div>
        )}
      </div>
    </div>
  );
});

SessionDetailPanel.displayName = "SessionDetailPanel";

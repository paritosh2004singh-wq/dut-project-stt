import { memo } from "react";
import { FaArrowRight, FaDatabase } from "react-icons/fa6";

export const SearchResultList = memo(({
  query,
  results,
  isSearching,
  selectedSessionId,
  selectedSegmentId,
  onSelect,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {query ? "Search Results" : "Archive"}
        </h3>
        <div className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500">
          {results.length}
        </div>
      </div>

      {isSearching ? (
        <div className="py-8 text-center text-sm text-slate-500 font-medium">
          Searching archive...
        </div>
      ) : null}

      {!isSearching && results.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No matches found.
        </div>
      ) : null}

      <div className="space-y-3">
        {results.map((result) => {
          const isSelected =
            selectedSessionId === result.session_id &&
            selectedSegmentId === result.segment_id;

          return (
            <button
              key={result.segment_id}
              type="button"
              onClick={() => onSelect(result.session_id, result.segment_id)}
              className={`w-full group rounded-2xl p-4 text-left transition-all ${
                isSelected
                  ? "bg-blue-50 border border-blue-200 shadow-sm"
                  : "bg-white border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-0.5"
              }`}
            >
              <div className="flex flex-col gap-2">
                <p className={`text-sm leading-relaxed line-clamp-3 ${isSelected ? "text-blue-900 font-medium" : "text-[#1d1d1f]"}`}>
                  {result.translation || result.text}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <FaDatabase /> Session Match
                  </span>
                  <FaArrowRight className={`text-[10px] ${isSelected ? "text-blue-600" : "text-slate-300 group-hover:text-blue-400"} transition-colors`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

SearchResultList.displayName = "SearchResultList";

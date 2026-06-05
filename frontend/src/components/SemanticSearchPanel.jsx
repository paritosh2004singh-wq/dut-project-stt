import { memo } from "react";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

export const SemanticSearchPanel = memo(({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  isSearching,
  error,
}) => {
  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(query);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <FaMagnifyingGlass className="absolute left-3 text-slate-400 text-sm" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search semantic archive..."
          className="w-full bg-[#f3f3f5] focus:bg-white border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-2.5 pl-9 pr-10 text-sm text-[#1d1d1f] outline-none transition-all placeholder:text-slate-400 font-medium"
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FaXmark />
          </button>
        )}
      </form>
      {error ? (
        <div className="mt-2 text-xs text-red-500 font-medium px-1">
          {error}
        </div>
      ) : null}
    </div>
  );
});

SemanticSearchPanel.displayName = "SemanticSearchPanel";

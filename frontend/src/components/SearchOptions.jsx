import { memo } from "react";
import { StatusIndicator } from "./StatusIndicator";
import { getStatusColor } from "../utils/formatting";
import { LanguageAutocomplete } from "./LanguageAutocomplete";

export const SearchOptions = memo(({
  language,
  onLanguageChange,
  isRecording,
  fastStatus,
  slowStatus,
  connectionStatus
}) => {
  return (
    <div className="flex items-center gap-6 bg-white rounded-full px-6 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
      <div className="flex items-center gap-4">
        <div className="relative min-w-[140px]">
          <LanguageAutocomplete
            value={language}
            onChange={onLanguageChange}
            isDisabled={isRecording}
            placeholder="Language"
          />
        </div>

        {isRecording && (
          <div className="flex items-center gap-4 pl-4 border-l border-slate-100">
            <StatusIndicator status={fastStatus} label="Fast" />
            <StatusIndicator status={slowStatus} label="Slow" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(connectionStatus)} ${
          connectionStatus === "connecting" ? "animate-pulse" : ""
        }`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{connectionStatus}</span>
      </div>
    </div>
  );
});

SearchOptions.displayName = "SearchOptions";

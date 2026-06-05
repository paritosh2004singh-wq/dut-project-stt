import { memo } from "react";

export const ModeSwitcher = memo(({ mode, onChange, isRecording }) => {
  return (
    <div className="relative inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 shadow-inner">
      <div 
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-white shadow transition-all duration-300 ease-in-out"
        style={{ left: mode === "record" ? "4px" : "calc(50% + 0px)" }}
      />
      <button
        type="button"
        onClick={() => onChange("record")}
        className={`relative z-10 w-24 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
          mode === "record"
            ? "text-slate-900"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Record
      </button>
      <button
        type="button"
        onClick={() => onChange("search")}
        disabled={isRecording}
        className={`relative z-10 w-24 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
          mode === "search"
            ? "text-cyan-700"
            : "text-slate-500 hover:text-slate-700"
        } ${isRecording ? "cursor-not-allowed opacity-50" : ""}`}
      >
        Search
      </button>
    </div>
  );
});

ModeSwitcher.displayName = "ModeSwitcher";

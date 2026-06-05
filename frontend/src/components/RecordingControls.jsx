import { memo } from "react";
import { FaMicrophone, FaStop } from "react-icons/fa";

export const RecordingControls = memo(({ isRecording, onStart, onStop }) => {
  if (!isRecording) {
    return (
      <button
        onClick={onStart}
        className="group relative flex items-center gap-3 px-6 py-3 rounded-full bg-[#1d1d1f] text-white overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_4px_14px_rgba(0,0,0,0.1)]"
      >
        <FaMicrophone className="text-sm relative z-10" />
        <span className="text-sm font-semibold tracking-wide relative z-10">Start Recording</span>
      </button>
    );
  }

  return (
    <button
      onClick={onStop}
      className="flex items-center gap-3 px-6 py-3 rounded-full bg-red-500 text-white transition-all hover:bg-red-600 hover:scale-105 active:scale-95 shadow-[0_4px_14px_rgba(239,68,68,0.3)]"
    >
      <FaStop className="text-sm" />
      <span className="text-sm font-semibold tracking-wide">Stop</span>
    </button>
  );
});

RecordingControls.displayName = "RecordingControls";
// components/RecordingControls.jsx
import { FaMicrophone, FaStop } from "react-icons/fa";

export const RecordingControls = ({ isRecording, onStart, onStop }) => {
  if (!isRecording) {
    return (
      <button
        onClick={onStart}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
        title="Voice Search"
      >
        <FaMicrophone className="text-sm" />
        <span className="text-sm font-medium">Search with voice</span>
      </button>
    );
  }

  return (
    <button
      onClick={onStop}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
      title="Stop Recording"
    >
      <FaStop className="text-sm" />
      <span className="text-sm font-medium">Stop</span>
    </button>
  );
};
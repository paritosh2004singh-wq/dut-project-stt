// components/AudioLevelIndicator.jsx
import { FaVolumeUp } from "react-icons/fa";
import { useAudioLevel } from "../hooks/useAudioLevel";

export const AudioLevelIndicator = ({ audioLevel, isRecording }) => {
  const audioLevelPercentage = useAudioLevel(audioLevel);

  if (!isRecording) return null;

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-2 mb-1">
        <FaVolumeUp className="text-gray-400 text-xs" />
        <span className="text-xs text-gray-400">Audio Level</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 transition-all duration-100 rounded-full"
          style={{ width: `${audioLevelPercentage}%` }}
        />
      </div>
    </div>
  );
};
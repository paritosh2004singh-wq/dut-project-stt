// hooks/useAudioLevel.js
import { useMemo } from "react";

export const useAudioLevel = (audioLevel) => {
  const audioLevelPercentage = useMemo(() => 
    Math.min((audioLevel / 128) * 100, 100), 
    [audioLevel]
  );

  return audioLevelPercentage;
};
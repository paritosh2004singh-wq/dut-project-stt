import { useEffect, useState } from "react";

export function useRecordingDuration(isRecording, startTimeRef) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (!startTimeRef.current) {
        return;
      }

      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, startTimeRef]);

  const resetDuration = () => {
    setDuration(0);
  };

  return { duration, resetDuration };
}

import { useEffect, useRef, useState } from "react";

/**
 * Simple recording timer hook
 */
export const useRecordingTimer = (isRecording) => {
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setDuration(0);
      startTimeRef.current = null;
    }
  }, [isRecording]);

  return duration;
};

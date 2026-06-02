import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioMeter(analyserRef) {
  const [audioLevel, setAudioLevel] = useState(0);
  const animationFrameRef = useRef(null);

  const stopMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  const startMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    const tick = () => {
      const analyser = analyserRef.current;

      if (!analyser) {
        animationFrameRef.current = null;
        return;
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [analyserRef]);

  useEffect(() => stopMeter, [stopMeter]);

  return { audioLevel, startMeter, stopMeter };
}

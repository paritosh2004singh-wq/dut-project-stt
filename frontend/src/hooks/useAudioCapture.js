import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_ENERGY_THRESHOLD = 5;
const VAD_SILENCE_TIMEOUT_MS = 1500;

/**
 * Convert Float32Array to 16-bit PCM
 */
const floatTo16BitPCM = (float32Array) => {
  const int16Array = new Int16Array(float32Array.length);
  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]));
    int16Array[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16Array;
};

/**
 * Audio capture hook using modern AudioWorklet API (with ScriptProcessor fallback)
 */
export const useAudioCapture = ({ onAudioData, onSilenceDetected, enabled = false }) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSilent, setIsSilent] = useState(false);

  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);

  const updateAudioLevel = useCallback(function refreshAudioLevel() {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((total, value) => total + value) / dataArray.length;
      setAudioLevel(average);

      // Silence detection
      if (average < SILENCE_ENERGY_THRESHOLD) {
        if (!silenceTimerRef.current) {
          setIsSilent(true);
          silenceTimerRef.current = setTimeout(() => {
            onSilenceDetected?.();
          }, VAD_SILENCE_TIMEOUT_MS);
        }
      } else {
        // Speech detected — reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        setIsSilent(false);
      }

      animationFrameRef.current = requestAnimationFrame(refreshAudioLevel);
    }
  }, [onSilenceDetected]);

  const setupAudioProcessing = useCallback(async () => {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    streamRef.current = stream;

    // Create audio context
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    // Create analyser for audio level visualization
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Use ScriptProcessor (deprecated but widely supported)
    // TODO: Migrate to AudioWorklet for better performance
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      const float32Data = event.inputBuffer.getChannelData(0);
      const int16Data = floatTo16BitPCM(float32Data);
      onAudioData?.(int16Data.buffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Start audio level monitoring
    updateAudioLevel();
  }, [onAudioData, updateAudioLevel]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setAudioLevel(0);
    setIsSilent(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      setupAudioProcessing().catch((error) => {
        console.error("Error setting up audio:", error);
      });
    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, setupAudioProcessing, cleanup]);

  return {
    audioLevel,
    isSilent,
  };
};

import { useCallback, useEffect, useRef, useState } from "react";

const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL?.trim() || "ws://localhost:8080";

const getWebSocketUrl = () => {
  let normalizedBaseUrl = wsBaseUrl;

  if (normalizedBaseUrl.startsWith("http://")) {
    normalizedBaseUrl = `ws://${normalizedBaseUrl.slice(7)}`;
  } else if (normalizedBaseUrl.startsWith("https://")) {
    normalizedBaseUrl = `wss://${normalizedBaseUrl.slice(8)}`;
  }

  return new URL("/ws/transcribe", normalizedBaseUrl).toString();
};

export const useAudioRecording = (language) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [confirmedText, setConfirmedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [fastStatus, setFastStatus] = useState("connecting");
  const [slowStatus, setSlowStatus] = useState("connecting");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const analyserRef = useRef(null);

  const floatTo16BitPCM = useCallback((float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let index = 0; index < float32Array.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, float32Array[index]));
      int16Array[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return int16Array;
  }, []);

  const updateAudioLevel = useCallback(function refreshAudioLevel() {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((total, value) => total + value) / dataArray.length;
      setAudioLevel(average);
      animationFrameRef.current = requestAnimationFrame(refreshAudioLevel);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const setupWebSocket = useCallback((onConfigSent) => {
    const socket = new WebSocket(getWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");

      const config = {
        type: "config",
        sample_rate: 16000,
        fast_delay_ms: 240,
        slow_delay_ms: 2400,
        chunk_duration_ms: 10,
        target_language: language.value,
      };

      socket.send(JSON.stringify(config));
      onConfigSent?.();
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "transcript") {
          setConfirmedText(message.confirmed_text || "");
          setPartialText(message.partial_text || "");
          setIsTranslating(message.is_translating || false);

          if (message.translated_text !== undefined) {
            setTranslatedText(message.translated_text || "");
          }
        } else if (message.type === "status") {
          if (message.stream === "fast") {
            setFastStatus(message.status);
          } else if (message.stream === "slow") {
            setSlowStatus(message.status);
          }
        } else if (message.type === "error") {
          setConnectionStatus("error");
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
    };

    socket.onerror = () => {
      setConnectionStatus("error");
    };

    return socket;
  }, [language]);

  const setupAudioProcessing = useCallback(async (socket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    streamRef.current = stream;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (socket.readyState === WebSocket.OPEN) {
        const float32Data = event.inputBuffer.getChannelData(0);
        const int16Data = floatTo16BitPCM(float32Data);
        socket.send(int16Data.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, [floatTo16BitPCM]);

  const startRecording = useCallback(async () => {
    try {
      setConfirmedText("");
      setPartialText("");
      setTranslatedText("");
      setIsTranslating(false);

      const socket = setupWebSocket(async () => {
        try {
          await setupAudioProcessing(socket);
          setIsRecording(true);
          startTimeRef.current = Date.now();
          updateAudioLevel();
        } catch (error) {
          console.error("Error accessing media devices:", error);
          setConnectionStatus("error");
        }
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      setConnectionStatus("error");
    }
  }, [setupAudioProcessing, setupWebSocket, updateAudioLevel]);

  const stopRecording = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
    }

    cleanup();
    setIsRecording(false);
    setAudioLevel(0);
    setDuration(0);
    setFastStatus("connecting");
    setSlowStatus("connecting");
  }, [cleanup]);

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => cleanup, [cleanup]);

  return {
    isRecording,
    audioLevel,
    duration,
    connectionStatus,
    confirmedText,
    partialText,
    fastStatus,
    slowStatus,
    translatedText,
    isTranslating,
    autoSearchCandidate: (translatedText || confirmedText).trim(),
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText,
  };
};

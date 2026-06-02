// hooks/useAudioRecording.js
import { useRef, useState, useCallback, useEffect } from "react";

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
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const setupWebSocket = useCallback((onConfigSent) => {
    const socket = new WebSocket("ws://localhost:8000/ws/transcribe");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection opened.");
      setConnectionStatus("connected");
      
      const config = {
        type: "config",
        sample_rate: 16000,
        fast_delay_ms: 240,
        slow_delay_ms: 2400,
        chunk_duration_ms: 10,
        target_language: language.value
      };
      socket.send(JSON.stringify(config));
      console.log("Config sent:", config);
      
      // Call the callback after config is sent
      if (onConfigSent) {
        onConfigSent();
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message);
        
        if (message.type === "transcript") {
          setConfirmedText(message.confirmed_text || "");
          setPartialText(message.partial_text || "");
          setIsTranslating(message.is_translating || false);
          if (message.translated_text !== undefined) {
            setTranslatedText(message.translated_text || "");
          }
        } else if (message.type === "status") {
          console.log(`Status [${message.stream}]: ${message.status}`);
          if (message.stream === "fast") {
            setFastStatus(message.status);
          } else if (message.stream === "slow") {
            setSlowStatus(message.status);
          }
        } else if (message.type === "error") {
          console.error("Server error:", message.message);
          setConnectionStatus("error");
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed.");
      setConnectionStatus("disconnected");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
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
        noiseSuppression: true
      } 
    });
    
    streamRef.current = stream;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    audioContextRef.current = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    
    processor.onaudioprocess = (e) => {
      if (socket.readyState === WebSocket.OPEN) {
        const float32Data = e.inputBuffer.getChannelData(0);
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
        // Only start audio processing after config is sent
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
  }, [setupWebSocket, setupAudioProcessing, updateAudioLevel]);

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

  // Duration timer
  useEffect(() => {
    if (!isRecording) return;
    
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRecording]);

  // Cleanup on unmount
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
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText
  };
};
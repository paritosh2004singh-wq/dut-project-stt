import { useCallback, useEffect, useRef, useState } from "react";

const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL?.trim() || "ws://localhost:8080";

const VAD_SILENCE_TIMEOUT_MS = 1500;
const SILENCE_ENERGY_THRESHOLD = 5;

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
  const selectedLanguage = language?.value?.trim() || "English";
  const translateToEnglish = !language || selectedLanguage === "English";
  const isEnglishMode = selectedLanguage === "English";
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
  const [activeEnglishText, setActiveEnglishText] = useState("");
  const [isSilent, setIsSilent] = useState(false);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const analyserRef = useRef(null);
  
  const sessionIdRef = useRef(null);
  const intentionalStopRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const highestSequenceRef = useRef(-1);
  const silenceTimerRef = useRef(null);
  const stopRecordingRef = useRef(null);

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

      // Silence auto-stop detection
      if (average < SILENCE_ENERGY_THRESHOLD) {
        if (!silenceTimerRef.current) {
          setIsSilent(true);
          silenceTimerRef.current = setTimeout(() => {
            // Auto-stop recording after sustained silence
            if (stopRecordingRef.current) {
              stopRecordingRef.current();
            }
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

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn("Error closing socket during cleanup:", e);
      }
      socketRef.current = null;
    }
  }, []);
  
  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
  }, []);

  const setupWebSocket = useCallback((isReconnect = false) => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn("Error closing old socket:", e);
      }
    }
    const socket = new WebSocket(getWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptRef.current = 0;
      stopHeartbeat();
      
      const session_id = sessionIdRef.current;

      const config = {
        type: isReconnect ? "resume_session" : "config",
        session_id: session_id,
        sample_rate: 16000,
        fast_delay_ms: 240,
        slow_delay_ms: 2400,
        chunk_duration_ms: 10,
        target_language: selectedLanguage,
        translate_to_english: translateToEnglish,
      };

      socket.send(JSON.stringify(config));
      
      // Setup Ping/Pong Heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
          
          pongTimeoutRef.current = setTimeout(() => {
            console.warn("WebSocket heartbeat timed out. Closing socket.");
            socket.close();
          }, 30000); // 30 seconds wait for pong
        }
      }, 10000); // Ping every 10 seconds
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === "pong") {
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          return;
        }
        
        if (message.type === "session_restored") {
          if (isEnglishMode) {
            setConfirmedText("");
            setPartialText("");
            setActiveEnglishText("");
          } else {
            setConfirmedText(message.history || "");
            setPartialText("");
            setActiveEnglishText("");
          }
          if (message.translated_history) {
            setTranslatedText(message.translated_history);
          }
        } else if (message.type === "transcript") {
          if (message.sequence !== undefined) {
             if (message.sequence <= highestSequenceRef.current) {
                // Duplicate or out-of-order segment, ignore
                return;
             }
             highestSequenceRef.current = message.sequence;
          }
          
          if (isEnglishMode) {
            setConfirmedText("");
            setPartialText("");
            setActiveEnglishText("");
          } else {
            setConfirmedText(message.confirmed_text || "");
            setPartialText(message.partial_text || "");
            setActiveEnglishText(message.active_english_text || "");
          }
          setIsTranslating(message.is_translating || false);

          if (message.translated_text !== undefined) {
            setTranslatedText(message.translated_text || "");
          }
        } else if (message.type === "translation_started") {
          setIsTranslating(true);
        } else if (message.type === "translation_complete") {
          if (message.translated_text !== undefined) {
            setTranslatedText(message.translated_text || "");
          }
          setIsTranslating(false);
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
      stopHeartbeat();
      if (!intentionalStopRef.current) {
         setConnectionStatus("reconnecting");
         const attempt = reconnectAttemptRef.current;
         const delay = Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
         
         reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptRef.current += 1;
            console.log(`Reconnecting attempt ${reconnectAttemptRef.current}...`);
            setupWebSocket(true);
         }, delay);
      } else {
         setConnectionStatus("disconnected");
      }
    };

    socket.onerror = () => {
      if (intentionalStopRef.current) {
          setConnectionStatus("error");
      }
    };

    return socket;
  }, [isEnglishMode, selectedLanguage, stopHeartbeat, translateToEnglish]);

  const setupAudioProcessing = useCallback(async () => {
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
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const float32Data = event.inputBuffer.getChannelData(0);
        const int16Data = floatTo16BitPCM(float32Data);
        socketRef.current.send(int16Data.buffer);
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
      setActiveEnglishText("");
      setIsTranslating(false);
      intentionalStopRef.current = false;
      reconnectAttemptRef.current = 0;
      highestSequenceRef.current = -1;
      
      let sessionId = localStorage.getItem("transcription_session_id");
      if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem("transcription_session_id", sessionId);
      }
      sessionIdRef.current = sessionId;

      const isReconnect = !!localStorage.getItem("transcription_session_id") && confirmedText.length > 0;
      setupWebSocket(isReconnect);

      await setupAudioProcessing();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      updateAudioLevel();
    } catch (error) {
      console.error("Error starting recording:", error);
      setConnectionStatus("error");
    }
  }, [setupAudioProcessing, setupWebSocket, updateAudioLevel, confirmedText.length]);

  const stopRecording = useCallback(() => {
    intentionalStopRef.current = true;
    localStorage.removeItem("transcription_session_id");
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
    }

    cleanup();
    setIsRecording(false);
    setAudioLevel(0);
    setDuration(0);
    setIsSilent(false);
    setFastStatus("connecting");
    setSlowStatus("connecting");
  }, [cleanup]);

  // Keep stopRecordingRef in sync so the silence timer closure can call it
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

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
    activeEnglishText,
    isSilent,
    autoSearchCandidate: (translatedText || confirmedText).trim(),
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText,
    setActiveEnglishText,
  };
};

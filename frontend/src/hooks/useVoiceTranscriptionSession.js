import { useCallback, useEffect, useRef, useState } from "react";

import {
  defaultLanguage,
  transcriptionConfig,
  transcriptionWebSocketUrl,
} from "../constants/voiceSearch";
import { useAudioMeter } from "./useAudioMeter";
import { useRecordingDuration } from "./useRecordingDuration";

function floatTo16BitPCM(float32Array) {
  const int16Array = new Int16Array(float32Array.length);

  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[index]));
    int16Array[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return int16Array;
}

export function useVoiceTranscriptionSession() {
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [confirmedText, setConfirmedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [fastStatus, setFastStatus] = useState("connecting");
  const [slowStatus, setSlowStatus] = useState("connecting");
  const [language, setLanguage] = useState(defaultLanguage);
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const startTimeRef = useRef(null);

  const { audioLevel, startMeter, stopMeter } = useAudioMeter(analyserRef);
  const { duration, resetDuration } = useRecordingDuration(isRecording, startTimeRef);

  const clearTranscript = useCallback(() => {
    setConfirmedText("");
    setPartialText("");
    setTranslatedText("");
    setIsTranslating(false);
  }, []);

  const cleanupAudioResources = useCallback(() => {
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

    analyserRef.current = null;
    stopMeter();
  }, [stopMeter]);

  const handleSocketMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === "transcript") {
        setConfirmedText(message.confirmed_text || "");
        setPartialText(message.partial_text || "");
        setIsTranslating(message.is_translating || false);

        if (message.translated_text !== undefined) {
          setTranslatedText(message.translated_text || "");
        }

        return;
      }

      if (message.type === "status") {
        if (message.stream === "fast") {
          setFastStatus(message.status);
        } else if (message.stream === "slow") {
          setSlowStatus(message.status);
        }

        return;
      }

      if (message.type === "error") {
        console.error("Server error:", message.message);
        setConnectionStatus("error");
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send("stop");
    }

    cleanupAudioResources();
    setIsRecording(false);
    resetDuration();
    setFastStatus("connecting");
    setSlowStatus("connecting");
  }, [cleanupAudioResources, resetDuration]);

  const startRecording = useCallback(async () => {
    try {
      clearTranscript();
      resetDuration();
      setFastStatus("connecting");
      setSlowStatus("connecting");
      setConnectionStatus("connecting");

      const socket = new WebSocket(transcriptionWebSocketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("connected");

        const config = {
          type: "config",
          ...transcriptionConfig,
          target_language: language.value,
        };

        socket.send(JSON.stringify(config));

        navigator.mediaDevices
          .getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: transcriptionConfig.sample_rate,
              echoCancellation: true,
              noiseSuppression: true,
            },
          })
          .then((stream) => {
            if (socketRef.current !== socket) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }

            streamRef.current = stream;

            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextCtor({
              sampleRate: transcriptionConfig.sample_rate,
            });

            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (audioEvent) => {
              if (socket.readyState !== WebSocket.OPEN) {
                return;
              }

              const float32Data = audioEvent.inputBuffer.getChannelData(0);
              const int16Data = floatTo16BitPCM(float32Data);
              socket.send(int16Data.buffer);
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsRecording(true);
            startTimeRef.current = Date.now();
            startMeter();
          })
          .catch((error) => {
            console.error("Error accessing media devices:", error);
            setConnectionStatus("error");
            cleanupAudioResources();

            if (socket.readyState === WebSocket.OPEN) {
              socket.close();
            }
          });
      };

      socket.onmessage = handleSocketMessage;

      socket.onclose = () => {
        socketRef.current = null;
        setConnectionStatus((current) => (current === "error" ? current : "disconnected"));
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };
    } catch (error) {
      console.error("Error starting recording:", error);
      setConnectionStatus("error");
      cleanupAudioResources();
    }
  }, [clearTranscript, cleanupAudioResources, handleSocketMessage, language.value, resetDuration, startMeter]);

  useEffect(
    () => () => {
      stopRecording();
    },
    [stopRecording]
  );

  return {
    audioLevel,
    clearTranscript,
    confirmedText,
    connectionStatus,
    duration,
    fastStatus,
    isRecording,
    isTranslating,
    language,
    partialText,
    setLanguage,
    slowStatus,
    startRecording,
    stopRecording,
    translatedText,
  };
}

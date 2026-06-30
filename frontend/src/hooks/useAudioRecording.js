import { useCallback, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioCapture } from "./useAudioCapture";
import { useTranscriptionState } from "./useTranscriptionState";
import { useRecordingTimer } from "./useRecordingTimer";
import { useSessionManager } from "./useSessionManager";

/**
 * Main audio recording hook - orchestrates WebSocket, audio capture, and state
 */
export const useAudioRecording = (language) => {
  const selectedLanguage = language?.value?.trim() || "English";
  const translateToEnglish = !language || selectedLanguage === "English";
  const isEnglishMode = selectedLanguage === "English";

  const [isRecording, setIsRecording] = useState(false);

  // Session management
  const { getOrCreateSessionId, clearSession, hasExistingSession } = useSessionManager();

  // Transcription state management
  const {
    confirmedText,
    partialText,
    activeEnglishText,
    translatedText,
    isTranslating,
    translationDurationMs,
    fastStatus,
    slowStatus,
    setConfirmedText,
    setPartialText,
    setActiveEnglishText,
    setTranslatedText,
    handleTranscriptMessage,
    handleSessionRestored,
    handleTranslationStarted,
    handleTranslationComplete,
    handleStatusMessage,
    resetState,
  } = useTranscriptionState(isEnglishMode);

  // Recording timer
  const duration = useRecordingTimer(isRecording);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (message) => {
      switch (message.type) {
        case "session_restored":
          handleSessionRestored(message);
          break;
        case "transcript":
          handleTranscriptMessage(message);
          break;
        case "translation_started":
          handleTranslationStarted();
          break;
        case "translation_complete":
          handleTranslationComplete(message);
          break;
        case "status":
          handleStatusMessage(message);
          break;
        case "error":
          console.error("WebSocket error:", message);
          break;
        default:
          break;
      }
    },
    [
      handleSessionRestored,
      handleTranscriptMessage,
      handleTranslationStarted,
      handleTranslationComplete,
      handleStatusMessage,
    ]
  );

  // WebSocket connection
  const { connectionStatus, sendData, close: closeWebSocket } = useWebSocket({
    sessionId: getOrCreateSessionId(),
    selectedLanguage,
    translateToEnglish,
    onMessage: handleWebSocketMessage,
    enabled: isRecording,
  });

  // Stop recording callback
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    clearSession();
    closeWebSocket();
  }, [clearSession, closeWebSocket]);

  // Audio capture with silence detection
  const { audioLevel, isSilent } = useAudioCapture({
    onAudioData: sendData,
    onSilenceDetected: stopRecording,
    enabled: isRecording,
  });

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Reset state
      resetState();

      // Get or create session ID
      const sessionId = getOrCreateSessionId();
      const isReconnect = hasExistingSession() && confirmedText.length > 0;

      console.log(
        isReconnect ? `Resuming session: ${sessionId}` : `Starting new session: ${sessionId}`
      );

      // Start recording
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
    }
  }, [getOrCreateSessionId, hasExistingSession, confirmedText.length, resetState]);

  return {
    // Recording state
    isRecording,
    audioLevel,
    duration,
    isSilent,

    // Connection state
    connectionStatus,

    // Transcription state
    confirmedText,
    partialText,
    activeEnglishText,
    translatedText,
    isTranslating,
    translationDurationMs,

    // Stream status
    fastStatus,
    slowStatus,

    // Computed
    autoSearchCandidate: (translatedText || confirmedText).trim(),

    // Actions
    startRecording,
    stopRecording,

    // State setters (for external control)
    setConfirmedText,
    setPartialText,
    setTranslatedText,
    setActiveEnglishText,
  };
};


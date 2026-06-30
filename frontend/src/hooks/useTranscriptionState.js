import { useCallback, useRef, useState } from "react";

/**
 * Manages transcription state including text, translation, and sequence tracking
 */
export const useTranscriptionState = (isEnglishMode) => {
  const [confirmedText, setConfirmedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [activeEnglishText, setActiveEnglishText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationDurationMs, setTranslationDurationMs] = useState(0);
  const [fastStatus, setFastStatus] = useState("connecting");
  const [slowStatus, setSlowStatus] = useState("connecting");

  const highestSequenceRef = useRef(-1);
  const translationStartTimeRef = useRef(null);

  const handleTranscriptMessage = useCallback((message) => {
    // Check for duplicate or out-of-order messages
    if (message.sequence !== undefined) {
      if (message.sequence <= highestSequenceRef.current) {
        return; // Ignore duplicate or out-of-order
      }
      highestSequenceRef.current = message.sequence;
    }

    // Update text based on mode
    if (isEnglishMode) {
      setConfirmedText("");
      setPartialText("");
      setActiveEnglishText("");
    } else {
      setConfirmedText(message.confirmed_text || "");
      setPartialText(message.partial_text || "");
      setActiveEnglishText(message.active_english_text || "");
    }

    // Handle translation timing
    if (message.is_translating && !translationStartTimeRef.current) {
      translationStartTimeRef.current = Date.now();
      setTranslationDurationMs(0);
    } else if (!message.is_translating && translationStartTimeRef.current) {
      setTranslationDurationMs(Date.now() - translationStartTimeRef.current);
      translationStartTimeRef.current = null;
    }

    setIsTranslating(message.is_translating || false);

    if (message.translated_text !== undefined) {
      setTranslatedText(message.translated_text || "");
    }
  }, [isEnglishMode]);

  const handleSessionRestored = useCallback((message) => {
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
  }, [isEnglishMode]);

  const handleTranslationStarted = useCallback(() => {
    setIsTranslating(true);
    translationStartTimeRef.current = Date.now();
    setTranslationDurationMs(0);
  }, []);

  const handleTranslationComplete = useCallback((message) => {
    if (message.translated_text !== undefined) {
      setTranslatedText(message.translated_text || "");
    }
    setIsTranslating(false);
    if (translationStartTimeRef.current) {
      setTranslationDurationMs(Date.now() - translationStartTimeRef.current);
      translationStartTimeRef.current = null;
    }
  }, []);

  const handleStatusMessage = useCallback((message) => {
    if (message.stream === "fast") {
      setFastStatus(message.status);
    } else if (message.stream === "slow") {
      setSlowStatus(message.status);
    }
  }, []);

  const resetState = useCallback(() => {
    setConfirmedText("");
    setPartialText("");
    setTranslatedText("");
    setActiveEnglishText("");
    setIsTranslating(false);
    setTranslationDurationMs(0);
    setFastStatus("connecting");
    setSlowStatus("connecting");
    translationStartTimeRef.current = null;
    highestSequenceRef.current = -1;
  }, []);

  return {
    // State
    confirmedText,
    partialText,
    activeEnglishText,
    translatedText,
    isTranslating,
    translationDurationMs,
    fastStatus,
    slowStatus,

    // Setters (exposed for external control)
    setConfirmedText,
    setPartialText,
    setActiveEnglishText,
    setTranslatedText,

    // Handlers
    handleTranscriptMessage,
    handleSessionRestored,
    handleTranslationStarted,
    handleTranslationComplete,
    handleStatusMessage,
    resetState,
  };
};

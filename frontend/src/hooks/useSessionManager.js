import { useCallback, useRef } from "react";

const SESSION_STORAGE_KEY = "transcription_session_id";

/**
 * Manages session ID persistence in localStorage
 */
export const useSessionManager = () => {
  const sessionIdRef = useRef(null);

  const getOrCreateSessionId = useCallback(() => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    sessionIdRef.current = sessionId;
    return sessionId;
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionIdRef.current = null;
  }, []);

  const hasExistingSession = useCallback(() => {
    return !!localStorage.getItem(SESSION_STORAGE_KEY);
  }, []);

  return {
    getOrCreateSessionId,
    clearSession,
    hasExistingSession,
  };
};

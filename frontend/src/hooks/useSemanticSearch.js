import { useCallback, useState } from "react";
import { fetchSessionDetail, fetchSessions, searchTranscripts } from "../services/api";

export const useSemanticSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRecentSessions, setIsLoadingRecentSessions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasLoadedRecentSessions, setHasLoadedRecentSessions] = useState(false);

  const loadSession = useCallback(async (sessionId, segmentId = null) => {
    if (!sessionId) {
      return;
    }

    setIsLoadingSession(true);
    setError("");
    setSelectedSegmentId(segmentId);

    try {
      const session = await fetchSessionDetail(sessionId);
      setSelectedSession(session);
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  const runSearch = useCallback(async (incomingQuery) => {
    const normalizedQuery = (incomingQuery ?? query).trim();
    setQuery(normalizedQuery);

    if (!normalizedQuery) {
      setHasSearched(false);
      setResults([]);
      setSelectedSession(null);
      setSelectedSegmentId(null);
      setError("Enter a search query to explore stored sessions.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError("");

    try {
      const nextResults = await searchTranscripts(normalizedQuery);
      setResults(nextResults);

      if (nextResults.length > 0) {
        const firstResult = nextResults[0];
        await loadSession(firstResult.session_id, firstResult.segment_id);
      } else {
        setSelectedSession(null);
        setSelectedSegmentId(null);
      }
    } catch (searchError) {
      setResults([]);
      setSelectedSession(null);
      setSelectedSegmentId(null);
      setError(searchError.message);
    } finally {
      setIsSearching(false);
    }
  }, [loadSession, query]);

  const loadRecentSessions = useCallback(async () => {
    setIsLoadingRecentSessions(true);
    setError("");

    try {
      const sessions = await fetchSessions();
      setRecentSessions(sessions);
      setHasLoadedRecentSessions(true);
    } catch (sessionsError) {
      setRecentSessions([]);
      setHasLoadedRecentSessions(true);
      setError(sessionsError.message);
    } finally {
      setIsLoadingRecentSessions(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelectedSession(null);
    setSelectedSegmentId(null);
    setHasSearched(false);
  }, []);

  const clearSession = useCallback(() => {
    setSelectedSession(null);
    setSelectedSegmentId(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    recentSessions,
    selectedSession,
    selectedSegmentId,
    error,
    isSearching,
    isLoadingSession,
    isLoadingRecentSessions,
    hasSearched,
    hasLoadedRecentSessions,
    runSearch,
    loadSession,
    loadRecentSessions,
    clearSearch,
    clearSession,
  };
};

import { useEffect, useRef, useState, useCallback } from "react";
import { FaArrowLeft } from "react-icons/fa6";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { useSemanticSearch } from "./hooks/useSemanticSearch";
import { SearchInput } from "./components/SearchInput";
import { SearchOptions } from "./components/SearchOptions";
import { SearchResults } from "./components/SearchResults";
import { SemanticSearchPanel } from "./components/SemanticSearchPanel";
import { SearchResultList } from "./components/SearchResultList";
import { SessionDetailPanel } from "./components/SessionDetailPanel";
import { RecentSessionsPanel } from "./components/RecentSessionsPanel";

const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

function App() {
  const [language, setLanguage] = useState(languageOptions[0]);
  const autoSearchArmedRef = useRef(false);

  const {
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
    autoSearchCandidate,
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText,
  } = useAudioRecording(language);

  const {
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
  } = useSemanticSearch();

  useEffect(() => {
    if (!query.trim() && !hasSearched && !hasLoadedRecentSessions) {
      loadRecentSessions();
    }
  }, [hasLoadedRecentSessions, hasSearched, loadRecentSessions, query]);

  useEffect(() => {
    if (!autoSearchArmedRef.current || isRecording || isTranslating) {
      return;
    }

    if (autoSearchCandidate) {
      runSearch(autoSearchCandidate);
      autoSearchArmedRef.current = false;
      return;
    }

    if (connectionStatus === "disconnected" || connectionStatus === "error") {
      autoSearchArmedRef.current = false;
    }
  }, [
    autoSearchCandidate,
    connectionStatus,
    isRecording,
    isTranslating,
    runSearch,
  ]);

  const handleClearRecording = useCallback(() => {
    setConfirmedText("");
    setPartialText("");
    setTranslatedText("");
    autoSearchArmedRef.current = false;
  }, [setConfirmedText, setPartialText, setTranslatedText]);

  const handleStopRecording = useCallback(() => {
    autoSearchArmedRef.current = true;
    stopRecording();
  }, [stopRecording]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-blue-200 selection:text-blue-900">
      
      {/* Sidebar (Search & History) */}
      <aside className="w-[340px] xl:w-[400px] flex-shrink-0 border-r border-gray-200/60 bg-white/60 backdrop-blur-xl flex flex-col h-full shadow-[1px_0_20px_rgba(0,0,0,0.02)] z-10 relative">
        <div className="px-6 pt-8 pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-semibold tracking-tight">Voice Intel</h1>
          <p className="mt-1 text-xs text-slate-400 uppercase tracking-wider font-medium">Archive & Search</p>
        </div>
        
        <div className="p-4 border-b border-gray-100 bg-white/40">
          <SemanticSearchPanel
            query={query}
            onQueryChange={setQuery}
            onSubmit={runSearch}
            onClear={clearSearch}
            isSearching={isSearching}
            error={error}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {hasSearched ? (
            <SearchResultList
              query={query}
              results={results}
              isSearching={isSearching}
              selectedSessionId={selectedSession?.id ?? null}
              selectedSegmentId={selectedSegmentId}
              onSelect={loadSession}
            />
          ) : (
            <RecentSessionsPanel
              sessions={recentSessions}
              isLoading={isLoadingRecentSessions}
              onSelect={loadSession}
            />
          )}
        </div>
      </aside>

      {/* Main Content (Recording or Session Detail) */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#f5f5f7]/50">
        <div className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 lg:py-16">
          <div className="mx-auto max-w-3xl">
            {selectedSession ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button 
                  onClick={clearSession}
                  className="mb-8 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <FaArrowLeft className="text-xs" /> Back to Recording
                </button>
                <SessionDetailPanel
                  session={selectedSession}
                  selectedSegmentId={selectedSegmentId}
                  isLoading={isLoadingSession}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in duration-500">
                <div className="text-center mb-12">
                  <h2 className="text-4xl lg:text-5xl font-semibold tracking-tight text-slate-900 mb-4">What's on your mind?</h2>
                  <p className="text-slate-500 text-lg max-w-xl mx-auto">Capture speech, translate it in real-time, and store it securely for semantic search.</p>
                </div>
                
                <div className="w-full max-w-2xl relative">
                  <SearchInput
                    isRecording={isRecording}
                    confirmedText={confirmedText}
                    partialText={partialText}
                    translatedText={translatedText}
                    isTranslating={isTranslating}
                    language={language}
                    connectionStatus={connectionStatus}
                    audioLevel={audioLevel}
                    duration={duration}
                    onStartRecording={startRecording}
                    onStopRecording={handleStopRecording}
                    onClear={handleClearRecording}
                    searchQuery={query}
                    onSearchQueryChange={setQuery}
                    onSearchSubmit={runSearch}
                  />

                  <div className="mt-6 flex justify-center">
                    <SearchOptions
                      language={language}
                      onLanguageChange={setLanguage}
                      isRecording={isRecording}
                      fastStatus={fastStatus}
                      slowStatus={slowStatus}
                      connectionStatus={connectionStatus}
                    />
                  </div>

                  <SearchResults
                    confirmedText={confirmedText}
                    translatedText={translatedText}
                    language={language}
                    isRecording={isRecording}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

import { useState, useCallback } from "react";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { SearchInput } from "./components/SearchInput";
import { SearchOptions } from "./components/SearchOptions";

const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

function App() {
  const [language, setLanguage] = useState(languageOptions[0]);

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
    activeEnglishText,
    isSilent,
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText,
    setActiveEnglishText,
  } = useAudioRecording(language);

  const handleClearRecording = useCallback(() => {
    setConfirmedText("");
    setPartialText("");
    setTranslatedText("");
    setActiveEnglishText("");
  }, [setConfirmedText, setPartialText, setTranslatedText, setActiveEnglishText]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f5f7] text-[#1d1d1f] font-sans selection:bg-blue-200 selection:text-blue-900 justify-center items-center">
      <main className="w-full max-w-4xl px-6 py-10 lg:px-12 lg:py-16 flex flex-col justify-center items-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-semibold tracking-tight text-slate-900 mb-4">Voice Intel</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Capture speech, translate it in real-time, and view the transcription upfront.</p>
        </div>
        
        <div className="w-full max-w-2xl relative">
          <SearchInput
            isRecording={isRecording}
            confirmedText={confirmedText}
            partialText={partialText}
            activeEnglishText={activeEnglishText}
            translatedText={translatedText}
            isTranslating={isTranslating}
            isSilent={isSilent}
            language={language}
            connectionStatus={connectionStatus}
            audioLevel={audioLevel}
            duration={duration}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onClear={handleClearRecording}
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
        </div>
      </main>
    </div>
  );
}

export default App;
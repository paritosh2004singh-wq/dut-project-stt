// App.jsx
import { useState } from "react";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { SearchInput } from "./components/SearchInput";
import { SearchOptions } from "./components/SearchOptions";
import { SearchResults } from "./components/SearchResults";

const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

function App() {
  const [language, setLanguage] = useState(languageOptions[0]);
  const [isSearchFocused] = useState(false);
  
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
    startRecording,
    stopRecording,
    setConfirmedText,
    setPartialText,
    setTranslatedText
  } = useAudioRecording(language);

  const handleClear = () => {
    setConfirmedText("");
    setPartialText("");
    setTranslatedText("");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-20 px-4 font-sans">
      <div className="mb-8">
        <h1 className="text-4xl font-light text-gray-800 tracking-tight">
          <span className="font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Voice
          </span>
          <span className="text-gray-500 font-light ml-1">Search</span>
        </h1>
      </div>

      <div className={`w-full max-w-2xl transition-all duration-300 ${isSearchFocused ? 'scale-105' : ''}`}>
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
          fastStatus={fastStatus}
          slowStatus={slowStatus}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onClear={handleClear}
        />

        <SearchOptions
          language={language}
          onLanguageChange={setLanguage}
          isRecording={isRecording}
          fastStatus={fastStatus}
          slowStatus={slowStatus}
          connectionStatus={connectionStatus}
        />

        <SearchResults
          confirmedText={confirmedText}
          translatedText={translatedText}
          language={language}
          isRecording={isRecording}
        />
      </div>

      <div className="mt-auto py-6 text-center text-sm text-gray-400">
        <p>Voice Search — Speak in English, translate to {language.value}</p>
      </div>
    </div>
  );
}

export default App;
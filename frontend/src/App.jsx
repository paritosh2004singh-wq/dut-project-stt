import { BrandHeader } from "./components/BrandHeader";
import { SearchResultsPanel } from "./components/SearchResultsPanel";
import { SessionBar } from "./components/SessionBar";
import { TranscriptComposer } from "./components/TranscriptComposer";
import { VoiceSearchFooter } from "./components/VoiceSearchFooter";
import { useVoiceTranscriptionSession } from "./hooks/useVoiceTranscriptionSession";

function App() {
  const session = useVoiceTranscriptionSession();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-20 px-4 font-sans">
      <BrandHeader />

      <div className="w-full max-w-2xl transition-all duration-300">
        <TranscriptComposer
          audioLevel={session.audioLevel}
          confirmedText={session.confirmedText}
          connectionStatus={session.connectionStatus}
          duration={session.duration}
          isRecording={session.isRecording}
          isTranslating={session.isTranslating}
          language={session.language}
          onClearTranscript={session.clearTranscript}
          onStartRecording={session.startRecording}
          onStopRecording={session.stopRecording}
          partialText={session.partialText}
          translatedText={session.translatedText}
        />

        <SessionBar
          connectionStatus={session.connectionStatus}
          fastStatus={session.fastStatus}
          isRecording={session.isRecording}
          language={session.language}
          onLanguageChange={session.setLanguage}
          slowStatus={session.slowStatus}
        />

        <SearchResultsPanel
          confirmedText={session.confirmedText}
          isRecording={session.isRecording}
          language={session.language}
          translatedText={session.translatedText}
        />
      </div>

      <VoiceSearchFooter language={session.language} />
    </div>
  );
}

export default App;

import { memo, useRef, useEffect, useState } from "react";
import { FaMicrophone, FaSearch, FaTimes, FaCopy, FaCheck } from "react-icons/fa";
import { RecordingControls } from "./RecordingControls";
import { AudioLevelIndicator } from "./AudioLevelIndicator";
import { formatDuration } from "../utils/formatting";
import { FaCircle } from "react-icons/fa";

export const SearchInput = memo(({
  isRecording,
  confirmedText,
  partialText,
  activeEnglishText,
  translatedText,
  isTranslating,
  translationDurationMs,
  isSilent,
  language,
  audioLevel,
  duration,
  onStartRecording,
  onStopRecording,
  onClear
}) => {
  const selectedLanguage = language?.value?.trim() || "English";
  const hasTranscription = selectedLanguage === "English"
    ? Boolean(translatedText)
    : Boolean(confirmedText || partialText || translatedText);
  const showTranscriptionArea = hasTranscription || (selectedLanguage === "English" && isTranslating);
  const showSourceTranscript = selectedLanguage !== "English";
  const scrollContainerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = translatedText || confirmedText || partialText || activeEnglishText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Combine active English segment and partial text for transient feedback
  const parenthesizedText = [activeEnglishText?.trim(), partialText?.trim()].filter(Boolean).join(" ");

  // Auto-scroll to bottom of the transcription box when text updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isCloseToBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 100;
      if (isRecording || isCloseToBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [confirmedText, partialText, translatedText, isRecording]);

  return (
    <div className={`bg-white rounded-[2.5rem] p-6 lg:p-8 transition-all duration-500 ease-out ${
      isRecording 
        ? 'shadow-[0_8px_30px_rgba(59,130,246,0.12)] border border-blue-100 ring-4 ring-blue-50/50' 
        : 'shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
    }`}>
      <div className="flex flex-col min-h-[120px]">
        
        {/* Main Text Area */}
        <div className="flex items-start gap-4 mb-6 flex-1">
          <div className={`mt-2 p-3 rounded-full transition-colors ${isRecording ? 'bg-blue-50 text-blue-500' : 'bg-[#f5f5f7] text-slate-400'}`}>
            {isRecording ? (
              <FaMicrophone className="animate-pulse text-xl" />
            ) : (
              <FaSearch className="text-xl" />
            )}
          </div>
          
          <div 
            ref={scrollContainerRef}
            className="flex-1 mt-1 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth"
          >
            {!isRecording && !showTranscriptionArea ? (
              <div className="text-slate-350 text-2xl font-light tracking-tight mt-1 select-none">
                Click the microphone to speak and translate to {selectedLanguage}...
              </div>
            ) : (
              <div className="text-2xl leading-relaxed tracking-tight">
                {translatedText && (
                  <span className="text-[#1d1d1f] font-medium">{translatedText}</span>
                )}
                {showSourceTranscript && isRecording && parenthesizedText && (
                  <span className="text-slate-400 font-light ml-2">
                    ({parenthesizedText})
                  </span>
                )}
                {!translatedText && !parenthesizedText && (
                  <span className="text-slate-400 font-light">
                    {isTranslating ? "Translating..." : "Listening..."}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasTranscription && !isRecording && (
            <div className="flex items-center gap-2 mt-2 self-start">
              <button 
                onClick={handleCopy}
                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-slate-500 rounded-full transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <FaCheck className="text-green-500" /> : <FaCopy />}
              </button>
              <button 
                onClick={onClear}
                className="p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-slate-500 rounded-full transition-colors"
                title="Clear"
              >
                <FaTimes />
              </button>
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-500 rounded-full">
                <FaCircle className="text-[8px] animate-pulse" />
                <span className="text-sm font-semibold tracking-wider font-mono">
                  {formatDuration(duration)}
                </span>
              </div>
            )}

            {/* Translation Duration Pill */}
            {(isTranslating || (translationDurationMs > 0 && translatedText)) && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                {isTranslating ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                ) : null}
                <span className="text-xs font-medium tracking-wide font-mono">
                  {isTranslating ? "Translating:" : "Translation took"} {(translationDurationMs / 1000).toFixed(1)}s
                </span>
              </div>
            )}

            {isRecording && isSilent && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full animate-pulse">
                <span className="text-xs font-medium tracking-wide">Silence detected — stopping…</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <RecordingControls 
              isRecording={isRecording}
              onStart={onStartRecording}
              onStop={onStopRecording}
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AudioLevelIndicator audioLevel={audioLevel} isRecording={isRecording} />
      </div>
    </div>
  );
});

SearchInput.displayName = "SearchInput";

import { memo, useRef, useEffect } from "react";
import { FaMicrophone, FaSearch, FaTimes } from "react-icons/fa";
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
  isSilent,
  language,
  audioLevel,
  duration,
  onStartRecording,
  onStopRecording,
  onClear
}) => {
  const hasTranscription = confirmedText || partialText || translatedText;
  const selectedLanguage = language?.value?.trim() || "English";
  const translateToEnglish = !language || language?.value?.trim() !== "English";
  const scrollContainerRef = useRef(null);

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
            {!isRecording && !hasTranscription ? (
              <div className="text-slate-350 text-2xl font-light tracking-tight mt-1 select-none">
                {translateToEnglish
                  ? `Click the microphone to speak and translate to ${selectedLanguage}...`
                  : "Click the microphone to start speaking..."}
              </div>
            ) : translateToEnglish ? (
              <div className="text-2xl leading-relaxed tracking-tight">
                {translatedText && (
                  <span className="text-[#1d1d1f] font-medium">{translatedText}</span>
                )}
                {isRecording && parenthesizedText && (
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
            ) : (
              <div className="text-2xl leading-relaxed tracking-tight">
                <span className="text-[#1d1d1f] font-medium">{confirmedText}</span>
                <span className="text-slate-400 font-light ml-2">{partialText}</span>
              </div>
            )}
          </div>

          {hasTranscription && !isRecording && (
            <button 
              onClick={onClear}
              className="mt-2 p-2 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-slate-500 rounded-full transition-colors"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Footer Area */}
        <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {isRecording && (
              <>
                <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-500 rounded-full">
                  <FaCircle className="text-[8px] animate-pulse" />
                  <span className="text-sm font-semibold tracking-wider font-mono">
                    {formatDuration(duration)}
                  </span>
                </div>
                {isSilent && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full animate-pulse">
                    <span className="text-xs font-medium tracking-wide">Silence detected — stopping…</span>
                  </div>
                )}
              </>
            )}
          </div>

          <RecordingControls 
            isRecording={isRecording}
            onStart={onStartRecording}
            onStop={onStopRecording}
          />
        </div>
      </div>

      <div className="mt-6">
        <AudioLevelIndicator audioLevel={audioLevel} isRecording={isRecording} />
      </div>
    </div>
  );
});

SearchInput.displayName = "SearchInput";

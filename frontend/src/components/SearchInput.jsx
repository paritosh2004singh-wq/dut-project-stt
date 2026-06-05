import { memo } from "react";
import { FaMicrophone, FaSearch, FaTimes, FaLanguage } from "react-icons/fa";
import { RecordingControls } from "./RecordingControls";
import { AudioLevelIndicator } from "./AudioLevelIndicator";
import { formatDuration } from "../utils/formatting";
import { FaCircle } from "react-icons/fa";

export const SearchInput = memo(({
  isRecording,
  confirmedText,
  partialText,
  translatedText,
  isTranslating,
  language,
  connectionStatus,
  audioLevel,
  duration,
  onStartRecording,
  onStopRecording,
  onClear,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery?.trim()) {
      onSearchSubmit(searchQuery);
    }
  };

  const hasTranscription = confirmedText || partialText || translatedText;

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
          
          <div className="flex-1 mt-1">
            {!isRecording && !hasTranscription ? (
              <input
                type="text"
                value={searchQuery || ""}
                onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language.value === "English" 
                  ? "Type to search or start speaking..." 
                  : `Type to search or speak to translate to ${language.value}...`}
                className="w-full bg-transparent text-slate-600 text-2xl font-light tracking-tight mt-1 outline-none placeholder:text-slate-300 focus:text-[#1d1d1f]"
              />
            ) : (
              <div className="text-2xl leading-relaxed tracking-tight">
                {language.value === "English" ? (
                  <>
                    <span className="text-[#1d1d1f] font-medium">{confirmedText}</span>
                    <span className="text-slate-400 font-light ml-2">{partialText}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#1d1d1f] font-medium">
                      {translatedText ? translatedText : (isTranslating ? "Translating..." : "Listening...")}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {(hasTranscription || searchQuery) && !isRecording && (
            <button 
              onClick={() => {
                if (onClear) onClear();
                if (onSearchQueryChange) onSearchQueryChange("");
              }}
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

// components/SearchInput.jsx
import { FaMicrophone, FaSearch, FaTimes, FaLanguage } from "react-icons/fa";
import { RecordingControls } from "./RecordingControls";
import { AudioLevelIndicator } from "./AudioLevelIndicator";
import { StatusIndicator } from "./StatusIndicator";
import { formatDuration } from "../utils/formatting";
import { FaCircle } from "react-icons/fa";

export const SearchInput = ({
  isRecording,
  confirmedText,
  partialText,
  translatedText,
  isTranslating,
  language,
  connectionStatus,
  audioLevel,
  duration,
  fastStatus,
  slowStatus,
  onStartRecording,
  onStopRecording,
  onClear
}) => {
  return (
    <div className={`bg-white rounded-2xl shadow-lg border transition-all duration-300 ${
      isRecording ? 'border-red-300 shadow-red-100' : 'border-gray-200 hover:shadow-xl'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="text-gray-400 mt-1">
            {isRecording ? (
              <FaMicrophone className="text-red-500 animate-pulse text-lg" />
            ) : (
              <FaSearch className="text-lg" />
            )}
          </div>
          
          <div className="flex-1 min-h-6">
            {!isRecording && !confirmedText && !partialText ? (
              <span className="text-gray-400 text-lg">
                {language.value === "English" 
                  ? "Search or type a query..." 
                  : `Speak in English, translate to ${language.value}...`}
              </span>
            ) : (
              <div className="text-lg leading-relaxed">
                <span className="text-gray-800 font-medium">{confirmedText}</span>
                <span className="text-blue-500 italic ml-1">{partialText}</span>
              </div>
            )}
          </div>

          {(confirmedText || translatedText) && !isRecording && (
            <button 
              onClick={onClear}
              className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {language.value !== "English" && (translatedText || isTranslating || confirmedText) && (
          <div className="flex items-start gap-3 pl-8 border-l-2 border-purple-200 ml-3">
            <FaLanguage className="text-purple-400 mt-1 text-sm" />
            <div className="flex-1">
              {translatedText && (
                <p className={`text-purple-700 font-medium text-base ${isTranslating ? 'opacity-50' : ''}`}>
                  {translatedText}
                </p>
              )}
              {isTranslating && (
                <p className="text-gray-400 italic text-sm animate-pulse mt-1">
                  Translating...
                </p>
              )}
              {!isTranslating && !translatedText && confirmedText && (
                <p className="text-gray-400 italic text-sm mt-1">
                  {connectionStatus === "disconnected" ? "Translation unavailable." : "Waiting for pause to translate..."}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Translated to {language.value}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {isRecording && (
              <>
                <FaCircle className="text-red-500 text-[8px] animate-pulse" />
                <span className="text-sm text-gray-500 font-mono">
                  {formatDuration(duration)}
                </span>
              </>
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

      <AudioLevelIndicator audioLevel={audioLevel} isRecording={isRecording} />
    </div>
  );
};
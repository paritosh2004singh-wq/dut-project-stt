import {
  FaCircle,
  FaLanguage,
  FaMicrophone,
  FaSearch,
  FaStop,
  FaTimes,
  FaVolumeUp,
} from "react-icons/fa";

import { formatDuration } from "../utils/formatDuration";

export function TranscriptComposer({
  audioLevel,
  confirmedText,
  connectionStatus,
  duration,
  isRecording,
  isTranslating,
  language,
  onClearTranscript,
  onStartRecording,
  onStopRecording,
  partialText,
  translatedText,
}) {
  const showPlaceholder = !isRecording && !confirmedText && !partialText;
  const showTranslation = language.value !== "English" && (translatedText || isTranslating || confirmedText);
  const showClearButton = (confirmedText || translatedText) && !isRecording;

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border transition-all duration-300 ${
        isRecording ? "border-red-300 shadow-red-100" : "border-gray-200 hover:shadow-xl"
      }`}
    >
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
            {showPlaceholder ? (
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

          {showClearButton && (
            <button
              onClick={onClearTranscript}
              className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {showTranslation ? (
          <div className="flex items-start gap-3 pl-8 border-l-2 border-purple-200 ml-3">
            <FaLanguage className="text-purple-400 mt-1 text-sm" />
            <div className="flex-1">
              {translatedText && (
                <p className={`text-purple-700 font-medium text-base ${isTranslating ? "opacity-50" : ""}`}>
                  {translatedText}
                </p>
              )}
              {isTranslating && (
                <p className="text-gray-400 italic text-sm animate-pulse mt-1">Translating...</p>
              )}
              {!isTranslating && !translatedText && confirmedText ? (
                <p className="text-gray-400 italic text-sm mt-1">
                  {connectionStatus === "disconnected"
                    ? "Translation unavailable."
                    : "Waiting for pause to translate..."}
                </p>
              ) : null}
              <p className="text-xs text-gray-400 mt-1">Translated to {language.value}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {isRecording && (
              <>
                <FaCircle className="text-red-500 text-[8px] animate-pulse" />
                <span className="text-sm text-gray-500 font-mono">{formatDuration(duration)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isRecording ? (
              <button
                onClick={onStartRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
                title="Voice Search"
              >
                <FaMicrophone className="text-sm" />
                <span className="text-sm font-medium">Search with voice</span>
              </button>
            ) : (
              <button
                onClick={onStopRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
                title="Stop Recording"
              >
                <FaStop className="text-sm" />
                <span className="text-sm font-medium">Stop</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isRecording && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <FaVolumeUp className="text-gray-400 text-xs" />
            <span className="text-xs text-gray-400">Audio Level</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 transition-all duration-100 rounded-full"
              style={{ width: `${Math.min((audioLevel / 128) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

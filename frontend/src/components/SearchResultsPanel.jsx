import { FaSearch } from "react-icons/fa";

export function SearchResultsPanel({ confirmedText, isRecording, language, translatedText }) {
  if (isRecording || (!confirmedText && !translatedText)) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      {confirmedText && language.value !== "English" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">ORIGINAL (ENGLISH)</h3>
          <p className="text-gray-800 text-lg">{confirmedText}</p>
        </div>
      )}

      {translatedText && (
        <div className="bg-linear-to-r from-purple-50 to-blue-50 rounded-2xl shadow-sm border border-purple-100 p-6">
          <h3 className="text-sm font-medium text-purple-400 mb-2">
            TRANSLATED TO {language.value.toUpperCase()}
          </h3>
          <p className="text-purple-900 text-lg font-medium">{translatedText}</p>
        </div>
      )}

      {confirmedText && language.value === "English" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">SEARCH RESULT</h3>
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <FaSearch className="text-gray-300 mt-1 flex-shrink-0" />
            <div>
              <p className="text-gray-800 font-medium">{confirmedText}</p>
              <p className="text-sm text-gray-400 mt-1">Search result description would appear here...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

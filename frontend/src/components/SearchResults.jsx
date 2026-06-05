import { memo } from "react";

export const SearchResults = memo(({ confirmedText, translatedText, language, isRecording }) => {
  if (!confirmedText && !translatedText) return null;
  if (isRecording) return null;

  return (
    <div className="mt-8 space-y-4 animate-in fade-in duration-300">
      {language.value === "English" && confirmedText && (
        <div className="bg-white rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.04)] border border-slate-100 p-8">
          <h3 className="text-xs font-semibold tracking-wider text-slate-400 mb-3 uppercase">
            Transcript
          </h3>
          <p className="text-[#1d1d1f] text-xl leading-relaxed">{confirmedText}</p>
        </div>
      )}
      
      {language.value !== "English" && translatedText && (
        <div className="bg-[#f0f4ff] rounded-3xl border border-blue-100 p-8">
          <h3 className="text-xs font-semibold tracking-wider text-blue-500 mb-3 uppercase">
            Translated to {language.value}
          </h3>
          <p className="text-blue-900 text-xl font-medium leading-relaxed">{translatedText}</p>
        </div>
      )}
    </div>
  );
});

SearchResults.displayName = "SearchResults";

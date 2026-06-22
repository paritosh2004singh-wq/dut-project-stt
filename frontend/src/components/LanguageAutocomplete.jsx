import { useState, useMemo, useRef, useEffect } from "react";
import ISO6391 from "iso-639-1";

export const LanguageAutocomplete = ({ value, onChange, isDisabled, placeholder }) => {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Initialize full language list once
  const allLanguages = useMemo(() => {
    const names = ISO6391.getAllNames();
    return names.sort().map((name) => ({
      value: name,
      label: name,
    }));
  }, []);

  // Filter languages based on input
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) {
      return [];
    }
    const searchTerm = inputValue.toLowerCase();
    const filtered = allLanguages.filter((lang) =>
      lang.label.toLowerCase().includes(searchTerm)
    );
    return filtered.slice(0, 15); // Limit to 15 suggestions
  }, [allLanguages, inputValue]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setInputValue(value?.label || "");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Sync input value with external value changes
  useEffect(() => {
    if (value) {
      setInputValue(value.label);
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(newValue.trim().length > 0);
    setHighlightedIndex(0);
  };

  const handleSelectLanguage = (language) => {
    onChange(language);
    setInputValue(language.label);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelectLanguage(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setInputValue(value?.label || "");
        break;
    }
  };

  const handleFocus = () => {
    if (inputValue.trim().length > 0) {
      setIsOpen(true);
    }
  };

  const handleClear = () => {
    onChange(null);
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={placeholder}
          className="w-full min-w-[140px] bg-[#f5f5f7] text-[#1d1d1f] font-semibold text-sm px-3 py-2 rounded-2xl border-none outline-none cursor-pointer transition-all duration-200 hover:bg-[#e8e8ed] focus:bg-white focus:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {inputValue && !isDisabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 right-0 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden z-50"
        >
          <div className="max-h-[240px] overflow-y-auto py-1">
            {suggestions.length > 0 ? (
              suggestions.map((lang, index) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => handleSelectLanguage(lang)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                    index === highlightedIndex
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {lang.label}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

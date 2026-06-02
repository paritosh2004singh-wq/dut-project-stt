import Select from "react-select";

import { languageOptions } from "../constants/voiceSearch";

const languageSelectStyles = {
  control: (base, state) => ({
    ...base,
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: "0.75rem",
    minHeight: "36px",
    boxShadow: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
    "&:hover": {
      borderColor: "#e5e7eb",
      background: "#f9fafb",
    },
    ...(state.isFocused && {
      borderColor: "#3b82f6",
      background: "#f9fafb",
    }),
  }),
  singleValue: (base) => ({
    ...base,
    color: "#374151",
    fontWeight: "500",
  }),
  menu: (base) => ({
    ...base,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "0.75rem",
    overflow: "hidden",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    marginTop: "4px",
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? "#f3f4f6" : "transparent",
    color: "#374151",
    cursor: "pointer",
    fontSize: "0.875rem",
    padding: "8px 12px",
    "&:hover": {
      background: "#f3f4f6",
    },
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#9ca3af",
    padding: "4px",
  }),
  indicatorSeparator: () => ({ display: "none" }),
  placeholder: (base) => ({
    ...base,
    color: "#9ca3af",
    fontSize: "0.875rem",
  }),
};

export function LanguageSelector({ isDisabled, value, onChange }) {
  return (
    <div className="relative z-50 min-w-35">
      <Select
        options={languageOptions}
        value={value}
        onChange={onChange}
        isDisabled={isDisabled}
        placeholder="Language"
        styles={languageSelectStyles}
      />
    </div>
  );
}

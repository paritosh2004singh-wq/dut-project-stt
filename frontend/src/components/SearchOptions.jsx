import { memo } from "react";
import Select from "react-select";
import { StatusIndicator } from "./StatusIndicator";
import { getStatusColor } from "../utils/formatting";

const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

const selectStyles = {
  control: (base) => ({
    ...base,
    background: '#f5f5f7',
    border: 'none',
    borderRadius: '1rem',
    minHeight: '40px',
    boxShadow: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0 8px',
    transition: 'all 0.2s',
    '&:hover': {
      background: '#e8e8ed'
    },
  }),
  singleValue: (base) => ({ 
    ...base, 
    color: '#1d1d1f',
    fontWeight: '600'
  }),
  menu: (base) => ({
    ...base,
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(16px)',
    border: '1px solid #e5e7eb',
    borderRadius: '1rem',
    overflow: 'hidden',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
    marginBottom: '8px'
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '4px 0',
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? '#f5f5f7' : 'transparent',
    color: '#1d1d1f',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    padding: '10px 16px',
    transition: 'background 0.2s',
  }),
  dropdownIndicator: (base) => ({ 
    ...base, 
    color: '#86868b',
    padding: '4px'
  }),
  indicatorSeparator: () => ({ display: 'none' }),
};

export const SearchOptions = memo(({
  language,
  onLanguageChange,
  isRecording,
  fastStatus,
  slowStatus,
  connectionStatus
}) => {
  return (
    <div className="flex items-center gap-6 bg-white rounded-full px-6 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
      <div className="flex items-center gap-4">
        <div className="relative z-50 min-w-[140px]">
          <Select
            options={languageOptions}
            value={language}
            onChange={onLanguageChange}
            isClearable
            isDisabled={isRecording}
            placeholder="Language"
            styles={selectStyles}
            isSearchable={false}
            menuPlacement="top"
          />
        </div>

        {isRecording && (
          <div className="flex items-center gap-4 pl-4 border-l border-slate-100">
            <StatusIndicator status={fastStatus} label="Fast" />
            <StatusIndicator status={slowStatus} label="Slow" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(connectionStatus)} ${
          connectionStatus === "connecting" ? "animate-pulse" : ""
        }`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{connectionStatus}</span>
      </div>
    </div>
  );
});

SearchOptions.displayName = "SearchOptions";

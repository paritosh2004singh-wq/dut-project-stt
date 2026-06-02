// components/SearchOptions.jsx
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
  control: (base, state) => ({
    ...base,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '0.75rem',
    minHeight: '36px',
    boxShadow: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    '&:hover': {
      borderColor: '#e5e7eb',
      background: '#f9fafb'
    },
    ...(state.isFocused && {
      borderColor: '#3b82f6',
      background: '#f9fafb'
    })
  }),
  singleValue: (base) => ({ 
    ...base, 
    color: '#374151',
    fontWeight: '500'
  }),
  menu: (base) => ({
    ...base,
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    marginTop: '4px'
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? '#f3f4f6' : 'transparent',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '8px 12px',
    '&:hover': {
      background: '#f3f4f6'
    }
  }),
  dropdownIndicator: (base) => ({ 
    ...base, 
    color: '#9ca3af',
    padding: '4px'
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: '0.875rem'
  })
};

export const SearchOptions = ({
  language,
  onLanguageChange,
  isRecording,
  fastStatus,
  slowStatus,
  connectionStatus
}) => {
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <div className="flex items-center gap-4">
        <div className="relative z-50 min-w-35">
          <Select
            options={languageOptions}
            value={language}
            onChange={onLanguageChange}
            isDisabled={isRecording}
            placeholder="Language"
            styles={selectStyles}
          />
        </div>

        {isRecording && (
          <div className="flex items-center gap-3">
            <StatusIndicator status={fastStatus} label="Fast" />
            <StatusIndicator status={slowStatus} label="Slow" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionStatus)} ${
          connectionStatus === "connecting" ? "animate-pulse" : ""
        }`} />
        <span className="text-xs text-gray-400 capitalize">{connectionStatus}</span>
      </div>
    </div>
  );
};
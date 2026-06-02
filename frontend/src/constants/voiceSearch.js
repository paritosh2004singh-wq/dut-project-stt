export const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

export const defaultLanguage = languageOptions[0];

export const transcriptionConfig = {
  sample_rate: 16000,
  fast_delay_ms: 240,
  slow_delay_ms: 2400,
  chunk_duration_ms: 10,
};

export const transcriptionWebSocketUrl = "ws://localhost:8000/ws/transcribe";

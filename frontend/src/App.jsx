import { useEffect, useState, useRef } from "react";
import { FaMicrophone, FaCircle, FaStop, FaVolumeUp, FaSearch, FaTimes, FaLanguage } from "react-icons/fa";
import Select from "react-select";

const languageOptions = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "Hindi" },
  { value: "Kannada", label: "Kannada" },
  { value: "Marathi", label: "Marathi" },
];

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [confirmedText, setConfirmedText] = useState("");
  const [partialText, setPartialText] = useState("");
  const [fastStatus, setFastStatus] = useState("connecting");
  const [slowStatus, setSlowStatus] = useState("connecting");
  const [language, setLanguage] = useState(languageOptions[0]);
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSearchFocused] = useState(false);
  
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const analyserRef = useRef(null);

  const updateAudioLevel = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  // Duration timer
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Convert Float32Array to Int16Array (PCM)
  const floatTo16BitPCM = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Clear previous transcripts
      setConfirmedText("");
      setPartialText("");
      setTranslatedText("");
      setIsTranslating(false);

      const socket = new WebSocket("ws://localhost:8000/ws/transcribe");
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection opened.");
        setConnectionStatus("connected");
        
        // Send config message
        const config = {
          type: "config",
          sample_rate: 16000,
          fast_delay_ms: 240,
          slow_delay_ms: 2400,
          chunk_duration_ms: 10,
          target_language: language.value
        };
        socket.send(JSON.stringify(config));
        console.log("Config sent:", config);
        
        navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          } 
        })
          .then((stream) => {
            streamRef.current = stream;
            
            // Setup audio context for PCM conversion
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
              sampleRate: 16000
            });
            audioContextRef.current = audioContext;
            
            // Setup analyser for visualization
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Setup ScriptProcessorNode for PCM audio extraction
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              if (socket.readyState === WebSocket.OPEN) {
                const float32Data = e.inputBuffer.getChannelData(0);
                const int16Data = floatTo16BitPCM(float32Data);
                socket.send(int16Data.buffer);
              }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            setIsRecording(true);
            startTimeRef.current = Date.now();
            updateAudioLevel();
          })
          .catch((error) => {
            console.error("Error accessing media devices:", error);
            setConnectionStatus("error");
          });
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message);
          
          if (message.type === "transcript") {
            setConfirmedText(message.confirmed_text || "");
            setPartialText(message.partial_text || "");
            setIsTranslating(message.is_translating || false);
            if (message.translated_text !== undefined) {
              setTranslatedText(message.translated_text || "");
            }
          } else if (message.type === "status") {
            console.log(`Status [${message.stream}]: ${message.status}`);
            if (message.stream === "fast") {
              setFastStatus(message.status);
            } else if (message.stream === "slow") {
              setSlowStatus(message.status);
            }
          } else if (message.type === "error") {
            console.error("Server error:", message.message);
            setConnectionStatus("error");
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket connection closed.");
        setConnectionStatus("disconnected");
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };
    } catch (error) {
      console.error("Error starting recording:", error);
      setConnectionStatus("error");
    }
  };

  // Stop recording
  const stopRecording = () => {
    // Send stop signal to server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
    }
    
    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
    setDuration(0);
    setFastStatus("connecting");
    setSlowStatus("connecting");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-20 px-4 font-sans">
      
      {/* Logo / Branding */}
      <div className="mb-8">
        <h1 className="text-4xl font-light text-gray-800 tracking-tight">
          <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Voice
          </span>
          <span className="text-gray-500 font-light ml-1">Search</span>
        </h1>
      </div>

      {/* Main Search Container */}
      <div className={`w-full max-w-2xl transition-all duration-300 ${isSearchFocused ? 'scale-105' : ''}`}>
        
        {/* Search Bar */}
        <div className={`bg-white rounded-2xl shadow-lg border transition-all duration-300 ${
          isRecording 
            ? 'border-red-300 shadow-red-100' 
            : isSearchFocused 
              ? 'border-blue-400 shadow-xl' 
              : 'border-gray-200 hover:shadow-xl'
        }`}>
          
          {/* Search Input Area */}
          <div className="p-4">
            {/* Original Text Display */}
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

              {/* Clear Button */}
              {(confirmedText || translatedText) && !isRecording && (
                <button 
                  onClick={() => {
                    setConfirmedText("");
                    setPartialText("");
                    setTranslatedText("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors mt-1"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Translated Text Display (only for non-English languages) */}
            {language.value !== "English" && (translatedText || isTranslating || confirmedText) ? (
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
                  {!isTranslating && !translatedText && confirmedText ? (
                    <p className="text-gray-400 italic text-sm mt-1">
                      {connectionStatus === "disconnected" ? "Translation unavailable." : "Waiting for pause to translate..."}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-400 mt-1">
                    Translated to {language.value}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Controls Bar */}
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
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
                    title="Voice Search"
                  >
                    <FaMicrophone className="text-sm" />
                    <span className="text-sm font-medium">Search with voice</span>
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
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

          {/* Audio Level Indicator */}
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
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Search Options Bar */}
        <div className="flex items-center justify-between mt-4 px-2">
          
          {/* Left side - Language selector */}
          <div className="flex items-center gap-4">
            <div className="relative z-50 min-w-35">
              <Select
                options={languageOptions}
                value={language}
                onChange={setLanguage}
                isDisabled={isRecording}
                placeholder="Language"
                styles={{
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
                }}
              />
            </div>

            {/* Status indicators (subtle) */}
            {isRecording && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    fastStatus === "connected" ? "bg-green-400" : 
                    fastStatus === "connecting" ? "bg-yellow-400 animate-pulse" : 
                    "bg-gray-300"
                  }`}></div>
                  <span className="text-xs text-gray-400">Fast</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    slowStatus === "connected" ? "bg-green-400" : 
                    slowStatus === "connecting" ? "bg-yellow-400 animate-pulse" : 
                    "bg-gray-300"
                  }`}></div>
                  <span className="text-xs text-gray-400">Slow</span>
                </div>
              </div>
            )}
          </div>

          {/* Right side - Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${
              connectionStatus === "connecting" ? "animate-pulse" : ""
            }`}></div>
            <span className="text-xs text-gray-400 capitalize">{connectionStatus}</span>
          </div>
        </div>

        {/* Search Suggestions / Results Area */}
        {(confirmedText || translatedText) && !isRecording && (
          <div className="mt-8 space-y-4">
            {/* Original Text Result */}
            {confirmedText && language.value !== "English" && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">ORIGINAL (ENGLISH)</h3>
                <p className="text-gray-800 text-lg">{confirmedText}</p>
              </div>
            )}
            
            {/* Translated Text Result */}
            {translatedText && (
              <div className="bg-linear-to-r from-purple-50 to-blue-50 rounded-2xl shadow-sm border border-purple-100 p-6">
                <h3 className="text-sm font-medium text-purple-400 mb-2">
                  TRANSLATED TO {language.value.toUpperCase()}
                </h3>
                <p className="text-purple-900 text-lg font-medium">{translatedText}</p>
              </div>
            )}

            {/* If English is selected, show single result */}
            {confirmedText && language.value === "English" && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">SEARCH RESULT</h3>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <FaSearch className="text-gray-300 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-gray-800 font-medium">{confirmedText}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Search result description would appear here...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto py-6 text-center text-sm text-gray-400">
        <p>Voice Search — Speak in English, translate to {language.value}</p>
      </div>
    </div>
  );
}

export default App;
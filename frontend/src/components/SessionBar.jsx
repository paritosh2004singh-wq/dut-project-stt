import { LanguageSelector } from "./LanguageSelector";

function getStreamDotClass(status) {
  if (status === "connected") {
    return "bg-green-400";
  }

  if (status === "connecting") {
    return "bg-yellow-400 animate-pulse";
  }

  return "bg-gray-300";
}

function getConnectionDotClass(connectionStatus) {
  switch (connectionStatus) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

export function SessionBar({
  connectionStatus,
  fastStatus,
  isRecording,
  language,
  onLanguageChange,
  slowStatus,
}) {
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <div className="flex items-center gap-4">
        <LanguageSelector
          isDisabled={isRecording}
          value={language}
          onChange={onLanguageChange}
        />

        {isRecording && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${getStreamDotClass(fastStatus)}`} />
              <span className="text-xs text-gray-400">Fast</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${getStreamDotClass(slowStatus)}`} />
              <span className="text-xs text-gray-400">Slow</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${getConnectionDotClass(connectionStatus)} ${
            connectionStatus === "connecting" ? "animate-pulse" : ""
          }`}
        />
        <span className="text-xs text-gray-400 capitalize">{connectionStatus}</span>
      </div>
    </div>
  );
}

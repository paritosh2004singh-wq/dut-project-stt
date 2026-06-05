export const StatusIndicator = ({ status, label }) => {
  const statusColors = {
    connected: "bg-green-400",
    connecting: "bg-yellow-400 animate-pulse",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${statusColors[status] || "bg-gray-300"}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
};

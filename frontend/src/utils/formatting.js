// utils/formatting.js
export const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getStatusColor = (status) => {
  const statusColors = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    error: "bg-red-500",
    disconnected: "bg-gray-500"
  };
  return statusColors[status] || statusColors.disconnected;
};
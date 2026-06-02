export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** Small, pure formatting helpers shared across components. */

/** Pretty-print a raw meeting code as Zoom does: "874 2261 9043". */
export function formatMeetingCode(code: string): string {
  if (code.length === 11) return `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`;
  if (code.length === 10) return `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6)}`;
  return code;
}

/** Human-friendly local date/time, e.g. "Mon, Jun 30, 10:00 AM". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

"use client";

import { useState } from "react";
import { Modal } from "./Modal";

/**
 * "Schedule Meeting" dialog. Collects title/description/date-time/duration and
 * passes a normalised payload up. The backend re-validates (future date, lengths)
 * — this just gives quick local feedback and shapes the request.
 */
interface ScheduleMeetingModalProps {
  onClose: () => void;
  onSchedule: (input: {
    title: string;
    description?: string;
    scheduled_for: string;
    duration_min: number;
  }) => Promise<void>;
}

export function ScheduleMeetingModal({ onClose, onSchedule }: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [datetime, setDatetime] = useState("");
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !datetime) {
      setError("Title and date/time are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSchedule({
        title: title.trim(),
        description: description.trim() || undefined,
        // <input type=datetime-local> yields local time without a zone; send as-is.
        scheduled_for: new Date(datetime).toISOString(),
        duration_min: duration,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule meeting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Schedule Meeting" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="resize-none rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        />
        <label className="text-sm text-zoom-slate">Date & time</label>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        />
        <label className="text-sm text-zoom-slate">Duration (minutes)</label>
        <select
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        >
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>{m} min</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="mt-1 rounded-md bg-zoom-blue py-2 font-medium text-white hover:bg-zoom-bluehover disabled:bg-gray-300"
        >
          {busy ? "Scheduling…" : "Schedule"}
        </button>
      </div>
    </Modal>
  );
}

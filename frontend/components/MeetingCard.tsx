"use client";

import { Clock, Video } from "lucide-react";
import type { Meeting } from "@/lib/types";
import { formatDateTime, formatMeetingCode } from "@/lib/format";

/**
 * A single meeting row in the Upcoming/Recent lists. Presentational: it renders
 * a meeting and exposes a "Start"/"Join" action via callback. The label adapts
 * to the meeting's lifecycle so one component serves both dashboard sections.
 */
interface MeetingCardProps {
  meeting: Meeting;
  onOpen: (code: string) => void;
}

export function MeetingCard({ meeting, onOpen }: MeetingCardProps) {
  const isPast = meeting.status === "ended";
  const when = meeting.scheduled_for
    ? formatDateTime(meeting.scheduled_for)
    : formatDateTime(meeting.created_at);

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-zoom-blue">
          <Video className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-gray-900">{meeting.title}</p>
          <p className="flex items-center gap-1 text-sm text-zoom-slate">
            <Clock className="h-3.5 w-3.5" />
            {when} · ID {formatMeetingCode(meeting.meeting_code)}
          </p>
        </div>
      </div>

      <button
        onClick={() => onOpen(meeting.meeting_code)}
        disabled={isPast}
        className="rounded-md bg-zoom-blue px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zoom-bluehover disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isPast ? "Ended" : meeting.status === "live" ? "Join" : "Start"}
      </button>
    </div>
  );
}

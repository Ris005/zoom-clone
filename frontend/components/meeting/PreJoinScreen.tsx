"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { formatMeetingCode } from "@/lib/format";

/**
 * Pre-join screen shown when entering a room without a name (Zoom's "enter your
 * name" gate). Collects the display name, then calls up to actually join.
 */
interface PreJoinScreenProps {
  meetingCode: string;
  meetingTitle: string;
  onJoin: (name: string) => void;
}

export function PreJoinScreen({ meetingCode, meetingTitle, onJoin }: PreJoinScreenProps) {
  const [name, setName] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zoom-dark px-4">
      <div className="w-full max-w-sm rounded-xl bg-zoom-panel p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zoom-blue">
          <Video className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-white">{meetingTitle}</h1>
        <p className="mb-6 text-sm text-zoom-slate">Meeting ID {formatMeetingCode(meetingCode)}</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin(name.trim())}
          placeholder="Enter your name"
          className="mb-3 w-full rounded-md border border-gray-600 bg-zoom-dark px-3 py-2 text-white outline-none focus:border-zoom-blue"
        />
        <button
          onClick={() => name.trim() && onJoin(name.trim())}
          disabled={!name.trim()}
          className="w-full rounded-md bg-zoom-blue py-2 font-medium text-white hover:bg-zoom-bluehover disabled:bg-gray-600"
        >
          Join Now
        </button>
      </div>
    </div>
  );
}

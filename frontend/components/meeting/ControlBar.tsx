"use client";

import { Mic, MicOff, Video, VideoOff, Link2, PhoneOff, Users } from "lucide-react";

/**
 * In-call control bar. Pure presentation: it reflects state passed in and emits
 * intent via callbacks. The page owns the actual media-toggle/leave logic.
 */
interface ControlBarProps {
  muted: boolean;
  videoOff: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onCopyInvite: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

export function ControlBar(props: ControlBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 bg-zoom-dark px-6 py-3">
      <ControlButton active={!props.muted} onClick={props.onToggleAudio}
        on={<Mic className="h-5 w-5" />} off={<MicOff className="h-5 w-5" />} label="Mic" isOn={!props.muted} />
      <ControlButton active={!props.videoOff} onClick={props.onToggleVideo}
        on={<Video className="h-5 w-5" />} off={<VideoOff className="h-5 w-5" />} label="Camera" isOn={!props.videoOff} />
      <IconButton onClick={props.onToggleParticipants} label="Participants">
        <Users className="h-5 w-5" />
      </IconButton>
      <IconButton onClick={props.onCopyInvite} label="Copy invite">
        <Link2 className="h-5 w-5" />
      </IconButton>
      <button
        onClick={props.onLeave}
        className="ml-4 flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
      >
        <PhoneOff className="h-5 w-5" /> Leave
      </button>
    </div>
  );
}

/** A toggle showing the on/off icon based on `isOn`. */
function ControlButton({
  isOn, on, off, label, onClick,
}: { isOn: boolean; on: React.ReactNode; off: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <IconButton onClick={onClick} label={label} danger={!isOn}>
      {isOn ? on : off}
    </IconButton>
  );
}

/** Round icon button used across the control bar. */
function IconButton({
  children, label, onClick, danger = false,
}: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-white transition ${
        danger ? "bg-red-500/20 hover:bg-red-500/30" : "hover:bg-white/10"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

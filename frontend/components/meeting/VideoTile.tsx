"use client";

import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

/**
 * A single video pane in the meeting grid. Binds a MediaStream to a <video> via
 * a ref (React can't set `srcObject` declaratively). Shows the participant's
 * name and a mute badge. `muted` on the element prevents local echo for self.
 */
interface VideoTileProps {
  stream: MediaStream | null;
  label: string;
  isSelf?: boolean;
  isMuted?: boolean;
}

export function VideoTile({ stream, label, isSelf = false, isMuted = false }: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-zoom-panel">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isSelf} // never play your own audio back
        className="h-full w-full object-cover"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-sm text-white">
        {isMuted && <MicOff className="h-3.5 w-3.5 text-red-400" />}
        {label}{isSelf && " (You)"}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { VideoTile } from "@/components/meeting/VideoTile";
import { ControlBar } from "@/components/meeting/ControlBar";
import { PreJoinScreen } from "@/components/meeting/PreJoinScreen";
import { MeshClient } from "@/lib/webrtc";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";

/**
 * Meeting room page. Three phases:
 *   1. LOADING  — fetch the meeting by code (validates it exists).
 *   2. PRE-JOIN — if no name yet, gate behind PreJoinScreen.
 *   3. IN-CALL  — acquire media, run the MeshClient, render the video grid.
 *
 * The MeshClient lives in a ref (not state) because it's an imperative object
 * whose identity must survive re-renders; React state mirrors only what the UI
 * needs to draw (streams, mute flags).
 */
type Phase = "loading" | "prejoin" | "incall" | "error";

export default function MeetingRoomPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const nameFromQuery = useSearchParams().get("name");

  const [phase, setPhase] = useState<Phase>("loading");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const meshRef = useRef<MeshClient | null>(null);
  const displayName = useRef<string>(nameFromQuery ?? "");

  // ----- Phase 1: validate the meeting exists ------------------------------
  useEffect(() => {
    api
      .getMeeting(code)
      .then((m) => {
        setMeeting(m);
        setPhase(nameFromQuery ? "incall" : "prejoin");
      })
      .catch(() => setPhase("error"));
  }, [code, nameFromQuery]);

  // ----- Phase 3: start media + signaling once we're in-call ---------------
  const startCall = useCallback(async () => {
    const mesh = new MeshClient(
      code,
      crypto.randomUUID(), // unique peer id for this tab/session
      (peerId, stream) =>
        setRemoteStreams((prev) => new Map(prev).set(peerId, stream)),
      (peerId) =>
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        }),
    );
    meshRef.current = mesh;
    try {
      setLocalStream(await mesh.start());
    } catch {
      // Camera/mic denied — stay in the room audio-less rather than crashing.
    }
  }, [code]);

  useEffect(() => {
    if (phase !== "incall") return;
    startCall();
    return () => meshRef.current?.stop(); // tear down on leave/unmount
  }, [phase, startCall]);

  // ----- Handlers -----------------------------------------------------------
  async function handlePreJoin(name: string) {
    displayName.current = name;
    await api.join(code, name).catch(() => {}); // register participant; non-fatal
    setPhase("incall");
  }

  function toggleAudio() {
    setMuted(meshRef.current?.toggleAudio() ?? false);
  }
  function toggleVideo() {
    setVideoOff(meshRef.current?.toggleVideo() ?? false);
  }
  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${code}`);
  }
  function leave() {
    meshRef.current?.stop();
    router.push("/");
  }

  // ----- Render by phase ----------------------------------------------------
  if (phase === "loading") return <CenterMessage text="Loading meeting…" />;
  if (phase === "error") return <CenterMessage text="Meeting not found." />;
  if (phase === "prejoin" && meeting)
    return (
      <PreJoinScreen
        meetingCode={code}
        meetingTitle={meeting.title}
        onJoin={handlePreJoin}
      />
    );

  const remotes = Array.from(remoteStreams.entries());
  return (
    <div className="flex h-screen flex-col bg-zoom-dark">
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
        <VideoTile stream={localStream} label={displayName.current || "You"} isSelf isMuted={muted} />
        {remotes.map(([peerId, stream]) => (
          <VideoTile key={peerId} stream={stream} label="Participant" />
        ))}
      </div>
      <ControlBar
        muted={muted}
        videoOff={videoOff}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onCopyInvite={copyInvite}
        onToggleParticipants={() => {}}
        onLeave={leave}
      />
    </div>
  );
}

/** Full-screen centered status message (loading / error). */
function CenterMessage({ text }: { text: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-zoom-dark text-white">
      {text}
    </div>
  );
}

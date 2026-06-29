"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Navbar } from "@/components/Navbar";
import { ActionButtons } from "@/components/ActionButtons";
import { MeetingCard } from "@/components/MeetingCard";
import { JoinMeetingModal } from "@/components/modals/JoinMeetingModal";
import { ScheduleMeetingModal } from "@/components/modals/ScheduleMeetingModal";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

/**
 * Landing dashboard — the app's home. Owns the dashboard data + which modal is
 * open, and wires the primary actions (new / join / schedule) to the API and
 * router. All rendering is delegated to small presentational components.
 */
type OpenModal = "join" | "schedule" | null;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ upcoming: [], recent: [] });
  const [modal, setModal] = useState<OpenModal>(null);

  /** Load both dashboard sections. Memoised so it can also be a refresh hook. */
  const refresh = useCallback(async () => {
    try {
      setData(await api.getDashboard());
    } catch {
      // Non-fatal on the dashboard; an empty state is acceptable.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ----- Action handlers (each does one thing) -----------------------------
  async function handleNewMeeting() {
    const meeting = await api.createInstantMeeting();
    router.push(`/meeting/${meeting.meeting_code}`);
  }

  async function handleJoin(code: string, displayName: string) {
    // Validate existence via the join call; on success, enter the room.
    await api.join(code, displayName);
    router.push(`/meeting/${code}?name=${encodeURIComponent(displayName)}`);
  }

  async function handleSchedule(input: Parameters<typeof api.scheduleMeeting>[0]) {
    await api.scheduleMeeting(input);
    setModal(null);
    await refresh(); // new meeting should appear under "Upcoming" immediately
  }

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Home</h1>

        <ActionButtons
          onNewMeeting={handleNewMeeting}
          onJoin={() => setModal("join")}
          onSchedule={() => setModal("schedule")}
        />

        <Section title="Upcoming Meetings" emptyText="No upcoming meetings.">
          {data.upcoming.map((m) => (
            <MeetingCard key={m.id} meeting={m} onOpen={(c) => router.push(`/meeting/${c}`)} />
          ))}
        </Section>

        <Section title="Recent Meetings" emptyText="No recent meetings.">
          {data.recent.map((m) => (
            <MeetingCard key={m.id} meeting={m} onOpen={(c) => router.push(`/meeting/${c}`)} />
          ))}
        </Section>
      </div>

      {modal === "join" && (
        <JoinMeetingModal onClose={() => setModal(null)} onJoin={handleJoin} />
      )}
      {modal === "schedule" && (
        <ScheduleMeetingModal onClose={() => setModal(null)} onSchedule={handleSchedule} />
      )}
    </main>
  );
}

/** Small section wrapper with a heading and an empty state. */
function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const isEmpty = Array.isArray(children) && children.length === 0;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex flex-col gap-2">
        {isEmpty ? <p className="text-sm text-zoom-slate">{emptyText}</p> : children}
      </div>
    </section>
  );
}

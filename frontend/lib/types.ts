/** Shared transport types — mirror the backend Pydantic schemas exactly. */

export type MeetingStatus = "scheduled" | "live" | "ended";

export interface Meeting {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  status: MeetingStatus;
  scheduled_for: string | null;
  duration_min: number;
  created_at: string;
  invite_link: string | null;
}

export interface Participant {
  id: number;
  display_name: string;
  is_host: boolean;
  is_muted: boolean;
}

export interface DashboardData {
  upcoming: Meeting[];
  recent: Meeting[];
}

export interface JoinResponse {
  meeting: Meeting;
  participant: Participant;
}

/**
 * Typed API client — a Singleton.
 *
 * WHY A SINGLETON
 * ---------------
 * Every component needs the same configured client (same base URL, same error
 * handling). Exporting one instance (`api`) means there is a single, consistent
 * entrypoint to the backend and no component ever hand-rolls a `fetch` with a
 * divergent base URL or error convention.
 *
 * Each method is small and maps 1:1 to a backend route, so call sites read
 * declaratively: `api.createInstantMeeting()`, `api.join(code, name)`.
 */
import type { DashboardData, JoinResponse, Meeting, Participant } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Typed error carrying the HTTP status so callers can branch (e.g. on 404). */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Core request helper: JSON in, JSON out, with a uniform error shape. */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      // Surface FastAPI's `{detail: ...}` message so the UI can show it.
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.detail ?? res.statusText, res.status);
    }
    return res.json() as Promise<T>;
  }

  // ----- Meeting lifecycle (one method per backend route) -------------------
  getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>("/api/meetings/dashboard");
  }

  getMeeting(code: string): Promise<Meeting> {
    return this.request<Meeting>(`/api/meetings/${code}`);
  }

  createInstantMeeting(title = "Instant Meeting"): Promise<Meeting> {
    return this.request<Meeting>("/api/meetings", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  scheduleMeeting(input: {
    title: string;
    description?: string;
    scheduled_for: string;
    duration_min: number;
  }): Promise<Meeting> {
    return this.request<Meeting>("/api/meetings/schedule", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  join(code: string, displayName: string): Promise<JoinResponse> {
    return this.request<JoinResponse>(`/api/meetings/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ display_name: displayName }),
    });
  }

  listParticipants(code: string): Promise<Participant[]> {
    return this.request<Participant[]>(`/api/meetings/${code}/participants`);
  }

  /** Build the WebSocket signaling URL for a given room + peer. */
  signalingUrl(code: string, peerId: string): string {
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    return `${wsBase}/ws/meetings/${code}/${peerId}`;
  }
}

/** The shared, app-wide client instance. */
export const api = new ApiClient(BASE_URL);

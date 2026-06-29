"""Meeting business logic.

Orchestrates the repository, the ID generator and the domain rules. Routers call
these methods and nothing else; this is where "what it means to create / join /
schedule a meeting" lives. Each method owns its transaction (commit) so an
operation either fully succeeds or fully rolls back.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.meeting import Meeting, MeetingStatus
from app.models.participant import Participant
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.meeting import (
    JoinResponse,
    MeetingCreate,
    MeetingOut,
    MeetingSchedule,
    ParticipantOut,
)
from app.services.id_generator import generate_unique_code

# Demo host used when the client omits one (assignment: "assume a logged-in user").
DEFAULT_HOST_ID = 1


class MeetingService:
    """Use-case methods for the meeting lifecycle. One public method per route."""

    def __init__(self, session: Session) -> None:
        self._session = session
        self._repo = MeetingRepository(session)
        self._settings = get_settings()

    # ----- Commands -----------------------------------------------------------
    def create_instant(self, payload: MeetingCreate) -> MeetingOut:
        """Create a meeting that is live immediately and return it."""
        meeting = Meeting(
            meeting_code=self._new_code(),
            title=payload.title,
            status=MeetingStatus.LIVE,
            duration_min=self._settings.default_meeting_duration_min,
            host_id=payload.host_id or DEFAULT_HOST_ID,
        )
        self._repo.add(meeting)
        self._session.commit()
        return self._to_out(meeting)

    def schedule(self, payload: MeetingSchedule) -> MeetingOut:
        """Persist a future meeting that will surface in 'Upcoming'."""
        meeting = Meeting(
            meeting_code=self._new_code(),
            title=payload.title,
            description=payload.description,
            status=MeetingStatus.SCHEDULED,
            scheduled_for=payload.scheduled_for,
            duration_min=payload.duration_min,
            host_id=payload.host_id or DEFAULT_HOST_ID,
        )
        self._repo.add(meeting)
        self._session.commit()
        return self._to_out(meeting)

    def join(self, meeting_code: str, display_name: str) -> JoinResponse:
        """Validate the meeting exists/joinable, then register the participant."""
        meeting = self._require_meeting(meeting_code)

        if meeting.status == MeetingStatus.ENDED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This meeting has already ended.",
            )

        # First person into a scheduled room flips it live (mirrors Zoom).
        if meeting.status == MeetingStatus.SCHEDULED:
            meeting.status = MeetingStatus.LIVE

        is_first = not self._repo.list_participants(meeting.id)
        participant = Participant(
            meeting_id=meeting.id,
            display_name=display_name,
            is_host=is_first,   # demo rule: first joiner hosts.
        )
        self._repo.add_participant(participant)
        self._session.commit()

        return JoinResponse(
            meeting=self._to_out(meeting),
            participant=ParticipantOut.model_validate(participant),
        )

    def end(self, meeting_code: str) -> MeetingOut:
        """Mark a meeting ended (host control / cleanup)."""
        meeting = self._require_meeting(meeting_code)
        meeting.status = MeetingStatus.ENDED
        meeting.ended_at = datetime.utcnow()
        self._session.commit()
        return self._to_out(meeting)

    # ----- Queries ------------------------------------------------------------
    def get(self, meeting_code: str) -> MeetingOut:
        return self._to_out(self._require_meeting(meeting_code))

    def list_dashboard(self, host_id: int = DEFAULT_HOST_ID) -> dict[str, list[MeetingOut]]:
        """Return both dashboard buckets in one call to save a round-trip."""
        upcoming = self._repo.list_upcoming(host_id)
        recent = self._repo.list_recent(host_id)
        return {
            "upcoming": [self._to_out(m) for m in upcoming],
            "recent": [self._to_out(m) for m in recent],
        }

    def list_participants(self, meeting_code: str) -> list[ParticipantOut]:
        meeting = self._require_meeting(meeting_code)
        rows = self._repo.list_participants(meeting.id)
        return [ParticipantOut.model_validate(p) for p in rows]

    # ----- Private helpers (small, single-purpose) ----------------------------
    def _new_code(self) -> str:
        """Allocate a fresh, unique meeting code."""
        return generate_unique_code(
            self._settings.meeting_id_length, self._repo.code_exists
        )

    def _require_meeting(self, meeting_code: str) -> Meeting:
        """Fetch a meeting or raise 404 — centralises the not-found path."""
        meeting = self._repo.get_by_code(meeting_code)
        if meeting is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meeting {meeting_code} not found.",
            )
        return meeting

    def _to_out(self, meeting: Meeting) -> MeetingOut:
        """Map an ORM row to its API representation, adding the invite link."""
        out = MeetingOut.model_validate(meeting)
        out.invite_link = f"/meeting/{meeting.meeting_code}"
        return out

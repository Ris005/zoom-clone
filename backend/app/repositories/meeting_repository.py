"""Data-access layer for meetings and participants.

This is the ONLY layer that issues queries. Each method is a single, named,
intention-revealing operation ("get by code", "list upcoming") so the service
layer reads like prose and so swapping SQLite for Postgres later means editing
exactly one file.

The repository never commits — it stages changes on the session and lets the
service decide the transaction boundary. That keeps multi-step operations atomic.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.meeting import Meeting, MeetingStatus
from app.models.participant import Participant


class MeetingRepository:
    """Thin, focused wrapper over the ORM session for meeting persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    # ----- Writes (staged, not committed) ------------------------------------
    def add(self, meeting: Meeting) -> Meeting:
        """Stage a new meeting and flush to populate its autoincrement id."""
        self._session.add(meeting)
        self._session.flush()
        return meeting

    def add_participant(self, participant: Participant) -> Participant:
        self._session.add(participant)
        self._session.flush()
        return participant

    # ----- Reads --------------------------------------------------------------
    def get_by_code(self, meeting_code: str) -> Meeting | None:
        """Look up a meeting by its public, shareable code (the join path)."""
        stmt = select(Meeting).where(Meeting.meeting_code == meeting_code)
        return self._session.scalar(stmt)

    def get_by_id(self, meeting_id: int) -> Meeting | None:
        return self._session.get(Meeting, meeting_id)

    def code_exists(self, meeting_code: str) -> bool:
        """Cheap existence check used by the unique-ID generator."""
        stmt = select(Meeting.id).where(Meeting.meeting_code == meeting_code)
        return self._session.scalar(stmt) is not None

    def list_upcoming(self, host_id: int, *, limit: int = 20) -> list[Meeting]:
        """Scheduled meetings whose start time is still in the future.

        Backs the dashboard's "Upcoming meetings" section. Ordered soonest-first.
        """
        stmt = (
            select(Meeting)
            .where(
                Meeting.host_id == host_id,
                Meeting.status == MeetingStatus.SCHEDULED,
                Meeting.scheduled_for >= datetime.utcnow(),
            )
            .order_by(Meeting.scheduled_for.asc())
            .limit(limit)
        )
        return list(self._session.scalars(stmt))

    def list_recent(self, host_id: int, *, limit: int = 20) -> list[Meeting]:
        """Most recently created/ended meetings — the "Recent" dashboard section."""
        stmt = (
            select(Meeting)
            .where(Meeting.host_id == host_id)
            .order_by(Meeting.created_at.desc())
            .limit(limit)
        )
        return list(self._session.scalars(stmt))

    def list_participants(self, meeting_id: int) -> list[Participant]:
        stmt = (
            select(Participant)
            .where(Participant.meeting_id == meeting_id)
            .order_by(Participant.joined_at.asc())
        )
        return list(self._session.scalars(stmt))

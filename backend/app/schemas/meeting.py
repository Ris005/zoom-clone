"""Pydantic schemas for the Meeting API.

These define the *transport contract* — the exact JSON the SPA sends and
receives — and are kept separate from the ORM models so the wire format can
evolve independently of the database. Validation (lengths, required fields,
future dates) lives here, declaratively, so the service layer can trust its
inputs.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.meeting import MeetingStatus


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class MeetingCreate(BaseModel):
    """Body for an *instant* meeting. Title is optional — Zoom defaults it."""

    title: str = Field(default="Instant Meeting", max_length=200)
    host_id: int | None = Field(
        default=None, description="Defaults to the seeded demo user when omitted."
    )


class MeetingSchedule(BaseModel):
    """Body for a *scheduled* meeting."""

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    scheduled_for: datetime = Field(..., description="ISO-8601 future timestamp.")
    duration_min: int = Field(default=60, ge=5, le=1440)
    host_id: int | None = None

    @field_validator("scheduled_for")
    @classmethod
    def must_be_in_future(cls, value: datetime) -> datetime:
        """Reject meetings scheduled in the past — a cheap, high-value guard."""
        reference = datetime.now(value.tzinfo) if value.tzinfo else datetime.now()
        if value < reference:
            raise ValueError("scheduled_for must be in the future")
        return value


class JoinRequest(BaseModel):
    """Body for joining: the display name typed on the pre-join screen."""

    display_name: str = Field(..., min_length=1, max_length=120)


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #
class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    is_host: bool
    is_muted: bool


class MeetingOut(BaseModel):
    """Canonical meeting representation returned to the SPA."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_code: str
    title: str
    description: str | None
    status: MeetingStatus
    scheduled_for: datetime | None
    duration_min: int
    created_at: datetime

    # Computed convenience field so the frontend never has to build the URL.
    invite_link: str | None = None


class JoinResponse(BaseModel):
    """Returned after a successful join: the meeting plus the joiner's row."""

    meeting: MeetingOut
    participant: ParticipantOut

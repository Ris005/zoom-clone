"""Meeting model — the core aggregate of the platform.

A Meeting can be created instantly or scheduled for later. The same table backs
both flows; the difference is `status` + whether `scheduled_for` is set. This
keeps the schema simple and the "upcoming vs recent" dashboard split a trivial
query on `status`/`scheduled_for` rather than two separate tables.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MeetingStatus(str, enum.Enum):
    """Lifecycle states a meeting moves through.

    SCHEDULED -> LIVE -> ENDED is the happy path. Instant meetings start LIVE.
    Storing this as an enum (a) documents the allowed values at the schema level
    and (b) lets the dashboard filter cheaply.
    """

    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Public, shareable, Zoom-style numeric ID (e.g. "874 2261 9043"). Indexed +
    # unique because every join path looks the meeting up by this value.
    meeting_code: Mapped[str] = mapped_column(
        String(16), unique=True, index=True, nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus), default=MeetingStatus.SCHEDULED, nullable=False, index=True
    )

    # NULL for instant meetings, set for scheduled ones.
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    duration_min: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    host_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    host: Mapped["User"] = relationship(back_populates="hosted_meetings", lazy="selectin")
    participants: Mapped[list["Participant"]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",   # deleting a meeting cleans up its rows
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Meeting code={self.meeting_code!r} status={self.status.value}>"

"""Participant model.

One row per person who joins a meeting. We keep a persistent record (rather than
only tracking live WebSocket connections) so the meeting room can show who has
joined and the host controls (mute/remove — the bonus item) have a stable target
to act on. `display_name` is captured at the pre-join screen, matching Zoom.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_host: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Host-control state. Defaults chosen to mirror Zoom's "join with audio on".
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Participant name={self.display_name!r} meeting_id={self.meeting_id}>"

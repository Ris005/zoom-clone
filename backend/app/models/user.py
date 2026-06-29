"""User model.

The assignment assumes a default logged-in user (no auth required), so this
table is intentionally minimal. It exists so meetings have a real `host_id`
foreign key — a cleaner design than a hard-coded string, and it leaves room to
bolt on auth later (the bonus item) without a migration of the meetings table.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # A user can host many meetings. `lazy="selectin"` avoids the N+1 problem
    # when we list a host's meetings.
    hosted_meetings: Mapped[list["Meeting"]] = relationship(
        back_populates="host", lazy="selectin"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User id={self.id} email={self.email!r}>"

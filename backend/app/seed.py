"""Seed the database with a demo user and sample meetings.

Run with `python -m app.seed`. Idempotent-ish: it wipes meetings/participants and
re-inserts a fresh, predictable set so the dashboard always has something to show
(assignment requirement: "Seed your database"). The demo user is id=1, matching
`DEFAULT_HOST_ID` in the service layer.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.core.database import Base, Database
from app.models.meeting import Meeting, MeetingStatus
from app.models.participant import Participant
from app.models.user import User
from app.services.id_generator import generate_unique_code


def _code(session) -> str:
    """Generate a unique code against the live session."""
    def exists(c: str) -> bool:
        return session.query(Meeting).filter(Meeting.meeting_code == c).first() is not None

    return generate_unique_code(11, exists)


def seed() -> None:
    db = Database.instance()
    Base.metadata.create_all(bind=db._engine)  # ensure tables exist

    with db.session_scope() as session:
        # Reset so reseeding is safe.
        session.query(Participant).delete()
        session.query(Meeting).delete()
        session.query(User).delete()

        host = User(id=1, name="Demo User", email="demo@zoomclone.dev")
        session.add(host)
        session.flush()

        now = datetime.utcnow()

        # Two upcoming (scheduled) meetings.
        upcoming = [
            Meeting(
                meeting_code=_code(session),
                title="Weekly Engineering Sync",
                description="Sprint review and planning.",
                status=MeetingStatus.SCHEDULED,
                scheduled_for=now + timedelta(hours=3),
                duration_min=45,
                host_id=host.id,
            ),
            Meeting(
                meeting_code=_code(session),
                title="Design Review: Meeting Room UI",
                description="Walk through the new in-call layout.",
                status=MeetingStatus.SCHEDULED,
                scheduled_for=now + timedelta(days=1, hours=2),
                duration_min=60,
                host_id=host.id,
            ),
        ]

        # Two recent (ended) meetings.
        recent = [
            Meeting(
                meeting_code=_code(session),
                title="1:1 with Manager",
                status=MeetingStatus.ENDED,
                duration_min=30,
                host_id=host.id,
                ended_at=now - timedelta(hours=5),
            ),
            Meeting(
                meeting_code=_code(session),
                title="Product Demo",
                status=MeetingStatus.ENDED,
                duration_min=60,
                host_id=host.id,
                ended_at=now - timedelta(days=1),
            ),
        ]

        session.add_all(upcoming + recent)
        session.flush()

        # A couple of participants on the most recent ended meeting.
        session.add_all([
            Participant(meeting_id=recent[0].id, display_name="Demo User", is_host=True),
            Participant(meeting_id=recent[0].id, display_name="Alex Kim", is_host=False),
        ])

    print("✅ Seed complete: 1 user, 4 meetings (2 upcoming, 2 recent).")


if __name__ == "__main__":
    seed()

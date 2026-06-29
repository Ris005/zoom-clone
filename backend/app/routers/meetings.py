"""HTTP routes for the meeting lifecycle.

Routers are deliberately thin: each handler (1) parses input via a schema,
(2) delegates to `MeetingService`, (3) returns the result. No business logic,
no SQL. The `service` dependency wires a request-scoped DB session into the
service, so handlers stay one-liners.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.meeting import (
    JoinRequest,
    JoinResponse,
    MeetingCreate,
    MeetingOut,
    MeetingSchedule,
    ParticipantOut,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def get_service(db: Session = Depends(get_db)) -> MeetingService:
    """Construct a service bound to this request's session (dependency)."""
    return MeetingService(db)


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def create_instant_meeting(
    payload: MeetingCreate, service: MeetingService = Depends(get_service)
) -> MeetingOut:
    """Start an instant meeting (New Meeting button)."""
    return service.create_instant(payload)


@router.post("/schedule", response_model=MeetingOut, status_code=status.HTTP_201_CREATED)
def schedule_meeting(
    payload: MeetingSchedule, service: MeetingService = Depends(get_service)
) -> MeetingOut:
    """Schedule a future meeting (Schedule Meeting modal)."""
    return service.schedule(payload)


@router.get("/dashboard")
def dashboard(service: MeetingService = Depends(get_service)) -> dict[str, list[MeetingOut]]:
    """Both dashboard sections — upcoming + recent — in one response."""
    return service.list_dashboard()


@router.get("/{meeting_code}", response_model=MeetingOut)
def get_meeting(
    meeting_code: str, service: MeetingService = Depends(get_service)
) -> MeetingOut:
    """Fetch one meeting (used to validate a code before joining)."""
    return service.get(meeting_code)


@router.post("/{meeting_code}/join", response_model=JoinResponse)
def join_meeting(
    meeting_code: str,
    payload: JoinRequest,
    service: MeetingService = Depends(get_service),
) -> JoinResponse:
    """Register a participant after the pre-join name screen."""
    return service.join(meeting_code, payload.display_name)


@router.get("/{meeting_code}/participants", response_model=list[ParticipantOut])
def list_participants(
    meeting_code: str, service: MeetingService = Depends(get_service)
) -> list[ParticipantOut]:
    """Roster for the in-meeting participants panel."""
    return service.list_participants(meeting_code)


@router.post("/{meeting_code}/end", response_model=MeetingOut)
def end_meeting(
    meeting_code: str, service: MeetingService = Depends(get_service)
) -> MeetingOut:
    """End a meeting (host control)."""
    return service.end(meeting_code)

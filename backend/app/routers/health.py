"""Liveness probe. Trivial, but lets the deploy platform health-check the app."""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return a static OK payload."""
    return {"status": "ok"}

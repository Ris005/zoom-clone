"""Application settings.

We expose configuration through a single cached `Settings` instance. Using
`functools.lru_cache` turns `get_settings()` into a process-wide singleton:
the object is constructed once on first access and reused on every subsequent
call, so we read the environment exactly once and share one immutable config
object across the whole app.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Typed, environment-overridable configuration.

    Every field can be overridden via an environment variable of the same name
    (case-insensitive), which keeps deployment (Render/Railway) clean.
    """

    # --- App ---
    app_name: str = "ZoomClone API"
    debug: bool = True

    # --- Database ---
    # A relative SQLite file. `check_same_thread=False` is set in database.py so
    # the single connection can be shared across FastAPI's threadpool workers.
    database_url: str = "sqlite:///./zoomclone.db"

    # --- CORS ---
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://zoomclone-web.onrender.com"
    ]

    # --- Domain rules ---
    meeting_id_length: int = 11          # Zoom-style 10-11 digit numeric IDs.
    default_meeting_duration_min: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings singleton.

    `lru_cache` guarantees a single shared instance for the process lifetime,
    so this is safe (and cheap) to call from anywhere.
    """
    return Settings()

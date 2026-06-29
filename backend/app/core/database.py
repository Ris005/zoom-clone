"""Database engine and session management — implemented as a Singleton.

WHY A SINGLETON
---------------
A SQLAlchemy `Engine` owns a connection pool. Creating more than one engine
would create multiple disjoint pools fighting over the same SQLite file, which
leads to lock contention and wasted file descriptors. We therefore want exactly
ONE engine per process. `Database` encapsulates that guarantee.

We deliberately implement the pattern explicitly (rather than leaning on module
globals) so the intent is obvious to a reviewer and the lifecycle (init / get
session / dispose) lives in one place.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base every ORM model inherits from."""


class Database:
    """Singleton wrapper around the SQLAlchemy engine + session factory.

    Access the shared instance via `Database.instance()`. The first call builds
    the engine; later calls return the same object.
    """

    _instance: "Database | None" = None

    def __new__(cls) -> "Database":
        # `__new__` is the allocation hook: returning the cached instance here
        # means `Database()` and `Database.instance()` both yield the one object,
        # and the engine is built only once (guarded in __init__).
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        # __init__ runs on every `Database()` call; build the engine only once.
        if self._initialized:
            return

        settings = get_settings()

        # `check_same_thread=False`: SQLite forbids cross-thread use of a
        # connection by default, but FastAPI runs sync endpoints in a threadpool.
        # Disabling the check is safe here because SQLAlchemy's pool hands each
        # logical session its own connection.
        self._engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            echo=settings.debug,
            future=True,
        )

        # `expire_on_commit=False` keeps ORM objects usable after commit, which
        # lets services return freshly created rows without a re-fetch.
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
            future=True,
        )
        self._initialized = True

    # ----- Singleton accessor -------------------------------------------------
    @classmethod
    def instance(cls) -> "Database":
        """Return the one shared `Database` (constructs it on first use)."""
        return cls()

    # ----- Schema lifecycle ---------------------------------------------------
    def create_all(self) -> None:
        """Create every table declared on `Base`. Idempotent."""
        Base.metadata.create_all(bind=self._engine)

    # ----- Session helpers ----------------------------------------------------
    @contextmanager
    def session_scope(self) -> Iterator[Session]:
        """Transactional scope: commit on success, rollback on error, always close.

        Used by seed scripts and tests. Request handlers use `get_db` instead.
        """
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_session(self) -> Session:
        """Return a brand-new session (caller owns its lifecycle)."""
        return self._session_factory()


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a request-scoped session.

    One session per request; closed automatically when the request ends.
    Commits are the service layer's responsibility, keeping transaction
    boundaries explicit and visible.
    """
    session = Database.instance().get_session()
    try:
        yield session
    finally:
        session.close()

"""FastAPI application entrypoint.

Composition root: builds the app, wires middleware (CORS for the SPA), mounts
routers, and ensures the schema exists on startup. Everything it touches is a
singleton (settings, Database, ConnectionManager), so importing this module is
cheap and side-effect-light until `create_app()` runs.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Database
from app.routers import health, meetings
from app.websocket import signaling


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Run once on boot: create tables if missing. (Yield = app is serving.)"""
    Database.instance().create_all()
    yield


def create_app() -> FastAPI:
    """Application factory — keeps construction testable and side-effect free."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    # The SPA runs on a different origin (port 3000), so it needs CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(meetings.router)
    app.include_router(signaling.router)
    return app


# Module-level instance for `uvicorn app.main:app`.
app = create_app()

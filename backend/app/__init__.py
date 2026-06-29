"""ZoomClone backend package.

A FastAPI service that powers a Zoom-style video-conferencing platform.

Layering (request flows top -> bottom):

    routers/      -> HTTP + WebSocket entrypoints. No business logic.
    services/     -> business rules (validation, ID generation, orchestration).
    repositories/ -> data access. The ONLY layer that talks to the ORM/session.
    models/       -> SQLAlchemy ORM tables.
    schemas/      -> Pydantic request/response contracts (transport shapes).
    core/         -> cross-cutting infra: settings + DB engine (singletons).

This separation keeps each function small and independently testable: a router
never builds SQL, a service never serialises JSON, a repository never validates
business rules.
"""

#!/usr/bin/env bash
# Convenience launcher: seed (first run) then serve.
set -e
[ -f zoomclone.db ] || python -m app.seed
uvicorn app.main:app --reload --port 8000

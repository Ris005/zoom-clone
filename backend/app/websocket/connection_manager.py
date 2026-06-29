"""In-memory registry of live WebSocket connections — a Singleton.

WHY A SINGLETON
---------------
Live presence is process-wide shared state: every WebSocket handler must see the
same room->sockets map to relay signaling messages between peers. A second
instance would split the room and peers in "the same" meeting would never find
each other. One instance, accessed via `ConnectionManager.instance()`.

This holds only *ephemeral* connection state (who is currently socket-connected);
durable participant records live in the database. Keeping them separate means a
server restart loses live sockets (clients reconnect) without corrupting history.
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """Maps meeting_code -> {peer_id: WebSocket} and relays messages."""

    _instance: "ConnectionManager | None" = None

    def __new__(cls) -> "ConnectionManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        # room code -> peer id -> live socket
        self._rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._initialized = True

    @classmethod
    def instance(cls) -> "ConnectionManager":
        return cls()

    async def connect(self, room: str, peer_id: str, socket: WebSocket) -> None:
        """Accept a socket and register it under its room."""
        await socket.accept()
        self._rooms[room][peer_id] = socket

    def disconnect(self, room: str, peer_id: str) -> None:
        """Remove a socket; drop the room entirely once empty to avoid leaks."""
        self._rooms.get(room, {}).pop(peer_id, None)
        if room in self._rooms and not self._rooms[room]:
            del self._rooms[room]

    def peers(self, room: str, *, exclude: str | None = None) -> list[str]:
        """List peer ids currently in a room (used to bootstrap WebRTC offers)."""
        return [pid for pid in self._rooms.get(room, {}) if pid != exclude]

    async def send_to(self, room: str, peer_id: str, message: dict) -> None:
        """Deliver a message to one peer (targeted WebRTC offer/answer/ICE)."""
        socket = self._rooms.get(room, {}).get(peer_id)
        if socket is not None:
            await socket.send_json(message)

    async def broadcast(self, room: str, message: dict, *, exclude: str | None = None) -> None:
        """Fan a message out to everyone in a room except `exclude`."""
        for pid, socket in list(self._rooms.get(room, {}).items()):
            if pid != exclude:
                await socket.send_json(message)

"""WebRTC signaling endpoint.

WHY THIS EXISTS
---------------
WebRTC sets up peer-to-peer media directly between browsers, but the two peers
still need a *signaling channel* to swap SDP offers/answers and ICE candidates
before that link exists. This WebSocket is that channel — it relays opaque blobs
between peers and never touches the actual audio/video, which keeps the server
cheap (it only moves tiny JSON control messages, not media).

TOPOLOGY: full mesh. Each participant opens a direct connection to every other
participant. This is the simplest correct design and is ideal for the small
rooms an assignment demo uses. (A production app at scale would swap the mesh
for an SFU — noted in the README's "future work".)

PROTOCOL (messages are JSON `{type, ...}`):
    server->client  "peers"   : list of existing peer ids to call on join
    client->server  "signal"  : {target, payload}  -> relayed to that peer
    server->client  "signal"  : {sender, payload}  -> the relayed payload
    server->client  "peer-joined" / "peer-left"    : presence updates
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.connection_manager import ConnectionManager

router = APIRouter()


@router.websocket("/ws/meetings/{meeting_code}/{peer_id}")
async def signaling_socket(websocket: WebSocket, meeting_code: str, peer_id: str) -> None:
    """One WebSocket per participant; relays signaling for the whole room."""
    manager = ConnectionManager.instance()
    await manager.connect(meeting_code, peer_id, websocket)

    # Tell the newcomer who is already here so it can initiate offers, and tell
    # the room a newcomer arrived.
    existing = manager.peers(meeting_code, exclude=peer_id)
    await manager.send_to(meeting_code, peer_id, {"type": "peers", "peers": existing})
    await manager.broadcast(
        meeting_code, {"type": "peer-joined", "peer_id": peer_id}, exclude=peer_id
    )

    try:
        while True:
            message = await websocket.receive_json()
            # Relay a signaling payload to a single target peer.
            if message.get("type") == "signal":
                await manager.send_to(
                    meeting_code,
                    message["target"],
                    {"type": "signal", "sender": peer_id, "payload": message["payload"]},
                )
            # Relay host-control events (mute/remove) to the room.
            elif message.get("type") == "control":
                await manager.broadcast(
                    meeting_code,
                    {"type": "control", "sender": peer_id, **message.get("payload", {})},
                    exclude=peer_id,
                )
    except WebSocketDisconnect:
        manager.disconnect(meeting_code, peer_id)
        await manager.broadcast(
            meeting_code, {"type": "peer-left", "peer_id": peer_id}
        )

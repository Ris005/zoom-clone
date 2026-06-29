/**
 * Mesh WebRTC manager.
 *
 * RESPONSIBILITY
 * --------------
 * Own the local media stream and a map of RTCPeerConnections (one per remote
 * peer), and drive the offer/answer/ICE handshake over the signaling WebSocket
 * exposed by the backend. UI components subscribe via callbacks and never touch
 * the raw WebRTC APIs directly — keeping React code declarative and this gnarly
 * protocol logic in one tested place.
 *
 * MESH TOPOLOGY: every peer connects directly to every other peer. Simple and
 * correct for small rooms (assignment scope). At scale you'd introduce an SFU;
 * see README "future work".
 *
 * STUN only (Google public server): enough for most NAT traversal in a demo.
 * Production would add TURN for symmetric NATs.
 */
import { api } from "./api";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type RemoteStreamHandler = (peerId: string, stream: MediaStream) => void;
type PeerLeftHandler = (peerId: string) => void;

export class MeshClient {
  private socket: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, RTCPeerConnection>();

  constructor(
    private readonly meetingCode: string,
    private readonly peerId: string,
    private readonly onRemoteStream: RemoteStreamHandler,
    private readonly onPeerLeft: PeerLeftHandler,
  ) {}

  /** Acquire camera + mic and open the signaling socket. Returns local stream. */
  async start(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.openSocket();
    return this.localStream;
  }

  /** Toggle the local audio track; returns the new muted state. */
  toggleAudio(): boolean {
    return this.toggleTrack("audio");
  }

  /** Toggle the local video track; returns the new "video off" state. */
  toggleVideo(): boolean {
    return this.toggleTrack("video");
  }

  /** Tear everything down: tracks, peer connections, and the socket. */
  stop(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.socket?.close();
  }

  // ----- Signaling ----------------------------------------------------------
  private openSocket(): void {
    this.socket = new WebSocket(api.signalingUrl(this.meetingCode, this.peerId));
    this.socket.onmessage = (event) => this.handleSignal(JSON.parse(event.data));
  }

  /** Route an inbound signaling message to the right handler. */
  private async handleSignal(msg: any): Promise<void> {
    switch (msg.type) {
      case "peers":
        // We are the newcomer: call everyone already here.
        for (const remoteId of msg.peers) await this.callPeer(remoteId);
        break;
      case "peer-joined":
        // Someone new arrived; they will call us, so just ensure a connection.
        this.ensurePeer(msg.peer_id);
        break;
      case "peer-left":
        this.dropPeer(msg.peer_id);
        break;
      case "signal":
        await this.onPeerSignal(msg.sender, msg.payload);
        break;
    }
  }

  /** Send a signaling payload to one target peer through the socket. */
  private send(target: string, payload: unknown): void {
    this.socket?.send(JSON.stringify({ type: "signal", target, payload }));
  }

  // ----- Peer-connection plumbing -------------------------------------------
  /** Create (once) a peer connection wired with our tracks + event handlers. */
  private ensurePeer(remoteId: string): RTCPeerConnection {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(remoteId, { candidate: e.candidate });
    };
    pc.ontrack = (e) => this.onRemoteStream(remoteId, e.streams[0]);

    this.peers.set(remoteId, pc);
    return pc;
  }

  /** Initiate the handshake by sending an SDP offer to `remoteId`. */
  private async callPeer(remoteId: string): Promise<void> {
    const pc = this.ensurePeer(remoteId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send(remoteId, { sdp: offer });
  }

  /** Handle an inbound offer/answer/ICE candidate from a peer. */
  private async onPeerSignal(sender: string, payload: any): Promise<void> {
    const pc = this.ensurePeer(sender);

    if (payload.sdp) {
      await pc.setRemoteDescription(payload.sdp);
      // If it was an offer, answer it.
      if (payload.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send(sender, { sdp: answer });
      }
    } else if (payload.candidate) {
      await pc.addIceCandidate(payload.candidate).catch(() => {});
    }
  }

  private dropPeer(remoteId: string): void {
    this.peers.get(remoteId)?.close();
    this.peers.delete(remoteId);
    this.onPeerLeft(remoteId);
  }

  private toggleTrack(kind: "audio" | "video"): boolean {
    const track = this.localStream?.getTracks().find((t) => t.kind === kind);
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled; // true == disabled (muted / video off)
  }
}

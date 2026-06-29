"use client";

import { useState } from "react";
import { Modal } from "./Modal";

/**
 * "Join Meeting" dialog. Collects a meeting code (or pasted invite link) and a
 * display name, then hands them up. All validation feedback is local; the page
 * owns the actual join + navigation so this stays a pure input component.
 */
interface JoinMeetingModalProps {
  onClose: () => void;
  onJoin: (code: string, displayName: string) => Promise<void>;
}

export function JoinMeetingModal({ onClose, onJoin }: JoinMeetingModalProps) {
  const [codeInput, setCodeInput] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Accept either a bare code or a full invite link, returning digits only. */
  function extractCode(raw: string): string {
    const fromLink = raw.trim().split("/").pop() ?? "";
    return fromLink.replace(/\D/g, ""); // strip spaces/dashes Zoom shows
  }

  async function handleSubmit() {
    const code = extractCode(codeInput);
    if (!code || !name.trim()) {
      setError("Enter a meeting ID and your name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onJoin(code, name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join meeting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Join Meeting" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="Meeting ID or invite link"
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-zoom-blue"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="mt-1 rounded-md bg-zoom-blue py-2 font-medium text-white hover:bg-zoom-bluehover disabled:bg-gray-300"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
    </Modal>
  );
}

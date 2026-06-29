"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Generic centered modal shell. Encapsulates the overlay, the card chrome, the
 * close button, and Escape-to-close so JoinMeetingModal/ScheduleMeetingModal
 * only supply content — DRY and consistent across every dialog.
 */
interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  // Close on Escape, matching native dialog behaviour. Cleaned up on unmount.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {/* stopPropagation: clicks inside the card must not close the modal. */}
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-zoom-slate" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

"use client";

import { Video, Settings, User } from "lucide-react";

/**
 * Top navigation bar. Profile/Settings are placeholders per the assignment
 * ("No login required"). Presentational only — no state, no data fetching.
 */
export function Navbar() {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zoom-blue">
          <Video className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-zoom-blue">ZoomClone</span>
      </div>

      <div className="flex items-center gap-4 text-zoom-slate">
        <button aria-label="Settings" className="rounded-full p-2 hover:bg-gray-100">
          <Settings className="h-5 w-5" />
        </button>
        <button aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

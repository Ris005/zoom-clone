"use client";

import { Video, Plus, Calendar } from "lucide-react";

/**
 * The four primary dashboard actions, mirroring Zoom's home grid.
 * Each tile is a button that delegates to a handler passed from the page —
 * this component owns no business logic, only layout + click wiring.
 */
interface ActionButtonsProps {
  onNewMeeting: () => void;
  onJoin: () => void;
  onSchedule: () => void;
}

interface Tile {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export function ActionButtons({ onNewMeeting, onJoin, onSchedule }: ActionButtonsProps) {
  // Declarative tile config keeps the JSX a single, readable map.
  const tiles: Tile[] = [
    { key: "new", label: "New Meeting", icon: <Video className="h-7 w-7" />, color: "bg-orange-500", onClick: onNewMeeting },
    { key: "join", label: "Join", icon: <Plus className="h-7 w-7" />, color: "bg-zoom-blue", onClick: onJoin },
    { key: "schedule", label: "Schedule", icon: <Calendar className="h-7 w-7" />, color: "bg-zoom-blue", onClick: onSchedule },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          onClick={tile.onClick}
          className="flex flex-col items-center gap-3 rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <span className={`flex h-14 w-14 items-center justify-center rounded-xl text-white ${tile.color}`}>
            {tile.icon}
          </span>
          <span className="font-medium text-gray-800">{tile.label}</span>
        </button>
      ))}
    </div>
  );
}

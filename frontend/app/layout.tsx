import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout. Wraps every route. Kept minimal — global chrome (the navbar) is
 * rendered per-page so the full-screen meeting room can omit it.
 */
export const metadata: Metadata = {
  title: "ZoomClone",
  description: "A Zoom-style video conferencing platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

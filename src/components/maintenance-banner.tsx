/**
 * MaintenanceBanner
 *
 * Displays a prominent banner whenever the backend API is unreachable
 * (e.g. "Failed to fetch", 503, etc.). It runs a one-off health check on
 * mount and listens for the global `skillup-maintenance` event emitted by
 * the API client whenever a request fails to connect.
 */
"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth, isBackendOffline } from "@/lib/api";

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(() => isBackendOffline());

  useEffect(() => {
    // One-off health probe on load
    checkBackendHealth().then((ok) => setOffline(!ok));

    const handler = (e: CustomEvent<{ offline: boolean }>) =>
      setOffline(e.detail.offline);
    window.addEventListener("skillup-maintenance", handler as EventListener);
    return () =>
      window.removeEventListener(
        "skillup-maintenance",
        handler as EventListener
      );
  }, []);

  if (offline) {
    return (
      <>
        <div className="fixed top-0 z-50 w-full bg-red-600 text-white px-4 py-3 text-center text-sm font-medium">
          We are currently under maintenance. Please check back in a few
          moments.
        </div>
        <div className="pt-12">{children}</div>
      </>
    );
  }

  return <>{children}</>;
}

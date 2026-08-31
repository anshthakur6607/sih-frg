/**
 * useAntiCheat - Fullscreen + telemetry hook for gatekeeper exams (/quiz/[id])
 * Tracks tab switches, blur, fullscreen exits, copy/paste, right-click
 * Sends batches to POST /api/telemetry/log
 */
"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export function useAntiCheat(assessmentId: string, enabled: boolean = true) {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const batchRef = useRef<TelemetryEvent[]>([]);

  const log = useCallback((type: string, metadata?: Record<string, any>) => {
    const ev = { type, timestamp: Date.now(), metadata };
    batchRef.current.push(ev);
    setEvents(prev => [...prev, ev]);
    if (type === "TAB_SWITCH_AWAY" || type === "BLUR_EVENT") setTabSwitches(c => c + 1);
    if (type === "FULLSCREEN_EXIT") setFullscreenExits(c => c + 1);
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onVisibilityChange = () => {
      if (document.hidden) log("TAB_SWITCH_AWAY", { visibility: document.visibilityState });
      else log("TAB_SWITCH_BACK");
    };
    const onBlur = () => log("BLUR_EVENT");
    const onCopy = (e: ClipboardEvent) => log("COPY_TEXT", { length: window.getSelection()?.toString().length || 0 });
    const onPaste = (e: ClipboardEvent) => log("PASTE_TEXT", { length: e.clipboardData?.getData("text").length || 0 });
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); log("RIGHT_CLICK"); };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        log("FULLSCREEN_EXIT");
        setIsFullscreen(false);
      } else setIsFullscreen(true);
    };
    let idleTimer: any;
    let idle30Timer: any;
    const onMouseMove = () => {
      clearTimeout(idleTimer);
      clearTimeout(idle30Timer);
      idleTimer = setTimeout(() => log("MOUSE_IDLE_5S"), 5000);
      idle30Timer = setTimeout(() => log("MOUSE_IDLE_30S"), 30000);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("mousemove", onMouseMove);

    // Flush every 5s
    const interval = setInterval(async () => {
      if (batchRef.current.length === 0) return;
      const batch = [...batchRef.current];
      batchRef.current = [];
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/telemetry/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment_id: assessmentId, events: batch })
        });
      } catch {}
    }, 5000);

    // Auto-request fullscreen
    requestFullscreen();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("mousemove", onMouseMove);
      clearInterval(interval);
      clearTimeout(idleTimer);
      clearTimeout(idle30Timer);
    };
  }, [enabled, assessmentId, log, requestFullscreen]);

  return { events, tabSwitches, fullscreenExits, isFullscreen, requestFullscreen, log };
}

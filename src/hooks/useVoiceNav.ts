/**
 * useVoiceNav - Web Speech API voice navigation hook
 * Listens for commands like "go to dashboard", "open courses", "search python"
 */
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const COMMANDS: Record<string, string> = {
  "go to dashboard": "/dashboard",
  "open dashboard": "/dashboard",
  "go to courses": "/dashboard/courses",
  "open courses": "/dashboard/courses",
  "my courses": "/dashboard/courses",
  "go to assessments": "/dashboard/assessments",
  "open assessments": "/dashboard/assessments",
  "go to certificates": "/dashboard/certificates",
  "admin panel": "/dashboard/admin",
  "go to profile": "/setup-profile",
  "search": "/dashboard/courses",
};

export function useVoiceNav(enabled: boolean = true) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const router = useRouter();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SpeechRecognition);
    if (!SpeechRecognition || !enabled) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript.toLowerCase().trim();
      setTranscript(text);
      for (const [phrase, path] of Object.entries(COMMANDS)) {
        if (text.includes(phrase)) {
          router.push(path);
          // speak feedback
          const utter = new SpeechSynthesisUtterance(`Navigating to ${phrase}`);
          utter.lang = "en-IN";
          window.speechSynthesis.speak(utter);
          break;
        }
      }
      if (text.startsWith("search ")) {
        const q = text.replace("search ", "");
        router.push(`/dashboard/courses?search=${encodeURIComponent(q)}`);
      }
    };
    recognitionRef.current = rec;
    return () => rec.abort();
  }, [enabled, router]);

  const start = useCallback(() => recognitionRef.current?.start(), []);
  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { listening, transcript, supported, start, stop };
}

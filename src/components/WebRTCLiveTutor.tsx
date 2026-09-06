/**
 * WebRTCLiveTutor - Live Voice Assistant Widget (Long-Polling/SSE Version)
 *
 * Uses the backend's GET /ws/live-tutor?token=... long-polling endpoint (SSE)
 * for receiving, and POST /api/ai/live-tutor/send for sending.
 * Works on Vercel/serverless (no WebSocket upgrade needed).
 */

"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, X, Minimize2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Props {
  courseId: string;
  moduleId: string;
  videoTimestamp: number;
  preferredLanguage?: string;
  onSessionSave?: (timestamp: number) => void;
  courseTitle?: string;
}
interface TranscriptEntry { role: "user" | "ai"; text: string; timestamp: number; }

const LANGS = [
  { code:"en", label:"English" }, { code:"hi", label:"हिन्दी" }, { code:"ta", label:"தமிழ்" },
  { code:"te", label:"తెలుగు" }, { code:"mr", label:"मराठी" }, { code:"bn", label:"বাংলা" },
  { code:"gu", label:"ગુજરાતી" }, { code:"kn", label:"ಕನ್ನಡ" }, { code:"ml", label:"മലയാളം" }, { code:"or", label:"ଓଡ଼ିଆ" },
];

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
const POLL_URL = `${API_BASE}/ws/live-tutor`;
const SEND_URL = `${API_BASE}/api/ai/live-tutor/send`;

// ----- Audio utilities (same as before) -----

const enqueuePcm = async (b64: string, playbackCtxRef: React.MutableRefObject<AudioContext | null>) => {
  try {
    if (!playbackCtxRef.current) playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const ctx = playbackCtxRef.current;
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    await new Promise<void>((r) => { src.onended = () => r(); src.start(); });
  } catch {}
};

const playBlob = async (data: Blob | ArrayBuffer) => {
  try {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    try {
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const src = ctx.createBufferSource(); src.buffer = decoded; src.connect(ctx.destination); src.start(0);
      setAiSpeaking(true); src.onended = () => setAiSpeaking(false);
    } catch { /* ignore */ }
  } catch {}
};

const audioContextRef = { current: null as AudioContext | null };
const playbackCtxRef = { current: null as AudioContext | null };
let setAiSpeaking: (v: boolean) => void = () => {};

export default function WebRTCLiveTutor({ courseId, moduleId, videoTimestamp, preferredLanguage = "en", onSessionSave, courseTitle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [aiSpeaking, setAiSpeakingState] = useState(false);
  setAiSpeaking = setAiSpeakingState;
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(preferredLanguage);
  useEffect(() => { if (preferredLanguage) setLanguage(preferredLanguage); }, [preferredLanguage]);

  const pollerRef = useRef<AbortController | null>(null);
  const sendQueueRef = useRef<Array<{ type: string; payload: any }>>([]);
  const sendingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionTokenRef = useRef<string>("");

  // ---- Polling (SSE receive loop) ----
  const startPolling = useCallback(async (token: string) => {
    pollerRef.current = new AbortController();
    const { signal } = pollerRef.current;
    const url = `${POLL_URL}?token=${encodeURIComponent(token)}&timeout=30000`;

    while (!signal.aborted) {
      try {
        const res = await fetch(url, {
          signal,
          headers: { "Accept": "text/event-stream" },
        });
        if (!res.ok || !res.body) throw new Error(`Poll error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const json = line.slice(6).trim();
              if (!json) continue;
              try {
                const msg = JSON.parse(json);
                handleIncoming(msg);
              } catch { /* ignore */ }
            }
          }
        }
      } catch (e: any) {
        if (!signal.aborted) {
          console.warn("Poll error, retrying in 1s:", e.message);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }, []);

  const stopPolling = useCallback(() => {
    pollerRef.current?.abort();
    pollerRef.current = null;
  }, []);

  // ---- Send queue (serialized POST) ----
  const flushSendQueue = useCallback(async (token: string) => {
    if (sendingRef.current || sendQueueRef.current.length === 0) return;
    sendingRef.current = true;
    while (sendQueueRef.current.length > 0) {
      const item = sendQueueRef.current.shift()!;
      try {
        await fetch(SEND_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(item),
        });
      } catch (e) {
        console.warn("Send failed:", e);
        // Re-queue on failure
        sendQueueRef.current.unshift(item);
        break;
      }
    }
    sendingRef.current = false;
  }, []);

  const queueSend = useCallback((type: string, payload: any, token: string) => {
    sendQueueRef.current.push({ type, payload });
    flushSendQueue(token);
  }, []);

  // ---- Handle incoming messages (same as WS onmessage) ----
  const handleIncoming = useCallback((msg: any) => {
    if (msg.type === "welcome") {
      setTranscripts(p => [...p, { role: "ai", text: msg.message, timestamp: Date.now() }]);
    }
    if (msg.type === "init_success") { /* ready */ }
    if (msg.type === "transcript") {
      setTranscripts(p => [...p, { role: msg.role, text: msg.text, timestamp: msg.timestamp || Date.now() }]);
      if (msg.role === "ai") setAiSpeakingState(true);
    }
    if (msg.type === "ai_speaking_end") setAiSpeakingState(false);
    if (msg.type === "interrupt_acknowledged") { /* queue cleared on backend */ }
    if (msg.type === "error") setError(msg.message);
    if (msg.type === "audio" && msg.data) {
      enqueuePcm(msg.data, playbackCtxRef).then(() => setAiSpeakingState(true));
    }
    // Legacy inline audio
    const inlineB64 = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData)?.inlineData?.data
      || msg.inlineData?.data || msg.audio?.data;
    if (inlineB64) { enqueuePcm(inlineB64, playbackCtxRef); setAiSpeakingState(true); }
    if (msg.type === "turnComplete" || msg.serverContent?.turnComplete) setAiSpeakingState(false);
  }, []);

  // ---- Connect ----
  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true); setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "demo";
      sessionTokenRef.current = token;

      // Initial poll to verify connection
      const initRes = await fetch(`${POLL_URL}?token=${encodeURIComponent(token)}&timeout=5000`, {
        headers: { Accept: "text/event-stream" },
      });
      if (!initRes.ok) throw new Error(`Connect failed: ${initRes.status}`);

      // Send init message
      queueSend("init", { course_id: courseId, module_id: moduleId, video_timestamp: videoTimestamp, language, course_title: courseTitle }, token);

      setConnected(true); setConnecting(false); setError(null);
      startPolling(token);
    } catch (e: any) {
      setError(e.message); setConnecting(false);
    }
  }, [connected, connecting, courseId, moduleId, videoTimestamp, language, courseTitle]);

  const disconnect = useCallback(() => {
    stopPolling();
    setConnected(false);
  }, []);

  // ---- Audio recording (same logic, but send via POST instead of WS binary) ----
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } as any,
      });
      streamRef.current = stream;
      let mime = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // Barge-in: if AI is speaking and user makes noise, interrupt
          if (aiSpeaking && e.data.size > 800) {
            queueSend("interrupt", {}, sessionTokenRef.current);
            return;
          }
        }
      };

      // Use longer chunks (500ms) and only transmit on stop
      recorder.start(500);
      setListening(true); setError(null);
    } catch { setError("Microphone access denied — allow mic in browser settings."); }
  };

  const stopListening = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const sendIfOpen = (blob: Blob) => {
      if (blob.size > 0) {
        // Convert blob to base64 and send as JSON
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1];
          queueSend("audio", { mime: blob.type, data: b64 }, sessionTokenRef.current);
        };
        reader.readAsDataURL(blob);
      }
    };

    const prevHandler = recorder.ondataavailable;
    recorder.ondataavailable = (e) => {
      prevHandler?.call(recorder, e);
      if (e.data && e.data.size > 0) sendIfOpen(e.data);
    };
    recorder.stop();
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setListening(false);
  };

  const handlePauseSave = async () => {
    onSessionSave?.(videoTimestamp);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      await fetch(`${API_BASE}/api/ai/live-tutor/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, module_id: moduleId, last_timestamp: videoTimestamp, conversation_history: transcripts, summary_state: transcripts.slice(-3).map(t => t.text).join(" | ") }),
      });
    } catch {}
    queueSend("pause", { video_timestamp: videoTimestamp }, sessionTokenRef.current);
  };

  useEffect(() => { if (expanded && !connected && !connecting) connect(); return () => { if (!expanded) handlePauseSave(); }; }, [expanded]);
  useEffect(() => () => { stopPolling(); streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all ${expanded ? "w-[380px] h-[520px]" : "w-auto h-auto"}`}>
      {!expanded ? (
        <button onClick={() => setExpanded(true)} className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white rounded-full px-5 py-3 shadow-lg flex items-center gap-2 font-medium">
          <Mic className="w-5 h-5" /> Ask AI Tutor
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="bg-[#1e40af] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className={`w-5 h-5 ${aiSpeaking ? "animate-pulse" : ""}`} />
              <span className="font-semibold text-sm">Live AI Tutor</span>
              {connected ? <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> : connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-2 h-2 bg-red-400 rounded-full" />}
            </div>
            <div className="flex items-center gap-1">
              <select value={language} onChange={e => { setLanguage(e.target.value); queueSend("language_change", { language: e.target.value }, sessionTokenRef.current); }} className="bg-white/20 text-white text-xs rounded px-2 py-1 max-w-[110px]">
                {LANGS.map(l => <option key={l.code} value={l.code} className="text-slate-800">{l.label}</option>)}
              </select>
              <button onClick={() => setExpanded(false)} className="p-1 hover:bg-white/20 rounded"><Minimize2 className="w-4 h-4" /></button>
              <button onClick={() => { setExpanded(false); disconnect(); }} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {transcripts.length === 0 && !error && <p className="text-sm text-slate-500 text-center mt-8">Tap microphone and speak.<br/>Try: "Explain stratified sampling in {language}"<br/><span className="text-xs opacity-70">{courseTitle || courseId}</span></p>}
            {transcripts.map((t, i) => <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.role === "user" ? "bg-[#1e40af] text-white ml-auto" : "bg-white border shadow-sm"}`}><p>{t.text}</p><span className={`text-[10px] ${t.role === "user" ? "text-white/70" : "text-slate-400"}`}>{new Date(t.timestamp).toLocaleTimeString()}</span></div>)}
            {aiSpeaking && <div className="flex gap-1 items-center text-xs text-slate-500"><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" /><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:75ms]" /><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:150ms]" /> AI speaking — you can interrupt</div>}
            {error && <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">{error}<br/><span className="text-[11px] opacity-70">Check that backend (3001) and AI service (8001) are both running.</span></p>}
          </div>
          <div className="p-3 border-t bg-white space-y-2">
            <div className="flex items-center gap-2">
              <button
                onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 select-none ${listening ? "bg-red-600 text-white animate-pulse" : "bg-[#0891b2] text-white hover:bg-[#0e7490]"} ${!connected ? "opacity-50 pointer-events-none" : ""}`}
              >
                {listening ? <><MicOff className="w-5 h-5" /> Listening… release</> : <><Mic className="w-5 h-5" /> Hold to Speak</>}
              </button>
              <button onClick={() => connected ? disconnect() : connect()} className="px-3 py-3 border rounded-lg text-xs">{connected ? "Disconnect" : "Reconnect"}</button>
            </div>
            <p className="text-[11px] text-center text-slate-400">Hold to speak • Release to send • Speak while AI talks to interrupt (barge-in) • Language: {LANGS.find(l => l.code === language)?.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
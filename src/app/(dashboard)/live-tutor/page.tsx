/**
 * Dedicated Live AI Tutor Page
 * Full-screen voice conversation with the AI tutor
 * - Click to mute/unmute mic (toggle, not hold)
 * - Continuous audio streaming while unmuted
 * - Text input fallback (typed questions)
 * - TTS playback of AI replies
 * - Course RAG context
 */
"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Mic, MicOff, Volume2, VolumeX, Loader2, ArrowLeft,
  Send, Sparkles, X, Globe, RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

interface TranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp: number;
}

const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "bn", label: "বাংলা" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "or", label: "ଓଡ଼ିଆ" },
];

const PRESET_QUESTIONS = [
  "Explain the key concepts in this course",
  "Give me a quick practice question",
  "Summarize the most important points",
  "What should I focus on first?",
  "Explain this in simple terms",
];

export default function LiveTutorPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") || "";
  const { t } = useLanguage();
  const supabase = createClient();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false); // click-to-mute/unmute
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [courseTitle, setCourseTitle] = useState("");
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourse, setSelectedCourse] = useState(courseId);
  const [textInput, setTextInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<Float32Array[]>([]);
  const playingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const userStoppedRef = useRef(false); // true when user explicitly toggles mic off

  const toWsUrl = (token: string) => {
    try {
      const backend = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
      const u = new URL(backend);
      const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${u.host}/ws/live-tutor?token=${encodeURIComponent(token)}`;
    } catch {
      return `ws://127.0.0.1:3001/ws/live-tutor?token=${encodeURIComponent(token)}`;
    }
  };

  const enqueuePcm = async (b64: string) => {
    if (muted) return;
    try {
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = playbackCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer);
      const f32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
      queueRef.current.push(f32);
      if (!playingRef.current) {
        playingRef.current = true;
        const drain = async () => {
          while (queueRef.current.length) {
            const ch = queueRef.current.shift()!;
            const buf = ctx.createBuffer(1, ch.length, 24000);
            buf.getChannelData(0).set(ch);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            await new Promise<void>((r) => { src.onended = () => r(); src.start(); });
          }
          playingRef.current = false;
        };
        drain();
      }
    } catch (e) {
      console.error("enqueuePcm failed:", e);
    }
  };

  // Load courses
  useEffect(() => {
    (async () => {
      try {
        const { data: all } = await supabase.from("courses").select("id, title").order("title").limit(50);
        setCourses(all || []);
        if (courseId) {
          const found = (all || []).find((c) => c.id === courseId);
          if (found) setCourseTitle(found.title);
        }
      } catch {}
    })();
  }, [courseId]);

  // Auto-scroll on new transcripts
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close().catch(() => {});
      playbackCtxRef.current?.close().catch(() => {});
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    };
  }, []);

  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "demo";
      const ws = new WebSocket(toWsUrl(token));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        ws.send(JSON.stringify({
          type: "init",
          course_id: selectedCourse || "general",
          module_id: "live_tutor_page",
          video_timestamp: 0,
          language,
          course_title: courseTitle || undefined,
        }));
      };

      ws.onmessage = async (ev) => {
        if (typeof ev.data === "string") {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "welcome") {
              setTranscripts((p) => [...p, { role: "ai", text: msg.message, timestamp: Date.now() }]);
            }
            if (msg.type === "transcript") {
              setTranscripts((p) => {
                // Avoid duplicates: if last is same text+role, skip
                const last = p[p.length - 1];
                if (last && last.role === msg.role && last.text === msg.text) return p;
                return [...p, { role: msg.role, text: msg.text, timestamp: msg.timestamp || Date.now() }];
              });
              if (msg.role === "ai") setAiSpeaking(true);
            }
            if (msg.type === "ai_speaking_end") setAiSpeaking(false);
            if (msg.type === "interrupt_acknowledged") {
              queueRef.current = []; playingRef.current = false;
            }
            if (msg.type === "language_detected" && msg.language) {
              setLanguage(msg.language);
            }
            if (msg.type === "error") {
              setError(msg.message);
              console.error("WS error:", msg.message);
            }
            if (msg.type === "audio" && msg.data) {
              console.log("TTS audio received:", msg.data.length, "chars b64");
              await enqueuePcm(msg.data);
              setAiSpeaking(true);
            }
            const inlineB64 = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
            if (inlineB64) {
              await enqueuePcm(inlineB64);
              setAiSpeaking(true);
            }
          } catch (e) { console.error("msg parse failed:", e); }
        }
      };
      ws.onclose = (e) => {
        setConnected(false); setConnecting(false);
        if (e.code !== 1000) setError(`Disconnected (code ${e.code})`);
        // Stop mic on disconnect
        if (mediaRecorderRef.current) {
          try { mediaRecorderRef.current.stop(); } catch {}
          mediaRecorderRef.current = null;
        }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setMicEnabled(false);
      };
      ws.onerror = () => { setError("Connection failed. Check backend (3001) and AI service (8001)."); setConnecting(false); };
    } catch (e: any) { setError(e.message); setConnecting(false); }
  }, [connected, connecting, selectedCourse, language, courseTitle, muted]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // Audio level meter (for mic activity indicator)
  const startLevelMeter = (stream: MediaStream) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(Math.min(100, avg * 2));
        levelRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("Level meter failed:", e);
    }
  };

  const startMic = async () => {
    if (micEnabled) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any,
      });
      streamRef.current = stream;
      startLevelMeter(stream);

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size === 0) return;
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        // Barge-in: if AI is speaking and user makes noise, interrupt
        if (aiSpeaking && e.data.size > 1500) {
          ws.send(JSON.stringify({ type: "interrupt" }));
          queueRef.current = []; playingRef.current = false; setAiSpeaking(false);
        }

        // Send audio chunk continuously so backend can STT
        try {
          const buf = await e.data.arrayBuffer();
          ws.send(buf);
        } catch (err) {
          console.error("Failed to send audio chunk:", err);
        }
      };

      // 1000ms chunks: Sarvam saaras:v3 needs ~0.8-1.5s for accurate transcription; buffered on backend
      recorder.start(1000);
      setMicEnabled(true);
    } catch (e: any) {
      setError(`Microphone access denied: ${e.message || e}`);
      console.error("Mic error:", e);
    }
  };

  const stopMic = () => {
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setMicEnabled(false);
    setAudioLevel(0);
    // Tell backend to flush any buffered audio (Sarvam needs complete utterance)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "utterance_end" }));
    }
  };

  const toggleMic = () => {
    if (micEnabled) stopMic();
    else startMic();
  };

  const sendText = () => {
    if (!textInput.trim()) return;
    const txt = textInput.trim();
    setTextInput("");
    setTranscripts((p) => [...p, { role: "user", text: txt, timestamp: Date.now() }]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "user_text", text: txt, language }));
    } else {
      setError("Not connected. Click 'Connect' first.");
    }
  };

  const sendPreset = (q: string) => {
    setTextInput(q);
    setTimeout(() => sendText(), 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg" title="Back to Dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              Live AI Tutor
            </h1>
            <p className="text-sm text-slate-600">
              {courseTitle || "General learning conversation"} • {LANGS.find(l => l.code === language)?.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              const c = courses.find((c) => c.id === e.target.value);
              setCourseTitle(c?.title || "");
            }}
            className="border rounded-lg px-3 py-1.5 text-sm max-w-[200px]"
          >
            <option value="">General (no course)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              wsRef.current?.send(JSON.stringify({ type: "language_change", language: e.target.value }));
            }}
            className="border rounded-lg px-3 py-1.5 text-sm"
            title="AI response language"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button onClick={() => setMuted(!muted)} className="p-2 border rounded-lg" title={muted ? "Unmute AI" : "Mute AI"}>
            {muted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
        {!connected && !connecting && (
          <div className="text-center py-12">
            <Mic className="w-20 h-20 mx-auto text-indigo-400 mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Start a Voice Conversation</h2>
            <p className="text-slate-600 mb-6">Click "Connect" then tap the mic to talk. You can also type messages below.</p>
            <button
              onClick={connect}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" /> Connect to AI Tutor
            </button>
            <p className="text-xs text-slate-400 mt-4">Backend: localhost:3001 • AI service: localhost:8001</p>
          </div>
        )}

        {connecting && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-indigo-600 mb-4" />
            <p className="text-slate-600">Connecting to AI tutor...</p>
          </div>
        )}

        {connected && (
          <>
            {/* Preset questions */}
            {transcripts.length <= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
                {PRESET_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendPreset(q)}
                    className="text-left p-3 border rounded-lg hover:bg-indigo-50 text-sm bg-white"
                  >
                    💡 {q}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {transcripts.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${t.role === "user" ? "bg-indigo-600 text-white" : "bg-white border shadow-sm"}`}>
                    <p className="text-sm whitespace-pre-wrap">{t.text}</p>
                    <span className={`text-[10px] ${t.role === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {aiSpeaking && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "75ms" }} />
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  AI is speaking — speak to interrupt
                </div>
              )}
            </div>
            <div ref={chatEndRef} />
          </>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
            <br /><span className="text-[11px] opacity-70">Make sure backend (3001) and AI service (8001) are running. Check browser console for details.</span>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {connected && (
        <div className="bg-white border-t p-4 sticky bottom-0">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Mic toggle button with audio level indicator */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                className={`relative flex-1 py-4 rounded-xl font-medium flex items-center justify-center gap-2 text-base transition-all ${
                  micEnabled
                    ? "bg-red-500 text-white shadow-lg shadow-red-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {micEnabled ? (
                  <>
                    <MicOff className="w-6 h-6" />
                    Mic On — click to mute
                    {audioLevel > 5 && (
                      <span
                        className="absolute bottom-0 left-0 h-1 bg-white/70 rounded-full transition-all"
                        style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Mic className="w-6 h-6" />
                    Click to unmute mic
                  </>
                )}
              </button>
              <button onClick={disconnect} className="px-4 py-4 border rounded-xl text-sm font-medium hover:bg-slate-50">
                Disconnect
              </button>
            </div>

            {/* Text input fallback */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendText(); } }}
                placeholder="Or type a question and press Enter..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={sendText}
                disabled={!textInput.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              {micEnabled
                ? "🎤 Listening — speak naturally. Click again to mute. You can also interrupt AI by speaking."
                : "Click mic to enable voice • Type to send text • Language: " + LANGS.find((l) => l.code === language)?.label}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

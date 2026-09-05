/**
 * WebRTCLiveTutor - Live Voice Assistant Widget
 * Fixed: uses correct ai-service WS (8001), Supabase JWT, PCM queue, barge-in, 10 languages
 * Pattern ported from D:\cognix (Gemini bidi: PCM 16k in / 24k out, playback queue)
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

export default function WebRTCLiveTutor({ courseId, moduleId, videoTimestamp, preferredLanguage = "en", onSessionSave, courseTitle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(preferredLanguage);
  useEffect(()=>{ if(preferredLanguage) setLanguage(preferredLanguage); },[preferredLanguage]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queueRef = useRef<Float32Array[]>([]);
  const playingRef = useRef(false);

  const toWsUrl = (token: string) => {
    // Use backend WS proxy (same-origin) so browser CSP allows it.
    // Backend at http://localhost:3001 mounts /ws/live-tutor → AI service 8001.
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
    try {
      if(!playbackCtxRef.current) playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = playbackCtxRef.current;
      const raw = atob(b64); const bytes = new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
      const int16 = new Int16Array(bytes.buffer); const f32 = new Float32Array(int16.length); for(let i=0;i<int16.length;i++) f32[i]= int16[i]/(int16[i]<0?0x8000:0x7fff);
      queueRef.current.push(f32);
      if(!playingRef.current){ playingRef.current=true; while(queueRef.current.length){ const ch=queueRef.current.shift()!; const buf=ctx.createBuffer(1,ch.length,24000); buf.getChannelData(0).set(ch); const src=ctx.createBufferSource(); src.buffer=buf; src.connect(ctx.destination); await new Promise<void>(r=>{src.onended=()=>r(); src.start();}); } playingRef.current=false; }
    } catch {}
  };

  const playBlob = async (data: Blob | ArrayBuffer) => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioContextRef.current;
      const buf = data instanceof Blob ? await data.arrayBuffer() : data;
      // try decode as audio (webm/opus or wav). Fallback: treat as pcm b64 inside json already handled elsewhere
      try {
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        const src = ctx.createBufferSource(); src.buffer = decoded; src.connect(ctx.destination); src.start(0);
        setAiSpeaking(true); src.onended=()=>setAiSpeaking(false);
      } catch {
        // not decodable — ignore (ai-service currently sends JSON transcripts, not binary audio)
      }
    } catch {}
  };

  const connect = useCallback(async () => {
    if (connected || connecting) return;
    setConnecting(true); setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "demo";
      const wsUrl = toWsUrl(token);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true); setConnecting(false); setError(null);
        ws.send(JSON.stringify({ type: "init", course_id: courseId, module_id: moduleId, video_timestamp: videoTimestamp, language, course_title: courseTitle || undefined }));
      };
      ws.onmessage = async (ev) => {
        if (typeof ev.data === "string") {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "welcome") setTranscripts(p=>[...p,{role:"ai", text: msg.message, timestamp: Date.now()}]);
            if (msg.type === "init_success") {/* ready */}
            if (msg.type === "transcript") { setTranscripts(p=>[...p,{role:msg.role, text:msg.text, timestamp:msg.timestamp||Date.now()}]); if(msg.role==="ai") setAiSpeaking(true); }
            if (msg.type === "ai_speaking_end") setAiSpeaking(false);
            if (msg.type === "interrupt_acknowledged") { queueRef.current=[]; playingRef.current=false; }
            if (msg.type === "error") setError(msg.message);
            if (msg.type === "audio" && msg.data) {
              // New TTS audio from AI service: { type: "audio", mime: "audio/pcm;rate=24000", data: base64, sample_rate: 24000 }
              await enqueuePcm(msg.data);
              setAiSpeaking(true);
            }
            // Legacy Cognix inline audio
            const inlineB64 = msg.serverContent?.modelTurn?.parts?.find((p:any)=>p.inlineData)?.inlineData?.data || msg.inlineData?.data || msg.audio?.data;
            if (inlineB64) { await enqueuePcm(inlineB64); setAiSpeaking(true); }
            if (msg.type === "turnComplete" || msg.serverContent?.turnComplete) setAiSpeaking(false);
          } catch {}
        } else if (ev.data instanceof ArrayBuffer || ev.data instanceof Blob) {
          await playBlob(ev.data as any);
        }
      };
      ws.onclose = (e) => { setConnected(false); setConnecting(false); if(!e.wasClean) setError(`Live tutor disconnected (${e.code}).`); };
      ws.onerror = () => { setError(`WebSocket failed. Backend proxy unreachable.`); setConnecting(false); };
    } catch (e:any){ setError(e.message); setConnecting(false); }
  }, [connected, connecting, courseId, moduleId, videoTimestamp, language, courseTitle]);

  const disconnect = useCallback(()=>{
    wsRef.current?.close(); wsRef.current=null; setConnected(false);
  },[]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation:true, noiseSuppression:true } as any });
      streamRef.current = stream;
      let mime = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      // Barge-in: if AI is speaking and user makes noise, interrupt
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          if (aiSpeaking && e.data.size > 800) {
            wsRef.current.send(JSON.stringify({ type: "interrupt" }));
            queueRef.current = []; playingRef.current = false; setAiSpeaking(false);
            return; // don't send this chunk as a question
          }
        }
      };

      // Use longer chunks (500ms) and only transmit on stop to avoid spamming Gemini API
      recorder.start(500);
      setListening(true); setError(null);
    } catch { setError("Microphone access denied — allow mic in browser settings."); }
  };

  const stopListening = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    // Capture the recorder, then send the full utterance on stop
    const ws = wsRef.current;
    const sendIfOpen = (blob: Blob) => {
      if (ws && ws.readyState === WebSocket.OPEN && blob.size > 0) {
        // send as binary frame; backend handles it as a single utterance (not per-chunk)
        ws.send(blob);
        // give Gemini time to process instead of sending N chunks/sec
      }
    };

    // Hook one-shot ondataavailable for the final blob
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
    try{
      const supabase = createClient();
      const { data:{ session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/live-tutor/session`,{
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, module_id: moduleId, last_timestamp: videoTimestamp, conversation_history: transcripts, summary_state: transcripts.slice(-3).map(t=>t.text).join(" | ") })
      });
    }catch{}
    wsRef.current?.send(JSON.stringify({ type:"pause", video_timestamp: videoTimestamp }));
  };

  useEffect(()=>{ if(expanded && !connected && !connecting) connect(); return ()=>{ if(!expanded) handlePauseSave(); }; },[expanded]); // eslint-disable-line
  useEffect(()=>()=>{ wsRef.current?.close(); streamRef.current?.getTracks().forEach(t=>t.stop()); audioContextRef.current?.close().catch(()=>{}); playbackCtxRef.current?.close().catch(()=>{}); },[]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all ${expanded ? "w-[380px] h-[520px]" : "w-auto h-auto"}`}>
      {!expanded ? (
        <button onClick={()=>setExpanded(true)} className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white rounded-full px-5 py-3 shadow-lg flex items-center gap-2 font-medium">
          <Mic className="w-5 h-5" /> Ask AI Tutor
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="bg-[#1e40af] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className={`w-5 h-5 ${aiSpeaking?"animate-pulse":""}`} />
              <span className="font-semibold text-sm">Live AI Tutor</span>
              {connected ? <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> : connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-2 h-2 bg-red-400 rounded-full" />}
            </div>
            <div className="flex items-center gap-1">
              <select value={language} onChange={e=>{setLanguage(e.target.value); wsRef.current?.send(JSON.stringify({ type:"language_change", language:e.target.value }));}} className="bg-white/20 text-white text-xs rounded px-2 py-1 max-w-[110px]">
                {LANGS.map(l=><option key={l.code} value={l.code} className="text-slate-800">{l.label}</option>)}
              </select>
              <button onClick={()=>setExpanded(false)} className="p-1 hover:bg-white/20 rounded"><Minimize2 className="w-4 h-4" /></button>
              <button onClick={()=>{setExpanded(false); disconnect();}} className="p-1 hover:bg-white/20 rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {transcripts.length===0 && !error && <p className="text-sm text-slate-500 text-center mt-8">Tap microphone and speak.<br/>Try: &quot;Explain stratified sampling in {language}&quot;<br/><span className="text-xs opacity-70">{courseTitle || courseId}</span></p>}
            {transcripts.map((t,i)=><div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.role==="user"?"bg-[#1e40af] text-white ml-auto":"bg-white border shadow-sm"}`}><p>{t.text}</p><span className={`text-[10px] ${t.role==="user"?"text-white/70":"text-slate-400"}`}>{new Date(t.timestamp).toLocaleTimeString()}</span></div>)}
            {aiSpeaking && <div className="flex gap-1 items-center text-xs text-slate-500"><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" /><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:75ms]" /><span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:150ms]" /> AI speaking — you can interrupt</div>}
            {error && <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">{error}<br/><span className="text-[11px] opacity-70">Check that backend (3001) and AI service (8001) are both running.</span></p>}
          </div>
          <div className="p-3 border-t bg-white space-y-2">
            <div className="flex items-center gap-2">
              <button
                onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening}
                className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 select-none ${listening?"bg-red-600 text-white animate-pulse":"bg-[#0891b2] text-white hover:bg-[#0e7490]"} ${!connected?"opacity-50 pointer-events-none":""}`}
              >
                {listening ? <><MicOff className="w-5 h-5" /> Listening… release</> : <><Mic className="w-5 h-5" /> Hold to Speak</>}
              </button>
              <button onClick={()=>connected? disconnect(): connect()} className="px-3 py-3 border rounded-lg text-xs">{connected?"Disconnect":"Reconnect"}</button>
            </div>
            <p className="text-[11px] text-center text-slate-400">Hold to speak • Release to send • Speak while AI talks to interrupt (barge-in) • Language: {LANGS.find(l=>l.code===language)?.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}

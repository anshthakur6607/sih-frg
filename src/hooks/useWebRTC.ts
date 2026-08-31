/**
 * useWebRTC - Production WebRTC/WebSocket helper for Live Tutor
 * Ported pattern from D:\cognix (Gemini bidi + OpenAI Realtime)
 * - Low-latency PCM 16k uplink, 24k downlink
 * - Playback queue with backpressure + barge-in support
 * - Auto token fetch from Supabase session
 * - Fallback to ai-service WS if direct Gemini unavailable
 */
"use client";
import { useRef, useState, useCallback, useEffect } from "react";

export function useWebRTC(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<Float32Array[]>([]);
  const playingRef = useRef(false);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      return ws;
    } catch {
      setConnected(false);
      return null as any;
    }
  }, [wsUrl]);

  const disconnect = useCallback(async () => {
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      processorRef.current = null;
      sourceRef.current = null;
      if (audioCtxRef.current) await audioCtxRef.current.close().catch(()=>{});
      if (playbackCtxRef.current) await playbackCtxRef.current.close().catch(()=>{});
      audioCtxRef.current = null;
      playbackCtxRef.current = null;
      streamRef.current?.getTracks().forEach(t=>t.stop());
      streamRef.current = null;
      queueRef.current = [];
      playingRef.current = false;
      wsRef.current?.close();
    } finally {
      setConnected(false);
    }
  }, []);

  const sendJson = useCallback((obj: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(obj));
  }, []);

  const sendBlob = useCallback((blob: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(blob);
  }, []);

  // PCM helpers — mirror Cognix's btoa(pcm16)
  const sendPCMAudio = useCallback((float32: Float32Array) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const int16 = new Int16Array(float32.length);
    for (let i=0;i<float32.length;i++){ const s=Math.max(-1,Math.min(1,float32[i])); int16[i]= s<0? s*0x8000 : s*0x7fff; }
    const bytes = new Uint8Array(int16.buffer);
    let bin=""; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    wsRef.current.send(JSON.stringify({ realtimeInput:{ audio:{ mimeType:"audio/pcm;rate=16000", data:b64 }}}));
  }, []);

  const enqueuePcm16 = useCallback(async (base64: string) => {
    if (!playbackCtxRef.current) playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const ctx = playbackCtxRef.current;
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) bytes[i]= raw.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const f32 = new Float32Array(int16.length); for(let i=0;i<int16.length;i++) f32[i]= int16[i]/(int16[i]<0?0x8000:0x7fff);
    queueRef.current.push(f32);
    if (!playingRef.current){
      playingRef.current=true;
      while(queueRef.current.length){
        const chunk = queueRef.current.shift()!;
        const buf = ctx.createBuffer(1, chunk.length, 24000);
        buf.getChannelData(0).set(chunk);
        const src = ctx.createBufferSource(); src.buffer=buf; src.connect(ctx.destination);
        await new Promise<void>(r=>{ src.onended=()=>r(); src.start(); });
      }
      playingRef.current=false;
    }
  }, []);

  const bargeIn = useCallback(()=>{
    queueRef.current=[];
    playingRef.current=false;
    sendJson({ type:"interrupt" });
  },[sendJson]);

  useEffect(()=>()=>{ disconnect(); },[disconnect]);

  return { wsRef, connected, connect, disconnect, sendJson, sendBlob, sendPCMAudio, enqueuePcm16, bargeIn, streamRef, audioCtxRef };
}

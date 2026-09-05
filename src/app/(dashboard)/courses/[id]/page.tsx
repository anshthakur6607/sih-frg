/**
 * Course Player Page - /courses/[id]
 * iGOT video player + WebRTCLiveTutor overlay + module progress
 */
"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import WebRTCLiveTutor from "@/components/WebRTCLiveTutor";
import { createClient } from "@/lib/supabase";
import { aiApi } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import AutoTranslate from "@/components/AutoTranslate";
import { Clock, MapPin, BookOpen, CheckCircle, Sparkles, Send, Loader2, Mic, MicOff, Languages, MessageSquare, GraduationCap, Volume2, FileText, HelpCircle, Lightbulb } from "lucide-react";

export default function CoursePlayerPage() {
  const params = useParams() as { id: string };
  const courseId = params.id;
  const supabase = createClient();
  const [course, setCourse] = useState<any>(null);
  const [timestamp, setTimestamp] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [notFound, setNotFound] = useState(false);
  const [materials, setMaterials] = useState<Array<{ id: string; title: string; type: string; url: string; storage_path: string; content_text?: string }>>([]);
  const [genMatLoading, setGenMatLoading] = useState(false);
  useEffect(() => {
    supabase.from("courses").select("*").eq("id", courseId).single().then(({ data, error }) => {
      if (error || !data) setNotFound(true);
      else setCourse(data);
    });
    supabase.from("course_materials").select("id, title, type, url, storage_path, content_text").eq("course_id", courseId).then(({ data }) => {
      if (data) setMaterials(data as any);
    });
    supabase.from("course_enrollments").select("status, progress_percentage").eq("course_id", courseId).maybeSingle().then(({ data }) => {
      if (data?.status === "completed" || data?.progress_percentage >= 100) setCompleted(true);
    });
  }, [courseId, supabase]);

  // --- Course AI helper (scoped to this course) ---
  const { language: siteLang } = useLanguage();
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ role:"user"|"assistant"; content:string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLang, setAiLang] = useState("en");
  const [isSTT, setIsSTT] = useState(false);
  const sttRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ setAiLang(siteLang); },[siteLang]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); },[aiMessages]);
  const LANG_BCP: Record<string,string> = { en:"en-IN", hi:"hi-IN", bn:"bn-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN", gu:"gu-IN", kn:"kn-IN", ml:"ml-IN", or:"od-IN" };
  const LANG_TO_SARVAM_BCP: Record<string,string> = { en:"en-IN", hi:"hi-IN", bn:"bn-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN", gu:"gu-IN", kn:"kn-IN", ml:"ml-IN", or:"od-IN" };
  // Sarvam STT for course AI — replaces browser SpeechRecognition (Hindi often wrong/empty with Web Speech API)
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const toggleCourseSTT = () => {
    if (isSTT) { mediaRecorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { alert("Audio recording not supported — type your question."); return; }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const rec = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = rec; sttRef.current = rec as any; audioChunksRef.current = [];
        rec.ondataavailable = (e:any)=>{ if(e.data?.size) audioChunksRef.current.push(e.data); };
        rec.onstop = async () => {
          stream.getTracks().forEach(t=>t.stop()); setIsSTT(false);
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size < 1200) return;
          try {
            const { data:{ session} } = await supabase.auth.getSession();
            const form = new FormData();
            const ext = mimeType.includes("mp4") ? "mp4" : "webm";
            form.append("file", blob, `course-${Date.now()}.${ext}`);
            form.append("language_code", LANG_TO_SARVAM_BCP[aiLang] || "unknown");
            const r = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/speech-to-text`, { method:"POST", headers:{ Authorization:`Bearer ${session?.access_token||""}` }, body: form });
            const j = await r.json().catch(()=>({}));
            if (!r.ok) {
              if (r.status===422) { /* silence */ return; }
              throw new Error(j.error||`STT ${r.status}`);
            }
            const tr = j.data?.transcript || "";
            const det = j.data?.language_code || "";
            const rev: Record<string,string>={"en-IN":"en","hi-IN":"hi","bn-IN":"bn","ta-IN":"ta","te-IN":"te","mr-IN":"mr","gu-IN":"gu","kn-IN":"kn","ml-IN":"ml","od-IN":"or","pa-IN":"pa"};
            if(det && rev[det] && rev[det]!==aiLang) setAiLang(rev[det]);
            if(tr) setAiInput(prev=> (prev?prev+" ":"")+tr);
          } catch(e:any){ console.warn("Sarvam STT failed", e.message); }
        };
        rec.start(); setIsSTT(true);
      } catch(e:any){ alert(e.message||"Microphone permission required"); setIsSTT(false); }
    })();
  };
  const sendCourseAI = async (preset?: string) => {
    const msg = (preset || aiInput).trim(); if(!msg || aiLoading || !course) return;
    setAiMessages(p=>[...p,{role:"user", content: msg}]); setAiInput(""); setAiLoading(true);
    try{
      const { data:{ user } } = await supabase.auth.getUser();
      const r = await aiApi.chat({ message: msg, course_id: courseId, user_id: user?.id || "anon", language: aiLang });
      const answer = (r as any)?.data?.answer || (r as any)?.answer || "No response — check AI service (port 8001) and GOOGLE_API_KEY.";
      const srcs = (r as any)?.data?.sources || [];
      const withSrc = srcs.length ? answer + "\n\nSources: " + srcs.map((s:any)=>s.preview?.slice(0,60)).join(" | ") : answer;
      setAiMessages(p=>[...p,{role:"assistant", content: withSrc}]);
    }catch(e:any){
      setAiMessages(p=>[...p,{role:"assistant", content: `AI error: ${e.message} — ensure backend 3001 & AI 8001 running.`}]);
    }finally{ setAiLoading(false); }
  };
  const askPreset = (kind: "summary"|"questions"|"explain") => {
    if(kind==="summary") return sendCourseAI(`Summarize this course "${course?.title}" in ${aiLang} in 6 bullet points using its PDF and video content.`);
    if(kind==="questions") return sendCourseAI(`Create 5 practice MCQs from "${course?.title}" PDFs with answers and 1-line explanations. Use bloom levels remember→apply. Language: ${aiLang}.`);
    return sendCourseAI(`Explain one hard concept from "${course?.title}" like I'm new — step-by-step with an example. Language: ${aiLang}.`);
  };
  const handleGenerateMaterial = async () => {
    if (!course) return;
    setGenMatLoading(true);
    try {
      const supabase2 = createClient();
      const { data:{ session} } = await supabase2.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/materials/generate/${courseId}`, {
        method: "POST", headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j.error || `Generate failed ${res.status}`);
      // refetch materials
      const { data } = await supabase.from("course_materials").select("id, title, type, url, storage_path").eq("course_id", courseId);
      if (data) setMaterials(data as any);
    } catch(e:any){ alert(e.message); } finally { setGenMatLoading(false); }
  };

  const handleMarkComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("course_enrollments").upsert({
      user_id: user.id,
      course_id: courseId,
      status: "completed",
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    }, { onConflict: "user_id,course_id" });
    if (error) {
      alert(`Could not mark course complete: ${error.message}`);
      return;
    }
    setCompleted(true);
  };

  if (notFound) return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold">Course not found</h2>
      <p className="text-slate-600 mt-2">This course may not exist or the seed data hasn't been run yet.</p>
      <p className="text-sm text-slate-500 mt-1">Run <code>backend/supabase/seed_courses.sql</code> and <code>seed_igot_portal.sql</code> in Supabase, then refresh.</p>
      <a href="/courses" className="inline-block mt-4 bg-[#1e40af] text-white px-4 py-2 rounded">Back to Catalog</a>
    </div>
  );
  if (!course) return <div className="p-8">Loading course...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900"><AutoTranslate text={course.title} /></h1>
        <p className="text-slate-600 flex items-center gap-2"><BookOpen className="w-4 h-4" /> {course.provider} • {course.duration_hours}h {course.is_tpac_classroom && <><MapPin className="w-4 h-4" />{course.tpac_location}</>}</p>
      </div>
      <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
        {course.course_url ? (
          <iframe src={course.course_url} className="w-full h-full" allow="autoplay; fullscreen" title={course.title} onLoad={() => setTimestamp(t => t+1)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white bg-gradient-to-br from-[#1e40af] to-[#0891b2]">
            <div className="text-center">
              <p className="text-lg font-semibold">Course Video Player</p>
              <p className="text-sm opacity-80">iGOT content would embed here: {course.title}</p>
              <button onClick={()=>setTimestamp(t=>t+10)} className="mt-4 bg-white text-[#1e40af] px-4 py-2 rounded">Simulate +10s</button>
              <p className="text-xs mt-2">Timestamp: {timestamp}s</p>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white rounded-lg p-4 border flex items-center justify-between">
        <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Duration: {course.duration_hours} hours</div>
        <div className="flex items-center gap-2">
          <button onClick={handleMarkComplete} disabled={completed} className={`px-4 py-2 rounded font-medium ${completed ? "bg-green-600 text-white" : "bg-[#1e40af] text-white"}`}>{completed ? <><CheckCircle className="w-4 h-4 inline mr-1" /> Completed</> : "Mark Complete"}</button>
          {completed && <Link href={`/quiz/${courseId}`} className="px-4 py-2 rounded font-medium bg-amber-500 text-white hover:bg-amber-600">Take Course Exam</Link>}
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 border">
        <h3 className="font-semibold mb-2">About this course</h3>
        <p className="text-sm text-slate-600"><AutoTranslate text={course.description || "No description"} as="span" /></p>
        <div className="mt-3 flex flex-wrap gap-2">{(course.target_competencies || []).map((c:string)=><span key={c} className="bg-cyan-50 text-cyan-700 px-2 py-1 rounded text-xs">{c}</span>)}</div>
      </div>
      <div className="bg-white rounded-lg p-4 border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4" /> Study Materials & PDFs {materials.length > 0 && <span className="text-xs font-normal text-slate-500">({materials.length})</span>}</h3>
          {materials.length === 0 && <button onClick={handleGenerateMaterial} disabled={genMatLoading} className="text-xs bg-[#1e40af] text-white px-3 py-1.5 rounded flex items-center gap-1">{genMatLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Generate Study Material (AI)</button>}
        </div>
        {materials.length === 0 ? (
          <p className="text-sm text-slate-500">No study material for this course yet. Click <b>Generate Study Material</b> to create a PDF + AI content so Course AI, quiz and Live Tutor work — or run <code>backend/supabase/generate_missing_materials.sql</code> to fill all courses at once. Materials are stored in <code>course_materials</code> as fallback and replaced by live iGOT fetch when configured.</p>
        ) : (
          <ul className="space-y-2">
            {materials.map(m => (
              <li key={m.id} className="flex items-start justify-between gap-3 p-2 bg-slate-50 rounded border">
                <div>
                  <p className="text-sm font-medium text-slate-900"><AutoTranslate text={m.title} /></p>
                  <p className="text-xs text-slate-500">{m.type} {m.storage_path && `• ${m.storage_path}`}</p>
                </div>
                {m.url ? (
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-xs bg-[#1e40af] text-white px-3 py-1.5 rounded shrink-0">View PDF</a>
                ) : (
                  <span className="text-xs text-slate-400">No link</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400 mt-2">PDFs are stored in DB (<code>course_materials.url</code> / <code>storage_path</code>) as fallback; when iGOT API is live, materials are fetched live from iGOT and not hardcoded in code.</p>
      </div>

      {/* --- Course AI Suite --- */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Course AI Helper (text) */}
        <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[520px] overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e40af] to-[#0891b2] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><span className="font-semibold text-sm">Course AI</span><span className="text-xs opacity-80 hidden sm:inline truncate max-w-[160px]">— {course.title}</span></div>
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 opacity-80" />
              <select value={aiLang} onChange={e=>setAiLang(e.target.value)} className="bg-white/20 text-white text-xs rounded px-2 py-1">
                <option value="en" className="text-slate-800">English</option>
                <option value="hi" className="text-slate-800">हिन्दी</option>
                <option value="ta" className="text-slate-800">தமிழ்</option>
                <option value="te" className="text-slate-800">తెలుగు</option>
                <option value="mr" className="text-slate-800">मराठी</option>
                <option value="bn" className="text-slate-800">বাংলা</option>
                <option value="gu" className="text-slate-800">ગુજરાતી</option>
                <option value="kn" className="text-slate-800">ಕನ್ನಡ</option>
                <option value="ml" className="text-slate-800">മലയാളം</option>
                <option value="or" className="text-slate-800">ଓଡ଼ିଆ</option>
              </select>
            </div>
          </div>
          <div className="px-3 py-2 bg-slate-50 border-b flex flex-wrap gap-2">
            <button onClick={()=>askPreset("summary")} className="text-xs bg-white border px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1"><FileText className="w-3 h-3" /> Summarize</button>
            <button onClick={()=>askPreset("questions")} className="text-xs bg-white border px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Practice Qs</button>
            <button onClick={()=>askPreset("explain")} className="text-xs bg-white border px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Explain concept</button>
            <button onClick={()=>sendCourseAI(`Solve a problem from ${course.title} step-by-step`)} className="text-xs bg-white border px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Solve problem</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {aiMessages.length===0 && <div className="text-center text-sm text-slate-500 mt-8"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Ask anything about <b>{course.title}</b> — it knows your PDFs, description & video.<br/>Try <i>“Give me practice questions”</i> or speak via mic.</p></div>}
            {aiMessages.map((m,i)=><div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role==="user"?"bg-[#1e40af] text-white ml-auto":"bg-white border shadow-sm"}`}><p className="whitespace-pre-wrap">{m.content}</p></div>)}
            {aiLoading && <div className="flex gap-1 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Thinking with course PDFs…</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t bg-white flex items-end gap-2">
            <textarea value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendCourseAI(); }}} placeholder={isSTT?"Listening… speak now":"Ask about this course — or tap mic to speak"} rows={1} className={`flex-1 border rounded-lg px-3 py-2 text-sm resize-none ${isSTT?"ring-2 ring-red-200 bg-red-50":""}`} />
            <button onClick={toggleCourseSTT} title={isSTT?"Stop":"Speak"} className={`p-2.5 rounded-lg border ${isSTT?"bg-red-600 text-white animate-pulse":"bg-white hover:bg-slate-50"}`}>{isSTT?<MicOff className="w-4 h-4"/>:<Mic className="w-4 h-4"/>}</button>
            <button onClick={()=>sendCourseAI()} disabled={!aiInput.trim() || aiLoading} className="bg-[#1e40af] text-white p-2.5 rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-center text-slate-400 pb-2">Uses course PDF + video context • You can interrupt live tutor by speaking • Language: {aiLang}</p>
        </div>

        {/* Live Voice Tutor (inline card + overlay helper) */}
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Volume2 className="w-5 h-5 text-[#1e40af]" /> Live Voice Tutor <span className="text-xs font-normal text-slate-500">— WebRTC • Barge-in • {aiLang}</span></h3>
          <p className="text-sm text-slate-600">Tap <b>Ask AI Tutor</b> (floating bottom-right) to start a full-duplex voice session. It loads <b>{course.title}</b> PDFs + video + description as RAG context, speaks in <b>{aiLang}</b>, and lets you <b>interrupt by speaking</b> while it talks.</p>
          <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
            <li>Voice is streamed via Gemini bidi (PCM 16k uplink / 24k downlink, queued playback).</li>
            <li>Language selector in widget header changes TTS/STT instantly (10 Indian languages).</li>
            <li>Session resumes where you left off — timestamp + transcript saved to <code>tutor_sessions</code>.</li>
          </ul>
          <div className="bg-slate-50 rounded-lg p-3 border text-xs text-slate-700">
            <p className="font-medium mb-1">Try saying:</p>
            <p>“Explain {course.title} in {aiLang} with an example” → interrupt → “Now give me a practice question”</p>
          </div>
          <Link href={`/live-tutor?courseId=${courseId}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm text-indigo-700 font-medium hover:text-indigo-800 hover:underline">
            <Volume2 className="w-4 h-4" /> Open in Full Screen Live AI Tutor <span className="text-xs font-normal text-slate-400">→</span>
          </Link>
          <p className="text-xs text-slate-400">If mic fails, use the Course AI text box above — it shares the same course RAG.</p>
        </div>
      </div>
    </div>
  );
}

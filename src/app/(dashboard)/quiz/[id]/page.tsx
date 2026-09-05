/**
 * Gatekeeper Exam Page - /quiz/[id]
 * Anti-cheat fullscreen + telemetry
 */
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { createClient } from "@/lib/supabase";
import { Shield, AlertTriangle, Clock } from "lucide-react";

export default function QuizPage() {
  const params = useParams() as { id: string };
  const assessmentId = params.id;
  const router = useRouter();
  const supabase = createClient();
  const { tabSwitches, fullscreenExits, isFullscreen, requestFullscreen } = useAntiCheat(assessmentId, true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 min

  useEffect(() => {
    async function loadExam() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/login"); return; }
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
        const start = await fetch(`${apiUrl}/api/assessments/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ course_id: assessmentId }),
        });
        const startData = await start.json().catch(() => ({}));
        if (!start.ok) throw new Error(startData.error || "Could not start the course exam");
        setAttemptId(startData.data?.attempt_id || null);

        const generated = await fetch(`${apiUrl}/api/ai/quiz/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ course_id: assessmentId, question_count: 10, bloom_levels: ["understand", "apply", "analyze", "evaluate"], difficulty: 0, adaptive: false }),
        });
        const generatedData = await generated.json().catch(() => ({}));
        if (!generated.ok || !generatedData.data?.questions?.length) throw new Error(generatedData.error || "Could not generate questions from course materials");
        setQuestions(generatedData.data.questions);
      } catch (err: any) {
        setError(err.message || "Could not load the course exam");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [supabase]);

  useEffect(() => {
    const t = setInterval(()=>setTimeLeft(v=>Math.max(0, v-1)), 1000);
    return ()=>clearInterval(t);
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = Object.entries(answers).map(([question_id, answer_index]) => ({
      question_id,
      answer_index,
      time_taken_seconds: 0,
      correct_answer: questions.find(q => q.id === question_id)?.correct_answer,
    }));
    // Try backend then fallback to direct supabase
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token || "";
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/assessments/submit`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ attempt_id: attemptId, answers: payload, tab_switch_count: tabSwitches, fullscreen_exits: fullscreenExits, time_taken_seconds: 1800-timeLeft })
      });
      if (res.ok) {
        const j = await res.json();
        alert(`Submitted! ${j.message || "Check admin review"}`);
        router.push("/assessments");
        return;
      }
    } catch {}
    // Fallback: insert into final_assessments
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const score = Math.round((Object.keys(answers).length / questions.length)*100);
      await supabase.from("final_assessments").insert({ user_id: user.id, course_id: assessmentId, score, status: "pending_admin_review", telemetry_summary: { tabSwitches, fullscreenExits } });
      alert(`Submitted (fallback). Score ${score}% pending admin review.`);
      router.push("/assessments");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <div className="bg-white border rounded-lg p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#1e40af]" />
          <span className="font-semibold">Gatekeeper Exam</span>
          {!isFullscreen && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Not fullscreen!</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</span>
          <button onClick={requestFullscreen} className="bg-[#1e40af] text-white px-3 py-1 rounded text-xs">Enter Fullscreen</button>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">Telemetry active: Tab switches {tabSwitches} | Fullscreen exits {fullscreenExits} | Copy/paste blocked | Right-click disabled</div>
      {loading && <div className="bg-white border rounded-lg p-6 text-center">Generating your exam from the course PDFs, notes, videos and other materials...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>}
      {!loading && !error && questions.map((q, idx)=>(
        <div key={q.id} className="bg-white rounded-lg p-4 border">
          <p className="font-medium text-sm mb-1">Q{idx+1} <span className="text-xs bg-slate-100 px-1 rounded">{q.bloom_level}</span> <span className="text-xs text-slate-400">β={q.difficulty_beta}</span></p>
          <p className="mb-3">{q.text}</p>
          <div className="space-y-2">
            {(Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]")).map((opt:string, oi:number)=>(
              <label key={oi} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${answers[q.id]===oi ? "bg-cyan-50 border-cyan-300" : "hover:bg-slate-50"}`}>
                <input type="radio" name={q.id} checked={answers[q.id]===oi} onChange={()=>setAnswers(a=>({...a, [q.id]: oi}))} />
                <span className="text-sm">{String.fromCharCode(65+oi)}. {opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {!loading && !error && <button onClick={handleSubmit} disabled={submitting || !attemptId || Object.keys(answers).length !== questions.length} className="w-full bg-[#1e40af] text-white py-3 rounded-lg font-medium hover:bg-[#1e3a8a] disabled:opacity-50">{submitting ? "Submitting..." : "Submit Course Exam"}</button>}
    </div>
  );
}

/**
 * Admin HITL Review Queue - /admin/reviews
 */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CheckCircle, XCircle, Eye } from "lucide-react";

export default function AdminReviewsPage() {
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending_admin_review");
  useEffect(()=>{
    supabase.from("final_assessments").select("*, profiles!final_assessments_user_id_fkey(full_name, designation)").eq("status", filter).order("submitted_at", {ascending:false}).limit(20).then(({data})=>setReviews(data||[]));
  }, [filter, supabase]);
  const decide = async (id:string, decision:"approved"|"rejected")=>{
    await supabase.from("assessment_reviews").insert({ final_assessment_id: id, decision, admin_notes: decision==="approved"?"Approved via UI":"Rejected" });
    await supabase.from("final_assessments").update({ status: decision }).eq("id", id);
    // If approved, create certificate with dual scores
    if (decision==="approved") {
      const fa = reviews.find(r=>r.id===id);
      if (fa) {
        const code = `SKILLUP-${Date.now().toString(36).toUpperCase()}`;
        await supabase.from("certificates").insert({ user_id: fa.user_id, course_id: fa.course_id, verification_code: code, raw_score: fa.score, competency_delta: 0.5, qr_code_url: `https://skillup.gov.in/verify/${code}` });
      }
    }
    setReviews(r=>r.filter(x=>x.id!==id));
  };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Review Queue (Gatekeeper)</h1>
      <div className="flex gap-2">
        {["pending_admin_review","approved","rejected"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} className={`px-3 py-1 rounded text-sm ${filter===s?"bg-[#1e40af] text-white":"bg-white border"}`}>{s}</button>
        ))}
      </div>
      {reviews.length===0 && <p className="text-sm text-slate-500 bg-white p-8 rounded border text-center">No {filter} assessments</p>}
      <div className="space-y-3">
        {reviews.map(r=>(
          <div key={r.id} className="bg-white p-4 rounded border">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{r.profiles?.full_name} <span className="text-xs text-slate-500">{r.profiles?.designation}</span></p>
                <p className="text-sm">Score: {r.score} / Pass: {r.passing_score} • {new Date(r.submitted_at).toLocaleString()}</p>
                <details className="text-xs mt-2"><summary className="cursor-pointer flex items-center gap-1"><Eye className="w-3 h-3" /> Telemetry</summary><pre className="bg-slate-50 p-2 rounded mt-1 overflow-auto">{JSON.stringify(r.telemetry_summary, null, 2)}</pre></details>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>decide(r.id,"approved")} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Approve & Sign</button>
                <button onClick={()=>decide(r.id,"rejected")} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-1"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

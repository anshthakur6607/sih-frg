"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CheckCircle, XCircle, Eye } from "lucide-react";

export default function AdminReviewsPage() {
  const supabase = createClient();
  const [reviews, setReviews] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/admin/reviews?status=${filter}`, { headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
      const json = await res.json().catch(() => ({}));
      setReviews(json.data || []);
    })();
  }, [filter, supabase]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    const session = (await supabase.auth.getSession()).data.session;
    const review = reviews.find((r) => r.id === id);
    const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/admin/reviews/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify({ final_verified_score: Number(review?.auto_score || 0), review_status: decision, admin_notes: decision === "approved" ? "Approved via admin review" : "Rejected via admin review" }),
    });
    if (!res.ok) { const json = await res.json().catch(() => ({})); alert(json.error || "Review failed"); return; }
    setReviews((r) => r.filter((x) => x.id !== id));
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Admin Review Queue (Gatekeeper)</h1>
    <div className="flex gap-2">{["pending", "approved", "rejected", "flagged"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded text-sm ${filter === s ? "bg-[#1e40af] text-white" : "bg-white border"}`}>{s}</button>)}</div>
    {reviews.length === 0 && <p className="text-sm text-slate-500 bg-white p-8 rounded border text-center">No {filter} assessments</p>}
    <div className="space-y-3">{reviews.map((r) => <div key={r.id} className="bg-white p-4 rounded border"><div className="flex justify-between"><div>
      <p className="font-medium">{r.user?.full_name || "Unknown learner"} <span className="text-xs text-slate-500">{r.user?.designation}</span></p>
      <p className="text-sm">{r.course?.title || "Course exam"} · Auto score: {Number(r.auto_score || 0).toFixed(1)}% · {new Date(r.created_at).toLocaleString()}</p>
      <details className="text-xs mt-2"><summary className="cursor-pointer flex items-center gap-1"><Eye className="w-3 h-3" /> Telemetry</summary><pre className="bg-slate-50 p-2 rounded mt-1 overflow-auto">{JSON.stringify({ tab_switch_count: r.tab_switch_count, fullscreen_exits: r.fullscreen_exits, telemetry_flags: r.telemetry_flags }, null, 2)}</pre></details>
    </div>{r.review_status === "pending" && <div className="flex gap-2"><button onClick={() => decide(r.id, "approved")} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Approve & Sign</button><button onClick={() => decide(r.id, "rejected")} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-1"><XCircle className="w-4 h-4" /> Reject</button></div>}</div></div>)}</div>
  </div>;
}

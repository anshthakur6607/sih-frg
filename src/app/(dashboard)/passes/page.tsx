/**
 * ID Passes — QR-Enabled Investigator Identity (PDF Template 2)
 * Shows user's own passes + admin can issue new passes
 */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Award, Shield, ExternalLink, Plus, MapPin } from "lucide-react";

interface Pass {
  id: string;
  verification_code: string;
  des_name: string;
  state: string;
  district: string;
  designation: string;
  valid_from?: string;
  valid_until?: string;
  status: string;
  verify_url?: string;
  qr_api_url?: string;
}

export default function PassesPage() {
  const supabase = createClient();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ des_name:"DES Bihar", state:"Bihar", district:"Patna", designation:"Enumerator" });
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data:{ user} } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setIsAdmin(prof?.role==="admin");
      const { data:{ session} } = await supabase.auth.getSession();
      const token = session?.access_token||"";
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||"http://localhost:3001"}/api/investigator-passes`,{headers:{Authorization:`Bearer ${token}`}});
      const j = await r.json().catch(()=>({}));
      setPasses(j.data||[]);
      setLoading(false);
    })();
  }, []);

  const issuePass = async () => {
    setIssuing(true);
    try{
      const { data:{ user} } = await supabase.auth.getUser();
      const { data:{ session} } = await supabase.auth.getSession();
      const token = session?.access_token||"";
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||"http://localhost:3001"}/api/investigator-passes`,{
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ user_id: user?.id, des_name: form.des_name, state: form.state, district: form.district, designation: form.designation })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Failed");
      setPasses(p=>[j.data, ...p]);
      alert(`Pass issued: ${j.data.verification_code}`);
    }catch(e:any){ alert(e.message); } finally{ setIssuing(false); }
  };

  if(loading) return <div className="p-8 text-center">Loading passes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary-800" /> Investigator ID Passes</h1>
          <p className="text-surface-600 text-sm">QR-enabled, skill-tied, tamper-proof — PDF Template 2. Show QR to respondents for legitimacy.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Plus className="w-4 h-4" /> Issue New Pass (Admin)</h3>
          <div className="grid md:grid-cols-4 gap-2">
            <input value={form.des_name} onChange={e=>setForm({...form, des_name:e.target.value})} placeholder="DES Name" className="border rounded px-3 py-2 text-sm" />
            <input value={form.state} onChange={e=>setForm({...form, state:e.target.value})} placeholder="State" className="border rounded px-3 py-2 text-sm" />
            <input value={form.district} onChange={e=>setForm({...form, district:e.target.value})} placeholder="District" className="border rounded px-3 py-2 text-sm" />
            <input value={form.designation} onChange={e=>setForm({...form, designation:e.target.value})} placeholder="Designation" className="border rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={issuePass} disabled={issuing} className="mt-3 bg-primary-800 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{issuing?"Issuing...":"Issue QR Pass"}</button>
        </div>
      )}

      {passes.length===0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-surface-300 mb-3" />
          <p className="font-medium">No passes yet</p>
          <p className="text-sm text-surface-500">Complete a certification or ask admin to issue your DES investigator pass. It will appear here with QR.</p>
          {isAdmin && <p className="text-xs text-surface-400 mt-2">Admin: use form above to issue for current user (demo). In production, issue per field batch.</p>}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {passes.map(p=>(
            <div key={p.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-primary-800 to-cyan-600 text-white p-4">
                <p className="text-xs opacity-80 flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.des_name} • {p.state} {p.district?`• ${p.district}`:""}</p>
                <p className="font-semibold">{p.designation} — Investigator</p>
                <p className="text-xs opacity-70">Valid: {p.valid_from||"-"} → {p.valid_until||"-"} • {p.status}</p>
              </div>
              <div className="p-4 flex gap-4">
                <div className="shrink-0 bg-white border rounded p-2">
                  <img src={p.qr_api_url || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(p.verify_url || `http://localhost:3000/verify/pass/${p.verification_code}`)}`} alt="QR" className="w-[140px] h-[140px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-500">Verification Code</p>
                  <code className="bg-surface-50 px-2 py-1 rounded text-xs font-mono break-all">{p.verification_code}</code>
                  <a href={`/verify/pass/${p.verification_code}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"><ExternalLink className="w-3 h-3" /> Verify (public)</a>
                  <p className="text-xs text-surface-400 mt-2">Skill-tied: linked to your verified competencies. Scan at household to prove official authority.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

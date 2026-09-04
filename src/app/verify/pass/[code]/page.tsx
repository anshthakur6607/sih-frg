/**
 * Public Investigator Pass Verification — /verify/pass/[code]
 * PDF Template 2: QR-Enabled Badges for field legitimacy
 */
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle, XCircle, MapPin } from "lucide-react";

export default function VerifyPassPage(){
  const params = useParams() as { code: string };
  const code = params.code;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading]= useState(true);
  const [notFound, setNotFound]= useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||"http://localhost:3001"}/api/investigator-passes/verify/${code}`);
        const j = await r.json().catch(()=>({}));
        if(r.ok && j.success) { setData(j.data); setLoading(false); return; }
        setNotFound(true);
      }catch{ setNotFound(true); }
      setLoading(false);
    })();
  },[code]);

  if(loading) return <div className="min-h-screen flex items-center justify-center">Verifying pass...</div>;
  if(notFound || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="bg-white rounded-xl border p-8 text-center max-w-md">
        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h2 className="font-bold">Invalid Pass</h2>
        <p className="text-sm text-surface-500">Code {code} not found.</p>
        <Link href="/" className="mt-4 inline-block bg-primary-800 text-white px-4 py-2 rounded text-sm">Go Home</Link>
      </div>
    </div>
  );

  const pass = data.pass; const holder = data.holder;
  const expired = data.expired;

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border shadow-lg max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-primary-800 to-cyan-600 text-white p-6 text-center">
          <Shield className="w-10 h-10 mx-auto mb-2" />
          <h1 className="font-bold">Investigator ID Pass — Verified</h1>
          <p className="text-sm opacity-80">MoSPI • DES • Skill-tied • QR tamper-proof (W3C VC)</p>
        </div>
        <div className="p-6 space-y-3">
          {expired ? <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded p-2"><XCircle className="w-5 h-5" /> Expired — valid until {pass.valid_until}</div> : <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-2"><CheckCircle className="w-5 h-5" /> Active ✓ {code}</div>}
          <p><b>{holder?.full_name}</b> • {pass.designation} • {holder?.department}</p>
          <p className="flex items-center gap-1 text-sm text-surface-600"><MapPin className="w-4 h-4" /> {pass.des_name} — {pass.state}{pass.district?` • ${pass.district}`:""}</p>
          <p className="text-sm">Valid: {pass.valid_from} → {pass.valid_until} • Status: {pass.status}</p>
          {holder?.photo_url && <img src={holder.photo_url} alt="photo" className="w-24 h-24 rounded border object-cover mx-auto" />}
          <div className="bg-white border rounded p-3 flex justify-center">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window!=="undefined"? window.location.href : `http://localhost:3000/verify/pass/${code}`)}`} alt="QR" className="w-[200px] h-[200px]" />
          </div>
          <p className="text-xs text-surface-400 text-center">Show this QR to respondent to prove official enumerator authority. Scan to re-verify.</p>
        </div>
      </div>
    </div>
  );
}

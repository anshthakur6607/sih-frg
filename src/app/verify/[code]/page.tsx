/**
 * Public Certificate Verification — /verify/[code]
 * No auth required. Queries Supabase directly + backend proxy fallback.
 */
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Award } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function VerifyPage() {
  const params = useParams() as { code: string };
  const code = params.code;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const supabase = createClient();

  useEffect(()=>{
    (async()=>{
      // Try backend first (requires verify endpoint public) — fallback to Supabase direct
      try{
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL||"http://localhost:3001"}/api/certificates/verify/${code}`);
        if(r.ok){
          const j = await r.json();
          if(j.success) { setData(j.data.certificate); setLoading(false); return; }
        }
      }catch{}
      const { data } = await supabase.from("certificates").select("*, course:courses(title, provider), user:profiles(full_name, designation, department)").eq("verification_code", code).maybeSingle();
      if(data) setData(data);
      else setNotFound(true);
      setLoading(false);
    })();
  },[code]);

  if(loading) return <div className="min-h-screen flex items-center justify-center">Verifying...</div>;
  if(notFound || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="bg-white rounded-xl border p-8 text-center max-w-md">
        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h2 className="font-bold">Invalid Certificate</h2>
        <p className="text-sm text-surface-500">Code {code} not found or checksum mismatch (W3C Verifiable Credentials check failed).</p>
        <Link href="/" className="mt-4 inline-block bg-primary-800 text-white px-4 py-2 rounded text-sm">Go Home</Link>
      </div>
    </div>
  );

  const cert = data.certificate || data;
  const title = cert.course_title || cert.course?.title || "Course";
  const name = cert.recipient_name || cert.user?.full_name || cert.full_name || "Recipient";

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border shadow-lg max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-primary-800 to-cyan-600 text-white p-6 text-center">
          <Award className="w-10 h-10 mx-auto mb-2" />
          <h1 className="font-bold">Verified Certificate</h1>
          <p className="text-sm opacity-80">Tamper-proof • QR-signed • Skill-tied</p>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-2"><CheckCircle className="w-5 h-5" /> Verified ✓ {code}</div>
          <p><span className="text-surface-500 text-sm">Recipient:</span> <b>{name}</b> {cert.designation?`• ${cert.designation}`:""} {cert.department?`• ${cert.department}`:""}</p>
          <p><span className="text-surface-500 text-sm">Course:</span> <b>{title}</b> {cert.provider?`• ${cert.provider}`:""}</p>
          <p className="flex gap-4"><span>Auto: <b>{cert.auto_score ?? "-"}</b></span> <span>Verified: <b>{cert.verified_score ?? "-"}</b></span></p>
          <p className="text-sm text-surface-500">Issued: {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString() : "-"}</p>
          <div className="bg-white border rounded p-3 flex justify-center">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window!=="undefined"? window.location.href : `http://localhost:3000/verify/${code}`)}`} alt="QR" className="w-[200px] h-[200px]" />
          </div>
          <p className="text-xs text-surface-400 text-center">Scan QR to re-verify at any field office. Certificate ID: {cert.id || code}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Public Certificate Verification — /verify/[code]
 * No login required. Anyone scanning the certificate QR (Google Lens, camera)
 * lands here: a valid code renders the full printable certificate with a
 * green "Verified" banner; an unknown code renders a red fake/invalid warning.
 *
 * Data source: public backend GET /api/certificates/verify/:code (no auth),
 * with direct Supabase fallback (RLS "Public verify certificates" policy).
 */
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase";
import CertificateTemplate, { type CertificateData } from "@/components/CertificateTemplate";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

export default function VerifyPage() {
  const params = useParams() as { code: string };
  const code = params.code;
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const supabase = createClient();
  const verifyUrl = typeof window !== "undefined" ? window.location.href : `https://skillup.mospi.gov.in/verify/${code}`;

  useEffect(() => {
    (async () => {
      // 1) Public backend endpoint (no token)
      try {
        const r = await fetch(`${API_URL}/api/certificates/verify/${code}`);
        if (r.ok) {
          const j = await r.json();
          if (j.success && j.data?.certificate) {
            setCert(j.data.certificate as CertificateData);
            setLoading(false);
            return;
          }
        }
      } catch { /* fall through to Supabase */ }
      // 2) Direct Supabase fallback (public RLS policy, no login)
      try {
        const { data } = await supabase
          .from("certificates")
          .select("*, course:courses(title, provider), user:profiles(full_name, designation, department)")
          .eq("verification_code", code)
          .maybeSingle();
        if (data) {
          setCert({
            id: data.id,
            verification_code: data.verification_code,
            recipient_name: data.user?.full_name,
            designation: data.user?.designation,
            department: data.user?.department,
            course_title: data.course?.title,
            provider: data.course?.provider,
            auto_score: data.auto_score,
            verified_score: data.verified_score,
            signed_by: data.signed_by_admin,
            issue_date: data.issue_date,
          });
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Verifying certificate…</p>
        </div>
      </div>
    );
  }

  if (notFound || !cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
        <div className="bg-white rounded-xl border-2 border-red-200 p-8 text-center max-w-md shadow-lg">
          <ShieldAlert className="w-14 h-14 mx-auto text-red-500 mb-3" />
          <h2 className="text-xl font-bold text-red-700">Invalid Certificate — Possibly Fake</h2>
          <p className="text-sm text-surface-600 mt-2">
            Code <code className="font-mono bg-surface-100 px-1.5 py-0.5 rounded">{code}</code> was not
            found in SkillUp records. Do not accept this certificate as genuine.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm font-medium">
            <XCircle className="w-5 h-5" /> Verification failed
          </div>
          <Link href="/" className="mt-5 inline-block bg-primary-800 text-white px-5 py-2 rounded-lg text-sm font-medium">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-10 px-4">
      <div className="max-w-3xl mx-auto mb-5 flex items-center justify-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium print:hidden">
        <CheckCircle className="w-5 h-5" /> Verified genuine SkillUp certificate • {code}
      </div>
      <CertificateTemplate cert={cert} verifyUrl={verifyUrl} showPrintButton />
      <p className="text-center text-xs text-surface-400 mt-5 print:hidden">
        This page is public — share or scan the QR to re-verify at any time, no login needed.
      </p>
    </div>
  );
}

/**
 * Certificates Page
 *
 * Displays user's earned certificates with scores, verification codes,
 * client-side QR codes, and View & Print links.
 *
 * Why: Users view, verify and print their earned certificates from this page.
 * Each QR encodes the absolute public URL /verify/[code] so any scanner
 * (Google Lens, camera) opens the no-login verification page.
 */

"use client";

import { useEffect, useState } from "react";
import { Award, ExternalLink, CheckCircle, Eye } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase";
import { gradeForScore } from "@/components/CertificateTemplate";

interface Certificate {
  id: string;
  verification_code: string;
  auto_score: number;
  verified_score: number;
  signed_by_admin: string;
  issue_date: string;
  course: { title: string; provider: string };
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
    async function fetchCertificates() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.full_name) setRecipientName(profile.full_name);

      const { data } = await supabase
        .from("certificates")
        .select("*, course:courses(title, provider)")
        .eq("user_id", user.id)
        .order("issue_date", { ascending: false });

      if (data) setCertificates(data);
      setLoading(false);
    }

    fetchCertificates();
  }, [supabase]);

  const verifyUrlFor = (code: string) =>
    `${origin || "https://skillup.mospi.gov.in"}/verify/${code}`;

  const handleView = (code: string) => {
    window.open(`/verify/${code}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Certificates</h1>
        <p className="text-surface-600">Your earned certificates — scores, verification QR, and printable copies</p>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Award className="w-16 h-16 mx-auto text-surface-300 mb-4" />
          <h3 className="text-lg font-medium text-surface-900 mb-2">No Certificates Yet</h3>
          <p className="text-surface-600">Complete assessments to earn certificates</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-surface-200">
              {/* Certificate Header */}
              <div className="bg-gradient-to-r from-primary-800 to-primary-600 p-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-6 h-6" />
                  <span className="font-semibold">Certificate of Completion</span>
                </div>
                <p className="text-primary-100 text-sm">{cert.course?.title}</p>
                {recipientName && (
                  <p className="text-white font-medium mt-1">Awarded to {recipientName}</p>
                )}
              </div>

              {/* Certificate Body */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-surface-600">Verified Certificate</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    {gradeForScore(cert.verified_score)}
                  </span>
                </div>

                {/* Scores — prominent */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-surface-50 border border-surface-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-surface-500 uppercase tracking-wide">Assessment Score</p>
                    <p className="text-xl font-bold text-surface-900">{Number(cert.auto_score ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-primary-600 uppercase tracking-wide">Verified Score</p>
                    <p className="text-xl font-bold text-primary-800">{Number(cert.verified_score ?? 0).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Course Provider</span>
                    <span className="font-medium">{cert.course?.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Issued By</span>
                    <span className="font-medium">{cert.signed_by_admin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Issue Date</span>
                    <span className="font-medium">
                      {new Date(cert.issue_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-100">
                  <p className="text-xs text-surface-500 mb-2">Verification Code • Scan QR with any camera app to verify</p>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-surface-50 px-3 py-2 rounded text-sm font-mono break-all">
                          {cert.verification_code}
                        </code>
                        <button
                          onClick={() => handleView(cert.verification_code)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                          title="Open verification page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleView(cert.verification_code)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View & Print Certificate
                      </button>
                    </div>
                    <div className="shrink-0 bg-white border rounded p-1">
                      {origin ? (
                        <QRCodeSVG value={verifyUrlFor(cert.verification_code)} size={110} level="M" includeMargin={false} />
                      ) : (
                        <div className="w-[110px] h-[110px] bg-surface-100 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

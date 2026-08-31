/**
 * Certificates Page
 * 
 * Displays user's earned certificates with verification.
 * 
 * Why: Users view and share their earned certificates from this page.
 */

"use client";

import { useEffect, useState } from "react";
import { Award, Download, ExternalLink, Calendar, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCertificates() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const handleVerify = (code: string) => {
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
        <p className="text-surface-600">Your earned certificates and verifications</p>
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
              </div>

              {/* Certificate Body */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-surface-600">Verified Certificate</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Provider</span>
                    <span className="font-medium">{cert.course?.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Auto Score</span>
                    <span className="font-medium">{cert.auto_score?.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500">Verified Score</span>
                    <span className="font-medium">{cert.verified_score?.toFixed(1)}%</span>
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
                  <p className="text-xs text-surface-500 mb-2">Verification Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-surface-50 px-3 py-2 rounded text-sm font-mono">
                      {cert.verification_code}
                    </code>
                    <button
                      onClick={() => handleVerify(cert.verification_code)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                      title="Verify Certificate"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
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
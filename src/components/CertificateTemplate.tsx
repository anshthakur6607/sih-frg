/**
 * CertificateTemplate — official printable SkillUp certificate.
 *
 * Shows the recipient, course, and scores (auto + verified) with a grade,
 * plus a unique QR that encodes the absolute public verify URL
 * (<origin>/verify/[code]). Any scanner (Google Lens, camera app) opens the
 * public verify page — no login needed — which confirms real vs fake.
 *
 * Why shared: rendered on both the private certificates list (preview) and
 * the public /verify/[code] page (full certificate + print).
 */

"use client";

import { QRCodeSVG } from "qrcode.react";
import { Award, Printer, ShieldCheck } from "lucide-react";

export interface CertificateData {
  id?: string;
  verification_code: string;
  recipient_name?: string;
  designation?: string;
  department?: string;
  course_title?: string;
  provider?: string;
  auto_score?: number | null;
  verified_score?: number | null;
  signed_by?: string;
  issue_date?: string;
}

/** Grade from the verified (final) score. */
export function gradeForScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(Number(score))) return "—";
  const s = Number(score);
  if (s >= 85) return "Distinction";
  if (s >= 70) return "Merit";
  if (s >= 50) return "Pass";
  return "Needs Improvement";
}

function fmtScore(v: number | null | undefined): string {
  if (v == null || v === undefined || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toFixed(1)}%`;
}

interface Props {
  cert: CertificateData;
  /** Absolute URL encoded in the QR (e.g. https://.../verify/SU-...). */
  verifyUrl: string;
  /** Show the Print button (hidden automatically when printing). */
  showPrintButton?: boolean;
}

export default function CertificateTemplate({ cert, verifyUrl, showPrintButton = true }: Props) {
  const grade = gradeForScore(cert.verified_score);
  const issueDate = cert.issue_date ? new Date(cert.issue_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  return (
    <div className="w-full max-w-3xl mx-auto">
      {showPrintButton && (
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Certificate
          </button>
        </div>
      )}

      {/* Printable certificate */}
      <div className="bg-white border-[3px] border-double border-primary-800 rounded-xl overflow-hidden shadow-lg print:shadow-none print:rounded-none">
        {/* Header band */}
        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-cyan-700 text-white px-8 py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Award className="w-7 h-7" />
            <span className="text-sm font-semibold tracking-[0.25em] uppercase opacity-90">SkillUp • MoSPI</span>
          </div>
          <h1 className="text-3xl font-bold tracking-wide">Certificate of Completion</h1>
          <p className="text-sm opacity-80 mt-1">Ministry of Statistics & Programme Implementation — Capacity Building</p>
        </div>

        {/* Body */}
        <div className="px-8 py-8 text-center">
          <p className="text-sm text-surface-500 uppercase tracking-widest">This certificate is proudly presented to</p>
          <p className="text-3xl font-bold text-surface-900 mt-2 font-serif">{cert.recipient_name || "Recipient"}</p>
          {(cert.designation || cert.department) && (
            <p className="text-sm text-surface-500 mt-1">
              {[cert.designation, cert.department].filter(Boolean).join(" • ")}
            </p>
          )}

          <p className="text-sm text-surface-500 mt-6 uppercase tracking-widest">for successfully completing</p>
          <p className="text-xl font-semibold text-primary-800 mt-1">{cert.course_title || "Course"}</p>
          {cert.provider && <p className="text-sm text-surface-500">Offered by {cert.provider}</p>}

          {/* Scores */}
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-xl mx-auto">
            <div className="bg-surface-50 border border-surface-200 rounded-lg p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">Assessment Score</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">{fmtScore(cert.auto_score)}</p>
            </div>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="text-xs text-primary-600 uppercase tracking-wide">Verified Score</p>
              <p className="text-2xl font-bold text-primary-800 mt-1">{fmtScore(cert.verified_score)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-600 uppercase tracking-wide">Grade</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{grade}</p>
            </div>
          </div>

          {/* Footer: signature + QR */}
          <div className="flex items-end justify-between mt-10 text-left gap-6">
            <div className="flex-1">
              <p className="text-xs text-surface-500">Issued on</p>
              <p className="font-medium text-surface-900">{issueDate}</p>
              <div className="mt-6 border-t border-surface-300 pt-2 max-w-[220px]">
                <p className="text-sm font-medium text-surface-900">{cert.signed_by || "System"}</p>
                <p className="text-xs text-surface-500">Authorised Signatory</p>
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className="bg-white border border-surface-200 rounded-lg p-2 inline-block">
                <QRCodeSVG value={verifyUrl} size={130} level="M" includeMargin={false} />
              </div>
              <p className="mt-2 text-[11px] font-mono bg-surface-50 border border-surface-200 rounded px-2 py-1 break-all max-w-[170px]">
                {cert.verification_code}
              </p>
              <p className="mt-1 text-[11px] text-surface-500 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Scan to verify authenticity
              </p>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="bg-surface-900 text-white text-center px-6 py-2.5">
          <p className="text-[11px] opacity-80">
            Verify at <span className="font-mono">{verifyUrl}</span> • Certificate ID: <span className="font-mono">{cert.id || cert.verification_code}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

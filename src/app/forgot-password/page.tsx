"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border shadow-sm p-8 max-w-md w-full">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6 text-primary-700" />
        </div>
        <h1 className="text-2xl font-bold text-center">Forgot password</h1>
        <p className="text-sm text-surface-500 text-center mt-1">Enter your email to receive a reset link.</p>

        {sent ? (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Check your email</p>
              <p className="text-xs text-green-700 mt-1">If an account exists for {email}, you will receive a reset link shortly.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-surface-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mospi.gov.in"
                className="mt-1 w-full border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <p className="text-xs text-surface-400 text-center mt-4">
          Remembered? <Link href="/login" className="text-primary-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

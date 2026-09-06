"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, BookOpen, RefreshCw, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

interface FutureSuggestion {
  id: string;
  title: string;
  why_this_matters: string;
  target_competency: string | { name?: string };
  course_id: string;
  duration_hours?: number;
  provider?: string;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

export default function FutureReadySection() {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState<FutureSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createClient();
  const competencyLabel = (value: FutureSuggestion["target_competency"]) =>
    typeof value === "string" ? value : value?.name || "Target competency";

  const fetchSuggestions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/daily-suggestions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const payload = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.suggestions)
            ? data.data.suggestions
            : Array.isArray(data?.suggestions)
              ? data.suggestions
              : [];

        // Drop raw JSON-syntax fragments the AI sometimes returns as lines
        // ('{', '"suggestions": [', '"course_id": null,') — never real courses.
        const looksReal = (v: unknown) => {
          if (!v || typeof v !== "string") return false;
          const t = v.trim();
          if (t.length < 8) return false;
          if (/^[{}\[\]",\s]*$/.test(t)) return false;
          if (/^"[^"]*"\s*:\s*[[{]/.test(t)) return false;
          if (/^"[^"]*"\s*:\s*(null|true|false|\d)/.test(t)) return false;
          return /[A-Za-z]{3,}/.test(t);
        };
        const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

        const normalized = payload
          .map((item: any, index: number) => {
            if (typeof item === "string") return null; // raw text chunk, not a course
            const title = item?.title || item?.course_title || item?.name || "";
            if (!looksReal(title)) return null;
            const rawId = item?.id || item?.course_id || "";
            return {
              id: String(rawId || title).trim() || `future-ready-${index}`,
              title: String(title).trim(),
              why_this_matters: item?.why_this_matters || item?.reason || item?.why || item?.trend_relevance || "",
              target_competency: item?.target_competency || item?.competencies_gained?.[0] || "",
              course_id: isUuid(rawId) ? rawId : "",
              course_title: String(title).trim(),
              duration_hours: item?.duration_hours,
              provider: item?.provider,
            };
          })
          .filter(Boolean) as (FutureSuggestion & { course_title: string })[];

        // Resolve real course ids by title so Enroll lands on an actual course.
        const missing = normalized.filter((s) => !s.course_id);
        if (missing.length > 0) {
          try {
            const orFilter = missing
              .slice(0, 5)
              .map((s) => `title.ilike.%${s.course_title.replace(/[%_,]/g, "").slice(0, 40)}%`)
              .join(",");
            const { data: matches } = await supabase
              .from("courses")
              .select("id, title")
              .or(orFilter)
              .limit(10);
            for (const s of missing) {
              const hit = (matches || []).find((c: any) =>
                c.title && s.course_title && c.title.toLowerCase().includes(s.course_title.toLowerCase().slice(0, 20))
              ) || (matches || [])[0];
              if (hit?.id) {
                s.course_id = hit.id;
                s.id = hit.id;
              }
            }
          } catch { /* keep catalog fallback below */ }
        }
        // Final fallback: anything still unresolved links to the catalog, never /courses/null.
        for (const s of normalized) {
          if (!s.course_id) s.course_id = "";
        }

        setSuggestions(normalized.slice(0, 5));
      }
    } catch (err) {
      console.error("Failed to fetch daily suggestions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSuggestions();
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-xl shadow-lg overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {t("dashboard.futureReady.title", "Get Ready for the Future")}
            </h2>
            <p className="text-blue-100 text-sm">
              {t(
                "dashboard.futureReady.subtitle",
                "AI-curated courses to future-proof your skills"
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh suggestions"
        >
          <RefreshCw className={`w-4 h-4 text-white ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {suggestions.map((s, index) => (
          <div
            key={`future-ready-${String(s.id || s.title || "item").replace(/[^a-zA-Z0-9_-]/g, "") || "item"}-${index}`}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-white/15 transition-colors"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm leading-snug line-clamp-2">
                  {s.title}
                </p>
                {s.target_competency && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded text-[10px] font-medium text-white">
                    {competencyLabel(s.target_competency)}
                  </span>
                )}
              </div>
            </div>

            {s.why_this_matters && (
              <p className="text-xs text-blue-100 mb-4 line-clamp-3 leading-relaxed">
                {s.why_this_matters}
              </p>
            )}

            <Link
              href={/^[0-9a-f-]{36}$/i.test(s.course_id || "") ? `/courses/${s.course_id}` : "/courses"}
              className="w-full bg-white text-indigo-700 hover:bg-blue-50 transition-colors rounded-lg px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1"
            >
              Enroll
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

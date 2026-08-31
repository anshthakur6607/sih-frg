/**
 * Recommended Courses Page
 * 
 * Shows AI-powered course recommendations with XAI explanations.
 * Hybrid recommender: content + collaborative + rule-based.
 * 
 * Why: Every recommendation explains WHY — critical for government trust.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import {
  Sparkles,
  Brain,
  Users,
  Shield,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Award,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Recommendation {
  course_id: string;
  course_title: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  explanation: string;
  factors: Array<{ factor: string; weight: number; detail: string }>;
  algorithm: "content" | "collaborative" | "rule_based" | "hybrid";
  confidence: number;
  course: any;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  critical: { bg: "bg-red-100 border-red-300", text: "text-red-700", label: "Mandatory", icon: Shield },
  high: { bg: "bg-orange-100 border-orange-300", text: "text-orange-700", label: "High Priority", icon: AlertCircle },
  medium: { bg: "bg-blue-100 border-blue-300", text: "text-blue-700", label: "Recommended", icon: TrendingUp },
  low: { bg: "bg-surface-100 border-surface-200", text: "text-surface-600", label: "Optional", icon: BookOpen },
};

const ALGORITHM_LABELS: Record<string, { label: string; icon: any; color: string; description: string }> = {
  content: {
    label: "Content-Based",
    icon: Brain,
    color: "bg-blue-100 text-blue-700",
    description: "Matches your skill gaps"
  },
  collaborative: {
    label: "Peer Learning",
    icon: Users,
    color: "bg-green-100 text-green-700",
    description: "Colleagues completed this"
  },
  rule_based: {
    label: "Compliance",
    icon: Shield,
    color: "bg-red-100 text-red-700",
    description: "Mandatory for your role"
  },
  hybrid: {
    label: "Hybrid AI",
    icon: Sparkles,
    color: "bg-primary-100 text-primary-700",
    description: "Combined AI reasoning"
  },
};

export default function RecommendationsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const justFresh = searchParams.get("fresh") === "1";
  const freshCount = Number(searchParams.get("count") || 0);
  const [showFreshBanner, setShowFreshBanner] = useState(justFresh);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasSurvey, setHasSurvey] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // If survey just finished, try instant cache from sessionStorage for immediate feel
    try {
      const cached = sessionStorage.getItem('skillup_last_recommendations');
      if (cached) {
        const parsed = JSON.parse(cached);
        // only use cache if fresh (<2 min) to avoid stale
        if (parsed?.recommendations?.length && Date.now() - (parsed.at || 0) < 120000) {
          // hydrate optimistically; will be overwritten by real fetch
          setRecommendations(parsed.recommendations as Recommendation[]);
          setLoading(false);
        }
      }
    } catch {}
    loadRecommendations();
    if (justFresh) {
      // auto-hide banner after 12s
      const t = setTimeout(() => setShowFreshBanner(false), 12000);
      return () => clearTimeout(t);
    }
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Check if user has completed survey
      const { data: survey } = await supabase
        .from('surveys')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setHasSurvey(!!survey);

      // Fetch recommendations (real AI via backend knowledge graph)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Backend ${response.status}: ${text.slice(0,120) || response.statusText} — is backend on ${apiUrl} running?`);
      }
      const data = await response.json();

      if (data.success) {
        // Keep sessionStorage cache in sync with truth
        if (data.data && data.data.length > 0) {
          try { sessionStorage.setItem('skillup_last_recommendations', JSON.stringify({ at: Date.now(), count: data.data.length, recommendations: data.data })); } catch {}
        }
        setRecommendations(data.data || []);
        if ((data.data || []).length === 0 && !!survey) {
          // No recommendations but has survey → likely no gaps or no courses matched; not an error, show empty state below
        }
      } else {
        throw new Error(data.error || "Failed to load recommendations");
      }
    } catch (err: any) {
      console.error("Recommendations load error:", err);
      setError(err.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll(course: any) {
    if (!course?.id) return;
    setEnrollingId(course.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ course_id: course.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Enroll failed ${res.status}`);
      if (course.course_url) {
        window.open(course.course_url, "_blank", "noopener,noreferrer");
      }
      await loadRecommendations();
    } catch (err: any) {
      console.error("Enroll error:", err);
      alert(err.message || "Failed to enroll. Please try again.");
    } finally {
      setEnrollingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasSurvey) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8 text-center space-y-4">
        <Sparkles className="w-16 h-16 mx-auto text-primary-500" />
        <h1 className="text-2xl font-bold text-surface-900">Get Personalized Recommendations</h1>
        <p className="text-surface-600">
          Take a 2-minute survey so our AI can suggest the most relevant courses for your role and skill level.
        </p>
        <Link href="/survey" className="btn btn-primary inline-flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Start AI Survey
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
        <h2 className="text-lg font-medium text-surface-900">Couldn’t load recommendations</h2>
        <p className="text-sm text-surface-600 max-w-lg mx-auto break-words">{error}</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={loadRecommendations} className="btn btn-primary">Retry</button>
          <Link href="/survey" className="btn btn-secondary">Retake Survey</Link>
          <Link href="/courses" className="btn btn-secondary">Browse Courses</Link>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
        <Brain className="w-16 h-16 mx-auto text-surface-200 mb-4" />
        <h2 className="text-lg font-medium text-surface-900 mb-2">No recommendations yet</h2>
        <p className="text-surface-600 max-w-lg mx-auto">
          {hasSurvey
            ? "Your profile was processed but no matching courses were found. This can happen if courses haven’t been seeded or gaps are already closed. Try refreshing, retaking the survey with different weak areas, or browsing the catalog."
            : "Our AI hasn’t seen your profile yet."}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={loadRecommendations} className="btn btn-primary">Refresh</button>
          <Link href="/survey" className="btn btn-secondary inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> {hasSurvey ? "Retake Survey" : "Start Survey"}</Link>
          <Link href="/courses" className="btn btn-secondary">Browse Courses</Link>
        </div>
        {hasSurvey && <p className="text-xs text-surface-400">Tip: ensure <code>seed_courses.sql</code> + <code>seed_igot_portal.sql</code> were run, and backend <code>AI_SERVICE_URL</code> points to <code>http://localhost:8001</code>.</p>}
      </div>
    );
  }

  const critical = recommendations.filter(r => r.priority === "critical");
  const others = recommendations.filter(r => r.priority !== "critical");

  return (
    <div className="space-y-6">
      {/* Fresh success banner — shown when arriving from survey */}
      {showFreshBanner && recommendations.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg animate-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">{t("recommendations.bannerReady")}</p>
              <p className="text-sm text-emerald-50">
                {freshCount || recommendations.length} {t("recommendations.bannerDesc")}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowFreshBanner(false)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm">Dismiss</button>
            <Link href="/courses" className="px-4 py-2 bg-white text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 flex items-center gap-2">
              {t("common.browseCourses")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-600" />
            {t("recommendations.title")}
          </h1>
          <p className="text-surface-600 mt-1">
            {t("recommendations.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/survey" className="btn btn-secondary flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Retake Survey
          </Link>
          <button onClick={loadRecommendations} className="btn btn-secondary flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Algorithm Mix */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(ALGORITHM_LABELS).map(([key, label]) => {
          const count = recommendations.filter(r => r.algorithm === key || (key === "hybrid" && r.algorithm === "hybrid")).length;
          return (
            <div key={key} className={`${label.color} rounded-lg p-3 flex items-center gap-3`}>
              <label.icon className="w-5 h-5" />
              <div>
                <p className="font-medium text-sm">{label.label}</p>
                <p className="text-xs opacity-80">{count} courses</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mandatory Section */}
      {critical.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-surface-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Mandatory for Your Role
          </h2>
          <div className="space-y-3">
            {critical.map((rec) => (
              <RecommendationCard
                key={rec.course_id}
                rec={rec}
                expanded={expanded === rec.course_id}
                onExpand={() => setExpanded(expanded === rec.course_id ? null : rec.course_id)}
                onEnroll={handleEnroll}
                enrolling={enrollingId === (rec.course?.id || rec.course_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Recommendations */}
      {others.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-surface-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Based on Your Skills & Career
          </h2>
          <div className="space-y-3">
            {others.map((rec) => (
              <RecommendationCard
                key={rec.course_id}
                rec={rec}
                expanded={expanded === rec.course_id}
                onExpand={() => setExpanded(expanded === rec.course_id ? null : rec.course_id)}
                onEnroll={handleEnroll}
                enrolling={enrollingId === (rec.course?.id || rec.course_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trust Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">🤖 How our AI decides</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li>• <strong>Content-based:</strong> Matches courses to your specific skill gaps</li>
          <li>• <strong>Collaborative:</strong> Learns what similar officials (same role/dept) completed</li>
          <li>• <strong>Rule-based:</strong> Adds mandatory compliance trainings for your role</li>
          <li>• <strong>Hybrid:</strong> Combines all three with weighted reasoning for best match</li>
        </ul>
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  expanded,
  onExpand,
  onEnroll,
  enrolling,
}: {
  rec: Recommendation;
  expanded: boolean;
  onExpand: () => void;
  onEnroll: (c: any) => void;
  enrolling?: boolean;
}) {
  const priority = PRIORITY_STYLES[rec.priority];
  const algo = ALGORITHM_LABELS[rec.algorithm];
  const PriorityIcon = priority.icon;
  const AlgoIcon = algo.icon;

  return (
    <div className={`bg-white rounded-xl shadow border-2 ${priority.bg} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`${priority.bg} ${priority.text} px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1`}>
                <PriorityIcon className="w-3 h-3" />
                {priority.label}
              </span>
              <span className={`${algo.color} px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1`}>
                <AlgoIcon className="w-3 h-3" />
                {algo.label}
              </span>
              <span className="text-xs text-surface-500">
                Confidence: {Math.round(rec.confidence * 100)}%
              </span>
            </div>
            <h3 className="text-lg font-semibold text-surface-900 mb-1">
              {rec.course?.title || rec.course_title}
            </h3>
            <p className="text-sm text-surface-600 line-clamp-2 mb-2">
              {rec.course?.description || ""}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <div className="p-3 bg-surface-50 rounded-lg mb-3">
          <p className="text-sm text-surface-700">
            <strong>Why we recommend this:</strong> {rec.explanation}
          </p>
        </div>

        {/* Factors */}
        {expanded && (
          <div className="mb-3 space-y-2">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Contributing Factors</p>
            {rec.factors.map((factor, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-xs text-surface-600 capitalize">
                  {factor.factor.replace(/_/g, " ")}
                </div>
                <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${factor.weight * 100}%` }}
                  />
                </div>
                <div className="w-12 text-xs text-surface-500 text-right">
                  {Math.round(factor.weight * 100)}%
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEnroll(rec.course || { id: rec.course_id, title: rec.course_title, course_url: (rec as any).course_url })}
            disabled={!!enrolling}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {enrolling ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {enrolling ? "Enrolling..." : "Enroll Now"}
          </button>
          <button
            onClick={onExpand}
            className="btn btn-secondary flex items-center gap-2"
          >
            {expanded ? "Hide" : "Show"} Reasoning
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {rec.course?.course_url && (
            <a
              href={rec.course.course_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
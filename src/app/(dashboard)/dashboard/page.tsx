/**
 * Employee Dashboard Page
 * 
 * Main dashboard showing user competency overview, skill gaps,
 * recommended courses, and learning metrics.
 * 
 * Why: This is the primary page users see after logging in.
 * Provides at-a-glance view of their skill development progress.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  Target, 
  BookOpen, 
  Award, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Users,
  Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import CompetencyRadarChart from "@/components/CompetencyRadarChart";
import FutureReadySection from "@/components/FutureReadySection";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Competency score type
 */
interface CompetencyScore {
  id: string;
  current_score: number;
  required_score: number;
  gap_score: number;
  competency: {
    id: string;
    name: string;
    domain: { name: string };
  };
}

/**
 * Skill gap type
 */
interface SkillGap {
  competency: { name: string; domain: { name: string } };
  current_score: number;
  required_score: number;
  gap_score: number;
}

/**
 * Recommended course type
 */
interface RecommendedCourse {
  id: string;
  title: string;
  provider: string;
  duration_hours: number;
  priority: string;
  matching_gap: string;
}

/**
 * Learning metrics type
 */
interface LearningMetrics {
  total_learning_hours: number;
  completed_courses: number;
  average_quiz_score: number;
  certificates_earned: number;
}

/**
 * Dashboard data type
 */
interface DashboardData {
  overall_progress: number;
  competency_scores: CompetencyScore[];
  gaps: {
    high: SkillGap[];
    medium: SkillGap[];
    achieved: SkillGap[];
  };
  domain_progress: { domain: string; average_score: number }[];
  radar_data: { domain: string; current: number; required: number; percentage: number }[];
  recommended_courses: RecommendedCourse[];
  learning_metrics: LearningMetrics;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSurvey, setHasSurvey] = useState(true);
  const supabase = createClient();

  /**
   * Fetch dashboard data
   */
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if user has completed survey
        const { data: survey } = await supabase
          .from("surveys")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasSurvey(!!survey);

        // Fetch competency gaps
        const { data: gapsData } = await supabase
          .from("user_competency_scores")
          .select(`
            *,
            competency:competencies(
              id, name,
              domain:competency_domains(name)
            )
          `)
          .eq("user_id", user.id);

        // Fetch recommended courses
        const { data: coursesData } = await supabase
          .from("courses")
          .select("*")
          .limit(5);

        // Fetch learning metrics (from assessments)
        const { data: assessments } = await supabase
          .from("assessment_attempts")
          .select("auto_score, time_taken_seconds, passed")
          .eq("user_id", user.id);

        const { data: certificates } = await supabase
          .from("certificates")
          .select("id")
          .eq("user_id", user.id);

        // Process data
        const scores = (gapsData || []) as CompetencyScore[];
        
        const highGaps = scores.filter(s => s.gap_score >= 2.0);
        const mediumGaps = scores.filter(s => s.gap_score >= 1.0 && s.gap_score < 2.0);
        const achievedGaps = scores.filter(s => s.gap_score < 1.0);

        const totalRequired = scores.reduce((sum, s) => sum + s.required_score, 0);
        const totalCurrent = scores.reduce((sum, s) => sum + s.current_score, 0);
        const overallProgress = totalRequired > 0 ? (totalCurrent / totalRequired) * 100 : 0;

        // Group by domain
        const domainMap = new Map<string, { total: number; count: number }>();
        const domainRequiredMap = new Map<string, { total: number; count: number }>();
        scores.forEach(s => {
          const domain = s.competency?.domain?.name || "Unknown";
          const existing = domainMap.get(domain);
          if (existing) {
            existing.total += s.current_score;
            existing.count++;
          } else {
            domainMap.set(domain, { total: s.current_score, count: 1 });
          }
          const existingReq = domainRequiredMap.get(domain);
          if (existingReq) {
            existingReq.total += s.required_score;
            existingReq.count++;
          } else {
            domainRequiredMap.set(domain, { total: s.required_score, count: 1 });
          }
        });
        const domainProgress = Array.from(domainMap.entries()).map(([domain, d]) => ({
          domain,
          average_score: d.count > 0 ? d.total / d.count : 0,
        }));

        // Radar chart data
        const radarData = Array.from(domainMap.entries()).map(([domain, d]) => {
          const req = domainRequiredMap.get(domain);
          const requiredAvg = req && req.count > 0 ? req.total / req.count : 5;
          const currentAvg = d.count > 0 ? d.total / d.count : 0;
          return {
            domain,
            current: currentAvg,
            required: requiredAvg,
            percentage: requiredAvg > 0 ? (currentAvg / requiredAvg) * 100 : 0,
          };
        });

        // Calculate metrics
        const totalHours = (assessments || []).reduce((sum, a) => sum + (a.time_taken_seconds || 0) / 3600, 0);
        const avgScore = assessments && assessments.length > 0
          ? assessments.reduce((sum, a) => sum + (a.auto_score || 0), 0) / assessments.length
          : 0;

        setData({
          overall_progress: Math.round(overallProgress * 10) / 10,
          competency_scores: scores,
          gaps: {
            high: highGaps.map(s => ({
              competency: s.competency,
              current_score: s.current_score,
              required_score: s.required_score,
              gap_score: s.gap_score,
            })),
            medium: mediumGaps.map(s => ({
              competency: s.competency,
              current_score: s.current_score,
              required_score: s.required_score,
              gap_score: s.gap_score,
            })),
            achieved: achievedGaps.map(s => ({
              competency: s.competency,
              current_score: s.current_score,
              required_score: s.required_score,
              gap_score: s.gap_score,
            })),
          },
          domain_progress: domainProgress,
          radar_data: radarData,
          recommended_courses: (coursesData || []).map(c => ({
            id: c.id,
            title: c.title,
            provider: c.provider || "iGOT",
            duration_hours: c.duration_hours,
            priority: "high",
            matching_gap: "Skill development",
          })),
          learning_metrics: {
            total_learning_hours: Math.round(totalHours * 10) / 10,
            completed_courses: (assessments || []).filter(a => a.passed).length,
            average_quiz_score: Math.round(avgScore),
            certificates_earned: (certificates || []).length,
          },
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-surface-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

    return (
      <div className="space-y-6">
        {/* Survey CTA Banner */}
        {!hasSurvey && (
          <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-xl p-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Take the AI Skill Survey</h2>
                <p className="text-primary-100 text-sm">
                  2 minutes to get personalized course recommendations powered by AI
                </p>
              </div>
            </div>
            <Link
              href="/survey"
              className="px-6 py-3 bg-white text-primary-700 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center gap-2"
            >
              Start Survey
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t("dashboard.title")}</h1>
          <p className="text-surface-600">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/survey" className="btn btn-secondary inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {hasSurvey ? "Retake Survey" : "Take Survey"}
          </Link>
          <Link href="/setup-profile" className="btn btn-primary">
            Update Profile
          </Link>
        </div>
      </div>

      {/* Overall Progress Card */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
              <h2 className="text-lg font-semibold text-surface-900 mb-1">
              {t("dashboard.overallProgress")}
            </h2>
            <p className="text-surface-600 text-sm">
              Based on your assessed skill levels vs required levels
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary-800">
              {data?.overall_progress || 0}%
            </div>
            <p className="text-sm text-surface-500">Complete</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${data?.overall_progress || 0}%` }}
            />
          </div>
        </div>

        {/* Radar Chart */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-surface-700 mb-3">Competency Profile by Domain</h3>
          <CompetencyRadarChart data={data?.radar_data || []} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900">
                {data?.learning_metrics.total_learning_hours || 0}
              </div>
              <div className="text-sm text-surface-500">Learning Hours</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900">
                {data?.learning_metrics.completed_courses || 0}
              </div>
              <div className="text-sm text-surface-500">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900">
                {data?.learning_metrics.average_quiz_score || 0}%
              </div>
              <div className="text-sm text-surface-500">Avg Quiz Score</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900">
                {data?.learning_metrics.certificates_earned || 0}
              </div>
              <div className="text-sm text-surface-500">Certificates</div>
            </div>
          </div>
        </div>
      </div>

      <FutureReadySection />

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Skill Gaps */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">Skill Gap Analysis</h3>
            <Link 
              href="/dashboard/competencies" 
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Gap Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {data?.gaps.high.length || 0}
              </div>
              <div className="text-xs text-red-600">High Gap</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">
                {data?.gaps.medium.length || 0}
              </div>
              <div className="text-xs text-yellow-600">Medium Gap</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {data?.gaps.achieved.length || 0}
              </div>
              <div className="text-xs text-green-600">Achieved</div>
            </div>
          </div>

          {/* High Priority Gaps */}
          {data?.gaps.high.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-surface-700 mb-2">High Priority Gaps:</p>
              {data.gaps.high.slice(0, 3).map((gap, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="font-medium text-surface-900">
                      {typeof gap.competency?.name === "string" ? gap.competency.name : "Unknown competency"}
                    </p>
                    <p className="text-xs text-surface-500">
                      {typeof gap.competency?.domain?.name === "string" ? gap.competency.domain.name : "Uncategorized"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-red-700">
                      {gap.current_score.toFixed(1)} / {gap.required_score}
                    </span>
                    <p className="text-xs text-red-500">Gap: {gap.gap_score.toFixed(1)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-surface-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No high priority gaps!</p>
            </div>
          )}
        </div>

        {/* Recommended Courses */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">Recommended Courses</h3>
            <Link 
              href="/courses" 
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {data?.recommended_courses.length ? (
              data.recommended_courses.slice(0, 4).map((course) => (
                <div 
                  key={course.id}
                  className="flex items-center justify-between p-4 bg-surface-50 rounded-lg hover:bg-surface-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-surface-900">{course.title}</p>
                      <p className="text-xs text-surface-500">{course.provider} - {course.duration_hours}h</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    course.priority === "high" 
                      ? "bg-red-100 text-red-700" 
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {course.priority === "high" ? "High" : "Medium"} Priority
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-surface-500">
                <BookOpen className="w-12 h-12 mx-auto mb-2" />
                <p>No recommendations yet</p>
                <p className="text-sm">Complete your profile to get personalized course suggestions</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
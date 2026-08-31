/**
 * Skill Assessment Page
 * 
 * AI-powered competency assessment to identify skill gaps.
 * Users can trigger assessment based on their profile.
 * 
 * Why: Initial assessment establishes baseline for personalized learning paths.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Brain, 
  Target, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  BarChart3,
  Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { competencyApi } from "@/lib/api";

interface CompetencyScore {
  id: string;
  name: string;
  domain: string;
  current_score: number;
  required_score: number;
  gap_score: number;
}

interface AssessmentResult {
  overall_progress: number;
  summary: {
    high_gap_count: number;
    medium_gap_count: number;
    achieved_count: number;
    total_competencies: number;
  };
  gaps: {
    high: CompetencyScore[];
    medium: CompetencyScore[];
    achieved: CompetencyScore[];
  };
  domain_progress: { domain: string; average_score: number; competency_count: number }[];
}

export default function AssessmentPage() {
  const router = useRouter();
  const [assessed, setAssessed] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);

      // Check if already assessed
      const { data: scores } = await supabase
        .from("user_competency_scores")
        .select("*")
        .eq("user_id", user.id);
      
      if (scores && scores.length > 0) {
        setAssessed(true);
        // Fetch existing gaps
        const gapsData = await competencyApi.getGaps();
        if (gapsData && typeof gapsData === 'object') {
          setResult(gapsData as any);
        }
      }
    }
    loadProfile();
  }, [supabase, router]);

  const handleAssess = async () => {
    setAssessing(true);
    setError(null);
    try {
      await competencyApi.assess();
      // Fetch the updated gaps
      const gapsResponse = await competencyApi.getGaps();
      if (gapsResponse) setResult(gapsResponse as any);
      setAssessed(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to run assessment");
    } finally {
      setAssessing(false);
    }
  };

  const handleReassess = async () => {
    setAssessing(true);
    setError(null);
    try {
      await competencyApi.assess();
      const gapsResponse = await competencyApi.getGaps();
      if (gapsResponse) setResult(gapsResponse as any);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to run re-assessment");
    } finally {
      setAssessing(false);
    }
  };

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      "Statistical": "#1e40af",
      "Technical": "#0891b2",
      "Digital Governance": "#0e7490",
      "Behavioural": "#164e63",
    };
    return colors[domain] || "#6b7280";
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-600" />
            AI Skill Assessment
          </h1>
          <p className="text-surface-600 mt-1">
            Run AI-powered competency analysis based on your profile
          </p>
        </div>
        {assessed && (
          <button 
            onClick={handleReassess}
            disabled={assessing}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4" />
            Re-run Assessment
          </button>
        )}
      </div>

      {/* Profile Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-surface-200">
        <h3 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary-600" />
          Your Profile
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-surface-500">Designation</p>
            <p className="font-medium">{profile.designation || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Department</p>
            <p className="font-medium">{profile.department || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Experience</p>
            <p className="font-medium">{profile.years_experience || 0} years</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Education</p>
            <p className="font-medium">{profile.education || "Not set"}</p>
          </div>
        </div>
      </div>

      {/* Assessment Action */}
      {!assessed ? (
        <div className="bg-white rounded-lg shadow-md p-8 border border-surface-200 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-xl font-semibold text-surface-900 mb-2">
            Ready to Assess Your Skills?
          </h3>
          <p className="text-surface-600 mb-6 max-w-md mx-auto">
            Our AI will analyze your profile (designation, department, experience, education) 
            and generate baseline competency scores across 4 domains: Statistical, Technical, 
            Digital Governance, and Behavioural.
          </p>
          <button
            onClick={handleAssess}
            disabled={assessing}
            className="btn btn-primary flex items-center gap-2 mx-auto text-lg px-8 py-3"
          >
            {assessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Start AI Assessment
              </>
            )}
          </button>
          {error && (
            <p className="mt-4 text-red-600">{error}</p>
          )}
        </div>
      ) : (
        <>
          {/* Results Summary */}
          {result && (
            <div className="bg-white rounded-lg shadow-md p-6 border border-surface-200">
              <h3 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-600" />
                Assessment Results
              </h3>
              
              {/* Overall Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-surface-900">Overall Competency Progress</span>
                  <span className="text-2xl font-bold text-primary-800">{result.overall_progress}%</span>
                </div>
                <div className="h-3 bg-surface-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-500"
                    style={{ width: `${result.overall_progress}%` }}
                  />
                </div>
              </div>

              {/* Gap Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-3xl font-bold text-red-700">{result.summary.high_gap_count}</div>
                  <div className="text-sm text-red-600">High Priority Gaps</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-700">{result.summary.medium_gap_count}</div>
                  <div className="text-sm text-yellow-600">Medium Gaps</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-700">{result.summary.achieved_count}</div>
                  <div className="text-sm text-green-600">Achieved</div>
                </div>
              </div>

              {/* Domain Progress */}
              <div className="mb-6">
                <h4 className="font-medium text-surface-900 mb-3">Domain Progress</h4>
                <div className="space-y-3">
                  {result.domain_progress.map((domain) => (
                    <div key={domain.domain} className="flex items-center gap-4">
                      <div className="w-40 text-sm text-surface-600 font-medium">
                        {domain.domain}
                      </div>
                      <div className="flex-1 h-4 bg-surface-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, (domain.average_score / 5) * 100)}%`,
                            backgroundColor: getDomainColor(domain.domain)
                          }}
                        />
                      </div>
                      <div className="w-16 text-sm font-medium text-right">
                        {domain.average_score.toFixed(1)} / 5.0
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* High Priority Gaps Detail */}
              {result.gaps.high.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    High Priority Skill Gaps
                  </h4>
                  <div className="space-y-2">
                    {result.gaps.high.slice(0, 5).map((gap, idx) => (
                      <div 
                        key={gap.id || idx}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-medium text-surface-900">{gap.name}</p>
                            <p className="text-xs text-surface-500">{gap.domain}</p>
                          </div>
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
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex gap-4">
                <button 
                  onClick={() => router.push("/courses")}
                  className="btn btn-primary flex-1"
                >
                  View Recommended Courses
                </button>
                <button 
                  onClick={() => router.push("/dashboard")}
                  className="btn btn-secondary flex-1"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
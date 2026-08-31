/**
 * Assessments Page
 * 
 * Displays user's assessment history and allows starting new assessments.
 * 
 * Why: Users track their assessment attempts and view scores from this page.
 */

"use client";

import { useEffect, useState } from "react";
import { Award, Clock, CheckCircle, XCircle, AlertTriangle, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Assessment {
  id: string;
  course_id: string;
  auto_score: number;
  passed: boolean;
  tab_switch_count: number;
  time_taken_seconds: number;
  status: string;
  created_at: string;
  course: { title: string; provider: string };
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchAssessments() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("assessment_attempts")
        .select("*, course:courses(title, provider)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setAssessments(data);
      setLoading(false);
    }

    fetchAssessments();
  }, [supabase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
        <h1 className="text-2xl font-bold text-surface-900">Assessments</h1>
        <p className="text-surface-600">View your assessment history and results</p>
      </div>

      <div className="space-y-4">
        {assessments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Award className="w-16 h-16 mx-auto text-surface-300 mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">No Assessments Yet</h3>
            <p className="text-surface-600 mb-4">Enroll in a course to take assessments</p>
          </div>
        ) : (
          assessments.map((assessment) => (
            <div key={assessment.id} className="bg-white rounded-lg shadow-md p-6 border border-surface-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-surface-900">
                    {assessment.course?.title || "Unknown Course"}
                  </h3>
                  <p className="text-sm text-surface-500">{assessment.course?.provider}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                    assessment.passed 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {assessment.passed ? (
                      <><CheckCircle className="w-4 h-4" /> Passed</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Failed</>
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-surface-500">Score</p>
                  <p className="font-medium">{assessment.auto_score?.toFixed(1) || 0}%</p>
                </div>
                <div>
                  <p className="text-surface-500">Time Taken</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(assessment.time_taken_seconds || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-surface-500">Tab Switches</p>
                  <p className={`font-medium flex items-center gap-1 ${
                    assessment.tab_switch_count > 5 ? "text-red-600" : ""
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                    {assessment.tab_switch_count}
                  </p>
                </div>
                <div>
                  <p className="text-surface-500">Status</p>
                  <p className="font-medium capitalize">{assessment.status}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-surface-100 text-xs text-surface-400">
                Completed on {new Date(assessment.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
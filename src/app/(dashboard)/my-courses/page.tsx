/**
 * My Courses Page - Course Progress & Launchpad
 * 
 * Shows user's enrolled courses with progress tracking.
 * Auto-completes courses based on duration (ready for iGOT webhook sync).
 * Provides buttons to: Continue Course, Start Exam, Start Live Quiz.
 * 
 * Why: Central hub for user's learning journey.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  BookOpen, 
  Clock, 
  PlayCircle, 
  CheckCircle, 
  AlertCircle,
  Award,
  Mic,
  ExternalLink,
  RefreshCw,
  Calendar,
  GraduationCap,
  Target
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

interface Enrollment {
  id: string;
  course_id: string;
  source: string;
  status: string;
  progress_percentage: number;
  started_at: string;
  expected_completion_at: string;
  completed_at: string;
  course: {
    id: string;
    title: string;
    description: string;
    provider: string;
    duration_hours: number;
    source: string;
    is_tpac_classroom: boolean;
    tpac_start_date: string;
    tpac_location: string;
    course_url: string;
  };
}

export default function MyCoursesPage() {
  const { t } = useLanguage();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed" | "exam_ready">("all");
  const supabase = createClient();

  useEffect(() => {
    fetchEnrollments();
  }, [supabase]);

  async function fetchEnrollments() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("course_enrollments")
        .select("*, course:courses(*)")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (data) {
        // Auto-complete courses that are past expected completion date
        const updatedData = await Promise.all(
          data.map(async (enrollment) => {
            if (
              enrollment.status === "in_progress" &&
              enrollment.progress_percentage < 100 &&
              enrollment.expected_completion_at &&
              new Date(enrollment.expected_completion_at) < new Date()
            ) {
              // Auto-complete
              await supabase
                .from("course_enrollments")
                .update({
                  status: "completed",
                  progress_percentage: 100,
                  completed_at: enrollment.expected_completion_at,
                })
                .eq("id", enrollment.id);

              return { ...enrollment, status: "completed", progress_percentage: 100, completed_at: enrollment.expected_completion_at };
            }
            return enrollment;
          })
        );
        setEnrollments(updatedData);
      }
    } catch (err) {
      console.error("Failed to fetch enrollments:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => {
    await fetchEnrollments();
  };

  const handleTestComplete = async (enrollmentId: string) => {
    const { error } = await supabase.from("course_enrollments").update({ status: "completed", progress_percentage: 100, completed_at: new Date().toISOString() }).eq("id", enrollmentId);
    if (!error) {
      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, status: "completed", progress_percentage: 100, completed_at: new Date().toISOString() } : e));
    }
  };

  const handleStartCourse = async (enrollment: Enrollment) => {
    // mark started (20%) for test feel
    if (enrollment.progress_percentage === 0) {
      await supabase.from("course_enrollments").update({ progress_percentage: 20, status: "in_progress" }).eq("id", enrollment.id);
      setEnrollments(prev => prev.map(e => e.id === enrollment.id ? { ...e, progress_percentage: 20, status: "in_progress" } : e));
    }
    window.location.href = `/courses/${enrollment.course_id}`;
  };

  const filteredEnrollments = enrollments.filter(e => {
    if (filter === "in_progress") return e.status === "in_progress";
    if (filter === "completed") return e.status === "completed";
    if (filter === "exam_ready") return e.progress_percentage >= 80 && e.status !== "completed";
    return true;
  });

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return "bg-green-500";
    if (pct >= 50) return "bg-blue-500";
    if (pct >= 25) return "bg-yellow-500";
    return "bg-surface-300";
  };

  const getStatusBadge = (enrollment: Enrollment) => {
    if (enrollment.status === "completed") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (enrollment.progress_percentage >= 80) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
          <Award className="w-3 h-3" />
          Exam Ready
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-600 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        In Progress
      </span>
    );
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary-600" />
            {t("myCourses.title")}
          </h1>
          <p className="text-surface-600 mt-1">
            {t("myCourses.subtitle")}
          </p>
        </div>
        <button onClick={handleRefresh} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-primary-800">{enrollments.length}</div>
          <div className="text-sm text-surface-500">Total Enrolled</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-800">
            {enrollments.filter(e => e.status === "in_progress").length}
          </div>
          <div className="text-sm text-surface-500">In Progress</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-800">
            {enrollments.filter(e => e.status === "completed").length}
          </div>
          <div className="text-sm text-surface-500">Completed</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-800">
            {enrollments.filter(e => e.progress_percentage >= 80).length}
          </div>
          <div className="text-sm text-surface-500">Exam Ready</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: "all", label: "All" },
          { value: "in_progress", label: "In Progress" },
          { value: "exam_ready", label: "Exam Ready" },
          { value: "completed", label: "Completed" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as typeof filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-primary-800 text-white"
                : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Course Cards */}
      {filteredEnrollments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-surface-300 mb-4" />
          <h3 className="text-lg font-medium text-surface-900 mb-2">
            {filter === "all" ? "No Courses Yet" : `No ${filter.replace("_", " ")} courses`}
          </h3>
          <p className="text-surface-600 mb-4">
            {filter === "all" 
              ? "Browse the course catalog to start your learning journey"
              : "Try a different filter to see more courses"}
          </p>
          <Link href="/courses" className="btn btn-primary">
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="bg-white rounded-lg shadow-md border border-surface-200 overflow-hidden">
              {/* Card Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        enrollment.course.is_tpac_classroom 
                          ? "bg-accent-100 text-accent-700" 
                          : "bg-primary-100 text-primary-700"
                      }`}>
                        {enrollment.course.is_tpac_classroom ? "TPAC Classroom" : enrollment.course.source || "Online"}
                      </span>
                      {getStatusBadge(enrollment)}
                    </div>
                    <Link href={`/courses/${enrollment.course_id}`} className="hover:underline">
                      <h3 className="text-lg font-semibold text-surface-900 mb-1">
                        {enrollment.course.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-surface-500">
                      {enrollment.course.provider} · {enrollment.course.duration_hours}h
                      {enrollment.course.tpac_location && ` · ${enrollment.course.tpac_location}`}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-600">Progress</span>
                    <span className="font-medium text-surface-900">{enrollment.progress_percentage}%</span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${getProgressColor(enrollment.progress_percentage)}`}
                      style={{ width: `${enrollment.progress_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-surface-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Started {new Date(enrollment.started_at).toLocaleDateString()}
                  </span>
                  {enrollment.expected_completion_at && (
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Expected {new Date(enrollment.expected_completion_at).toLocaleDateString()}
                    </span>
                  )}
                  {enrollment.completed_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Completed {new Date(enrollment.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Start / Continue — now goes to course detail (video + AI suite) and bumps progress for demo */}
                  <button
                    onClick={() => handleStartCourse(enrollment)}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {enrollment.progress_percentage > 0 ? "Continue Course" : "Start Course"}
                  </button>
                  {enrollment.course.course_url && (
                    <a href={enrollment.course.course_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex items-center gap-1 text-xs" title="Open original iGOT link">
                      <ExternalLink className="w-3 h-3" /> iGOT
                    </a>
                  )}

                  {/* Start Exam (Quiz) */}
                  {enrollment.progress_percentage >= 80 && enrollment.status !== "completed" && (
                    <Link
                      href={`/quiz/${enrollment.course_id}`}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <Award className="w-4 h-4" />
                      Start Exam
                    </Link>
                  )}

                  {/* Start Live AI Quiz */}
                  {enrollment.progress_percentage >= 80 && enrollment.status !== "completed" && (
                    <Link
                      href={`/live-quiz/${enrollment.course_id}`}
                      className="btn btn-accent flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      Live AI Quiz
                    </Link>
                  )}

                  {/* Completed Badge */}
                  {enrollment.status === "completed" && (
                    <Link
                      href="/certificates"
                      className="btn bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                    >
                      <Award className="w-4 h-4" />
                      View Certificate
                    </Link>
                  )}
                  {/* Demo: instant complete for testing */}
                  {enrollment.status !== "completed" && (
                    <button onClick={() => handleTestComplete(enrollment.id)} className="btn btn-secondary border-dashed flex items-center gap-2 text-xs" title="Demo helper — marks 100% immediately">
                      <CheckCircle className="w-4 h-4" /> {t("myCourses.testComplete")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How Progress Tracking Works</p>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Course progress syncs from iGOT Karmayogi when connected</li>
              <li>• Without iGOT sync, courses auto-complete after the duration period</li>
              <li>• Complete 80%+ of a course to unlock the exam</li>
              <li>• Live AI Quiz uses voice — speak your answers in any language</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
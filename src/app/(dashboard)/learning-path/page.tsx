/**
 * Learning Path Page
 * 
 * Personalized learning pathway visualization based on skill gaps.
 * Shows recommended course sequence with progress tracking.
 * 
 * Why: Helps users understand their learning journey and next steps.
 */

"use client";

import { useEffect, useState } from "react";
import { 
  BookOpen, 
  Clock, 
  CheckCircle, 
  ChevronRight,
  Target,
  ArrowRight,
  PlayCircle,
  Lock,
  Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { courseApi, competencyApi } from "@/lib/api";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  description: string;
  provider: string;
  duration_hours: number;
  source: string;
  is_tpac_classroom: boolean;
  course_url: string;
  target_competencies: string[];
}

interface LearningPathStep {
  id: string;
  title: string;
  description: string;
  courses: Course[];
  competency_gaps: string[];
  estimated_hours: number;
  completed: boolean;
  current: boolean;
}

interface SkillGap {
  competency: { name: string; domain: { name: string } };
  current_score: number;
  required_score: number;
  gap_score: number;
}

export default function LearningPathPage() {
  const [path, setPath] = useState<LearningPathStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    async function fetchLearningPath() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user's skill gaps
        const gapsResponse = await competencyApi.getGaps();
        const gaps = (gapsResponse as any)?.data?.gaps || { high: [], medium: [], achieved: [] };
        const allGaps = [...gaps.high, ...gaps.medium] as SkillGap[];

        // Fetch all courses
        const coursesResponse = await courseApi.getAll();
        const allCourses = (coursesResponse as any)?.data?.data as unknown as Course[] || [];

        // Fetch enrolled courses
        const enrolledResponse = await courseApi.getEnrolled();
        const enrolled = new Set(
          ((enrolledResponse as any) as Array<{ course_id: string }> || [])
            .map(e => e.course_id)
        );
        setEnrolledCourses(enrolled);

        // Build learning path based on gaps
        const pathSteps = buildLearningPath(allGaps, allCourses, enrolled);
        setPath(pathSteps);
      } catch (err) {
        console.error("Failed to fetch learning path:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLearningPath();
  }, [supabase]);

  function buildLearningPath(
    gaps: SkillGap[],
    courses: Course[],
    enrolled: Set<string>
  ): LearningPathStep[] {
    if (gaps.length === 0) {
      return [{
        id: "complete",
        title: "Assessment Complete",
        description: "Run the skill assessment to generate your personalized learning path.",
        courses: [],
        competency_gaps: [],
        estimated_hours: 0,
        completed: true,
        current: false,
      }];
    }

    // Group gaps by domain
    const domainGaps = new Map<string, SkillGap[]>();
    gaps.forEach(gap => {
      const domain = gap.competency?.domain?.name || "General";
      if (!domainGaps.has(domain)) domainGaps.set(domain, []);
      domainGaps.get(domain)!.push(gap);
    });

    // Create steps for each domain
    const steps: LearningPathStep[] = [];
    let stepIndex = 0;

    domainGaps.forEach((domainGapList, domain) => {
      const gapNames = domainGapList.map(g => g.competency?.name).filter(Boolean) as string[];
      
      // Find courses that address these gaps
      const relevantCourses = courses.filter(course => 
        course.target_competencies?.some(tc => gapNames.includes(tc)) ||
        gapNames.some(gn => course.title.toLowerCase().includes(gn.toLowerCase()))
      ).slice(0, 3);

      const stepCompleted = relevantCourses.length > 0 && relevantCourses.every(c => enrolled.has(c.id));
      const stepCurrent = !stepCompleted && stepIndex === 0;

      steps.push({
        id: `step-${domain.toLowerCase().replace(/\s+/g, "-")}`,
        title: `${domain} Foundation`,
        description: `Build core competencies in ${domain.toLowerCase()}: ${gapNames.slice(0, 3).join(", ")}`,
        courses: relevantCourses,
        competency_gaps: gapNames,
        estimated_hours: relevantCourses.reduce((sum, c) => sum + c.duration_hours, 0),
        completed: stepCompleted,
        current: stepCurrent,
      });

      stepIndex++;
    });

    // Add final certification step
    if (steps.length > 0) {
      steps.push({
        id: "certification",
        title: "Certification & Assessment",
        description: "Complete assessments to earn verified certificates for your competencies",
        courses: [],
        competency_gaps: [],
        estimated_hours: 2,
        completed: false,
        current: false,
      });
    }

    return steps;
  }

  const handleEnroll = async (course: Course) => {
    try {
      const response = await courseApi.enroll(course.id);
      if (response && (response as any).success) {
        setEnrolledCourses(prev => new Set([...prev, course.id]));
        if (course.course_url) {
          window.open(course.course_url, "_blank", "noopener,noreferrer");
        }
        alert(`Enrolled in "${course.title}"!`);
      }
    } catch (err) {
      alert("Enrollment failed");
    }
  };

  if (loading) {
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
            <Target className="w-6 h-6 text-primary-600" />
            Your Learning Path
          </h1>
          <p className="text-surface-600 mt-1">
            Personalized pathway based on your skill gaps
          </p>
        </div>
        <Link href="/assessment" className="btn btn-secondary">
          <Sparkles className="w-4 h-4 mr-2" />
          Re-run Assessment
        </Link>
      </div>

      {/* Path Steps */}
      <div className="space-y-6">
        {path.map((step, index) => (
          <div 
            key={step.id} 
            className={`relative bg-white rounded-xl shadow-md border p-6 transition-all ${
              step.current ? "border-primary-300 ring-2 ring-primary-200" : "border-surface-200"
            }`}
          >
            {/* Step connector line */}
            {index > 0 && (
              <div className="absolute left-6 top-0 bottom-0 w-0.5">
                <div className="h-full bg-surface-200" />
              </div>
            )}

            <div className="flex items-start gap-6">
              {/* Step Indicator */}
              <div className={`relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                step.completed 
                  ? "bg-green-100 text-green-600 border-2 border-green-300"
                  : step.current
                  ? "bg-primary-100 text-primary-600 border-2 border-primary-300 animate-pulse"
                  : "bg-surface-100 text-surface-400 border-2 border-surface-200"
              }`}>
                {step.completed ? (
                  <CheckCircle className="w-6 h-6" />
                ) : step.current ? (
                  <Sparkles className="w-6 h-6" />
                ) : (
                  <span className="font-bold text-lg">{index + 1}</span>
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-surface-900">{step.title}</h3>
                  {step.current && (
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                      Current Focus
                    </span>
                  )}
                  {step.completed && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-surface-600 mb-4">{step.description}</p>

                {/* Competency Gaps */}
                {step.competency_gaps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {step.competency_gaps.slice(0, 5).map((gap, i) => (
                      <span key={i} className="px-2 py-1 bg-accent-50 text-accent-700 text-xs rounded">
                        {gap}
                      </span>
                    ))}
                    {step.competency_gaps.length > 5 && (
                      <span className="px-2 py-1 bg-surface-100 text-surface-600 text-xs rounded">
                        +{step.competency_gaps.length - 5} more
                      </span>
                    )}
                  </div>
                )}

                {/* Courses */}
                {step.courses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-surface-700 mb-2">Recommended Courses:</p>
                    {step.courses.map((course) => {
                      const isEnrolled = enrolledCourses.has(course.id);
                      return (
                        <div 
                          key={course.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isEnrolled 
                              ? "bg-green-50 border-green-200" 
                              : "bg-surface-50 border-surface-200 hover:border-primary-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              course.is_tpac_classroom ? "bg-accent-100 text-accent-600" : "bg-primary-100 text-primary-600"
                            }`}>
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-surface-900">{course.title}</p>
                              <p className="text-xs text-surface-500 flex items-center gap-2">
                                <span>{course.provider}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {course.duration_hours}h
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isEnrolled ? (
                              <button
                                onClick={() => window.open(course.course_url || `/courses/${course.id}`, "_blank")}
                                className="btn btn-primary text-sm px-4 py-1.5 flex items-center gap-1"
                              >
                                <PlayCircle className="w-3 h-3" />
                                Start
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEnroll(course)}
                                className="btn btn-secondary text-sm px-4 py-1.5"
                              >
                                Enroll
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Step Summary */}
                <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-4 text-sm text-surface-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ~{step.estimated_hours} hours
                  </span>
                  {step.courses.length > 0 && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {step.courses.length} courses
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 text-surface-300">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {path.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-surface-200">
            <Sparkles className="w-16 h-16 mx-auto text-surface-300 mb-4" />
            <h3 className="text-lg font-medium text-surface-900 mb-2">No Learning Path Yet</h3>
            <p className="text-surface-600 mb-4">Run the AI Skill Assessment to generate your personalized learning path</p>
            <Link href="/assessment" className="btn btn-primary inline-flex">
              <Sparkles className="w-4 h-4 mr-2" />
              Start Assessment
            </Link>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg border border-surface-200 p-4">
        <h4 className="font-medium text-surface-900 mb-3">Path Status</h4>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm text-surface-700">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 border-2 border-primary-300 flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4 text-primary-600" />
            </div>
            <span className="text-sm text-surface-700">Current Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-surface-100 border-2 border-surface-200 flex items-center justify-center">
              <span className="font-bold text-surface-400 text-sm">1</span>
            </div>
            <span className="text-sm text-surface-700">Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-300 flex items-center justify-center">
              <Lock className="w-4 h-4 text-yellow-600" />
            </div>
            <span className="text-sm text-surface-700">Locked (Complete previous)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
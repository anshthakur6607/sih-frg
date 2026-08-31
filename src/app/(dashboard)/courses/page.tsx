/**
 * Courses Page
 * 
 * Displays course catalog with filters and recommendations.
 * Enrollment flow: Enroll → Open iGOT link in new tab → Show "Start Course"
 * 
 * Why: Users browse and enroll in courses from this page.
 */

"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock, MapPin, ExternalLink, Filter, Search, PlayCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { courseApi } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import AutoTranslate from "@/components/AutoTranslate";

interface Course {
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
}

interface EnrolledCourse {
  id: string;
  course_id: string;
  course: Course;
  status: string;
  created_at: string;
}

export default function CoursesPage() {
  const { t } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "igot" | "tpac">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch all courses
        const { data: coursesData } = await supabase
          .from("courses")
          .select("*")
          .order("created_at", { ascending: false });

        // Fetch user's enrolled courses
        const { data: { user } } = await supabase.auth.getUser();
        let enrolledData: EnrolledCourse[] = [];
        
        if (user) {
          const response = await courseApi.getEnrolled();
          if (response && Array.isArray(response)) {
            enrolledData = response as unknown as EnrolledCourse[];
          }
        }

        if (coursesData) setCourses(coursesData);
        setEnrolledCourses(enrolledData);
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filter, supabase]);

  const isEnrolled = (courseId: string) => {
    return enrolledCourses.some(e => e.course_id === courseId);
  };

  const getEnrollment = (courseId: string) => {
    return enrolledCourses.find(e => e.course_id === courseId);
  };

  const handleEnroll = async (course: Course) => {
    if (enrolling) return;
    
    setEnrolling(course.id);
    
    try {
      // 1. Enroll via backend API
      const response = await courseApi.enroll(course.id);
      
      if (response && (response as any).success) {
        // 2. Open course URL in new tab (if available)
        if (course.course_url) {
          window.open(course.course_url, "_blank", "noopener,noreferrer");
        }
        
        // 3. Refresh enrolled courses
        const enrolledResponse = await courseApi.getEnrolled();
        if (enrolledResponse && Array.isArray(enrolledResponse)) {
          setEnrolledCourses(enrolledResponse as unknown as EnrolledCourse[]);
        }
        
        // Show success toast
        alert(`Successfully enrolled in "${course.title}"!${course.course_url ? " Course opened in new tab." : ""}`);
      } else {
        alert(`Enrollment failed`);
      }
    } catch (err: any) {
      console.error("Enrollment error:", err);
      alert(`Enrollment failed: ${err.message || "Unknown error"}`);
    } finally {
      setEnrolling(null);
    }
  };

  const handleStartCourse = (course: Course) => {
    if (course.course_url) {
      window.open(course.course_url, "_blank", "noopener,noreferrer");
    } else {
      // Navigate to course player page
      window.location.href = `/courses/${course.id}`;
    }
  };

  const filteredCourses = courses
    .filter(course => {
      if (filter === "igot") return course.source === "iGOT";
      if (filter === "tpac") return course.is_tpac_classroom;
      return true;
    })
    .filter(course => 
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t("courses.title")}</h1>
          <p className="text-surface-600">{t("courses.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Courses" },
            { value: "igot", label: "iGOT Online" },
            { value: "tpac", label: "TPAC Classroom" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as typeof filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === option.value
                  ? "bg-primary-800 text-white"
                  : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-64"
          />
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => {
          const enrolled = isEnrolled(course.id);
          const enrollment = getEnrollment(course.id);
          
          return (
            <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-surface-200">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    course.is_tpac_classroom 
                      ? "bg-accent-100 text-accent-700" 
                      : "bg-primary-100 text-primary-700"
                  }`}>
                    {course.is_tpac_classroom ? "TPAC Classroom" : "Online"}
                  </span>
                  <span className="text-xs text-surface-500">{course.provider}</span>
                </div>

                <h3 className="text-lg font-semibold text-surface-900 mb-2"><AutoTranslate text={course.title} /></h3>
                <p className="text-sm text-surface-600 mb-4 line-clamp-2">
                  <AutoTranslate text={course.description || "No description available"} />
                </p>

                <div className="flex items-center gap-4 text-sm text-surface-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {course.duration_hours}h
                  </span>
                  {course.is_tpac_classroom && course.tpac_location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {course.tpac_location}
                    </span>
                  )}
                </div>

                {course.is_tpac_classroom && course.tpac_start_date && (
                  <div className="text-sm text-accent-600 mb-4">
                    Starts: {new Date(course.tpac_start_date).toLocaleDateString()}
                  </div>
                )}

                {/* Enrollment Status / Actions */}
                <div className="space-y-2">
                  {enrolled ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Enrolled {enrollment?.status === "approved" ? "(Approved)" : enrollment?.status === "pending" ? "(Pending)" : ""}</span>
                      </div>
                      <button
                        onClick={() => handleStartCourse(course)}
                        className="w-full btn btn-primary flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Course
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course)}
                      disabled={enrolling === course.id}
                      className="w-full btn btn-primary flex items-center justify-center gap-2"
                    >
                      {enrolling === course.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                          Enrolling...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4" />
                          Enroll Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p className="text-surface-500">No courses found</p>
        </div>
      )}
    </div>
  );
}
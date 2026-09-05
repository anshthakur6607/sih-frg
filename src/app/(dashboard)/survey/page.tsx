/**
 * Pre-Assessment Survey Page
 * 
 * Entry point for new users to get personalized course recommendations.
 * Collects: designation, department, experience, role, familiarity scores.
 * Feeds data to AI recommender to generate tailored learning paths.
 * 
 * Why: Government officials have diverse roles. A generic course list is useless.
 * This survey maps their specific context → personalized AI recommendations.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Users,
  Briefcase, 
  GraduationCap,
  Target,
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Brain,
  Sparkles,
  BookOpen,
  Award,
  Clock,
  Globe,
  Mic
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";

interface JobRole {
  id: string;
  code: string;
  title: string;
  department: string;
  level: string;
  required_competencies: string[];
}

interface FamiliarityLevel {
  name: string;
  level: number;
  description: string;
}

const FAMILIARITY_LEVELS: FamiliarityLevel[] = [
  { name: "Never heard", level: 0, description: "Complete beginner" },
  { name: "Familiar name", level: 1, description: "Know it exists but never used" },
  { name: "Basic", level: 2, description: "Used occasionally, need guidance" },
  { name: "Intermediate", level: 3, description: "Use regularly, comfortable" },
  { name: "Advanced", level: 4, description: "Expert level, can teach others" },
  { name: "Master", level: 5, description: "Leading practitioner" },
];

const CORE_COMPETENCIES = [
  { id: "survey_sampling", name: "Survey Sampling", domain: "Statistical" },
  { id: "national_accounts", name: "National Accounts", domain: "Statistical" },
  { id: "sdg_indicators", name: "SDG Indicators", domain: "Statistical" },
  { id: "data_quality", name: "Data Quality", domain: "Statistical" },
  { id: "census_ops", name: "Census Operations", domain: "Statistical" },
  { id: "python", name: "Python", domain: "Technical" },
  { id: "r_stats", name: "R for Statistics", domain: "Technical" },
  { id: "sql", name: "SQL / Databases", domain: "Technical" },
  { id: "gis", name: "GIS / Mapping", domain: "Technical" },
  { id: "ai_ml", name: "AI / Machine Learning", domain: "Technical" },
  { id: "data_viz", name: "Data Visualization", domain: "Technical" },
  { id: "cybersecurity", name: "Cybersecurity", domain: "Digital Governance" },
  { id: "data_privacy", name: "Data Privacy / DPDPA", domain: "Digital Governance" },
  { id: "dpi", name: "Digital Public Infrastructure", domain: "Digital Governance" },
  { id: "egovernance", name: "e-Governance", domain: "Digital Governance" },
  { id: "leadership", name: "Leadership", domain: "Behavioural" },
  { id: "communication", name: "Communication", domain: "Behavioural" },
  { id: "ethics", name: "Ethics in Public Service", domain: "Behavioural" },
  { id: "project_mgmt", name: "Project Management", domain: "Behavioural" },
  { id: "change_mgmt", name: "Change Management", domain: "Behavioural" },
];

const DEPARTMENTS = [
  "NSSO (National Sample Survey Office)",
  "CSO (Central Statistics Office)",
  "DIID (Data Innovation & Integration Division)",
  "SDR (Statistics Development & Regulation)",
  "ESD (Economic Statistics Division)",
  "SSD (Social Statistics Division)",
  "NIC (National Informatics Centre)",
  "MeitY (Ministry of Electronics & IT)",
  "State DES (Directorate of Economics & Statistics)",
  "Other",
];

const EXPERIENCE_LEVELS = [
  { value: "0-2", label: "0-2 years", description: "New entrant" },
  { value: "3-5", label: "3-5 years", description: "Early career" },
  { value: "6-10", label: "6-10 years", description: "Mid career" },
  { value: "11-15", label: "11-15 years", description: "Senior" },
  { value: "16+", label: "16+ years", description: "Veteran" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "or", name: "Odia" },
];

const MODALITY_PREFERENCES = [
  { value: "self_paced", label: "Self-Paced Online", icon: Clock, desc: "Learn at your own pace, anytime" },
  { value: "classroom", label: "Classroom / Workshop", icon: Users, desc: "In-person training sessions" },
  { value: "hybrid", label: "Hybrid (Blended)", icon: BookOpen, desc: "Mix of online + in-person" },
];

const TIME_AVAILABILITY = [
  { value: "low", label: "1-2 hrs/week", desc: "Very limited time" },
  { value: "medium", label: "3-5 hrs/week", desc: "Moderate availability" },
  { value: "high", label: "5+ hrs/week", desc: "Can dedicate significant time" },
];

const STEPS = [
  { id: 1, title: "Your Role", icon: Briefcase },
  { id: 2, title: "Experience", icon: GraduationCap },
  { id: 3, title: "Skills Self-Assessment", icon: Brain },
  { id: 4, title: "Preferences", icon: Target },
  { id: 5, title: "Quick Check", icon: Sparkles },
];

interface SurveyData {
  // Step 1: Role
  department: string;
  designation: string;
  job_role_id: string;
  
  // Step 2: Experience
  years_experience: string;
  education_level: string;
  
  // Step 3: Skills
  familiarity_scores: Record<string, number>;
  
  // Step 4: Preferences
  preferred_language: string;
  preferred_modality: string;
  time_availability: string;
  learning_goals: string[];
}

export default function SurveyPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const supabase = createClient();
  // AI mini-quiz state (Step 5)
  const [miniQuiz, setMiniQuiz] = useState<Array<{ id: string; text: string; options: string[]; correct_answer: number; explanation: string }>>([]);
  const [miniQuizLoading, setMiniQuizLoading] = useState(false);
  const [miniQuizAnswers, setMiniQuizAnswers] = useState<Record<string, number>>({});
  const [miniQuizError, setMiniQuizError] = useState<string | null>(null);

  const [submitStage, setSubmitStage] = useState<string>("");

  const [formData, setFormData] = useState<SurveyData>({
    department: "",
    designation: "",
    job_role_id: "",
    years_experience: "",
    education_level: "",
    familiarity_scores: {},
    preferred_language: "en",
    preferred_modality: "self_paced",
    time_availability: "medium",
    learning_goals: [],
  });

  useEffect(() => {
    loadJobRoles();
  }, []);

  const [rolesError, setRolesError] = useState<string | null>(null);

  async function loadJobRoles() {
    setRolesError(null);
    // 1) Try Supabase directly (public RLS) - works even if backend down
    try {
      const { data, error } = await supabase.from("job_roles").select("*").order("department", { ascending: true });
      if (!error && data && data.length > 0) {
        setJobRoles(data as JobRole[]);
        return;
      }
      if (error) console.warn("Supabase job_roles error:", error.message);
    } catch (e) {
      console.warn("Supabase job_roles exception", e);
    }

    // 2) Fallback: backend API (needs backend running)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/surveys/job-roles`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`Backend job-roles ${res.status}:`, body.slice(0, 200));
        setRolesError(`Backend returned ${res.status}. Is it running on ${apiUrl}? Run: cd backend && npm run dev`);
        return;
      }
      const json = await res.json();
      if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
        setJobRoles(json.data as JobRole[]);
        return;
      }
      setRolesError("Backend returned no job roles. Run fix_surveys.sql in Supabase.");
    } catch (err: any) {
      console.error("Failed to load job roles:", err);
      setRolesError(err?.message || "Failed to load job roles. Check backend and Supabase.");
    }
  }

  const updateFormData = (updates: Partial<SurveyData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleFamiliarityChange = (compId: string, level: number) => {
    updateFormData({
      familiarity_scores: {
        ...formData.familiarity_scores,
        [compId]: level,
      },
    });
  };

  async function generateMiniQuiz() {
    setMiniQuizLoading(true);
    setMiniQuizError(null);
    try {
      // Build weak-areas context from lowest familiarity scores + role
      const weak = Object.entries(formData.familiarity_scores)
        .filter(([, v]) => v <= 2)
        .map(([k]) => k)
        .slice(0, 6);
      const weakText = weak.length ? `Weak areas: ${weak.join(", ")}.` : "General statistical and governance topics.";
      const role = jobRoles.find(r => r.id === formData.job_role_id);
      const context = `${weakText} Role: ${role?.title || formData.designation} (${formData.department}). Experience: ${formData.years_experience}. Generate a 5-question quick check to validate self-assessment.`;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/api/ai/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_text: context,
          question_count: 5,
          bloom_levels: ["remember", "understand", "apply"],
          difficulty: 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `AI service returned ${res.status}`);
      }
      const json = await res.json();
      const qs = json.data?.questions || json.questions || [];
      if (!qs.length) throw new Error("AI returned no questions");
      setMiniQuiz(qs.slice(0, 5));
    } catch (e: any) {
      console.error("Mini quiz generation failed:", e);
      setMiniQuizError(e.message || "Failed to generate quiz. Is AI service running on port 8001?");
    } finally {
      setMiniQuizLoading(false);
    }
  }

  // Auto-generate quiz when entering step 5
  useEffect(() => {
    if (currentStep === 5 && miniQuiz.length === 0 && !miniQuizLoading && !miniQuizError) {
      generateMiniQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitStage("Saving your survey...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Parse years_experience from string range to a number
      const yearsMap: Record<string, number> = {
        "0-2": 1, "3-5": 4, "6-10": 8, "11-15": 13, "16+": 20
      };
      const yearsNum = yearsMap[formData.years_experience] ?? parseFloat(formData.years_experience) ?? 0;

      // Build survey payload — only include role_id if it's a real UUID
      const surveyPayload: Record<string, any> = {
        user_id: user.id,
        current_designation: formData.designation,
        years_experience: yearsNum,
        education_level: formData.education_level,
        familiarity_scores: formData.familiarity_scores,
        learning_goals: formData.learning_goals || [],
        preferred_modality: formData.preferred_modality,
        preferred_language: formData.preferred_language,
        time_availability: formData.time_availability,
        updated_at: new Date().toISOString(),
      };
      // Only set role_id if it's a valid UUID (from API)
      if (formData.job_role_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.job_role_id)) {
        surveyPayload.role_id = formData.job_role_id;
      }

      // 1. Save survey response
      const { error: surveyError } = await supabase.from("surveys").upsert(
        surveyPayload,
        { onConflict: 'user_id' }
      );

      if (surveyError) {
        console.error("Survey save error:", surveyError);
        alert(`Failed to save survey: ${surveyError.message}`);
        return;
      }

      // 2. Update profile
      const { error: profileError } = await supabase.from("profiles").update({
        department: formData.department,
        designation: formData.designation,
        years_experience: yearsNum,
        education: formData.education_level,
        preferred_language: formData.preferred_language,
      }).eq("id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // 3. Save mini-quiz attempt if answered (for AI calibration)
      if (miniQuiz.length > 0 && Object.keys(miniQuizAnswers).length > 0) {
        const correct = miniQuiz.filter(q => miniQuizAnswers[q.id] === q.correct_answer).length;
        const scorePct = Math.round((correct / miniQuiz.length) * 100);
        // Store quiz signal for feedback loop (retrain)
        await supabase.from("learning_signals").insert({
          user_id: user.id,
          course_id: null,
          signal_type: "survey_quiz_score",
          signal_value: scorePct,
          signal_metadata: {
            correct,
            total: miniQuiz.length,
            weak_areas: Object.entries(formData.familiarity_scores).filter(([, v]) => v <= 2).map(([k]) => k),
          },
        }).then(() => {}, () => {});
        // Optionally refine familiarity: wrong answers confirm weak areas
      }

      // 4. Run AI assessment with survey data (real Gemini via port 8001)
      const { data: { session } } = await supabase.auth.getSession();
      setSubmitStage("AI is assessing your skills...");
      let assessOk = true;
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/competencies/assess`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            designation: formData.designation,
            department: formData.department,
            years_experience: yearsNum,
            education: formData.education_level,
            familiarity_scores: formData.familiarity_scores,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.success === false) throw new Error(j.error || `Assess failed ${r.status}`);
      } catch (err: any) {
        console.error("Assessment error:", err);
        assessOk = false;
        // Don't block — recommendations/generate will also seed scores from survey directly
      }

      // 5. Generate AI recommendations (hybrid graph — searches real courses)
      setSubmitStage("Generating your personalized courses...");
      let recCount = 0;
      let recs: any[] = [];
      try {
        const r2 = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/recommendations/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
        });
        const j2 = await r2.json().catch(() => ({}));
        if (!r2.ok || j2.success === false) throw new Error(j2.error || `Recommendations failed ${r2.status}`);
        recCount = j2.data?.recommendations_generated ?? j2.data?.recommendations?.length ?? 0;
        recs = j2.data?.recommendations || [];
        // Stash for instant render on recommendations page (avoids flicker if GET is slow)
        try { sessionStorage.setItem('skillup_last_recommendations', JSON.stringify({ at: Date.now(), count: recCount, recommendations: recs })); } catch {}
      } catch (err: any) {
        console.error("Recommendations error:", err);
        setSubmitStage("");
        alert(`Recommendations failed: ${err.message}. Your survey is saved — try again from the Recommendations page.`);
        router.push("/recommendations?error=generate_failed");
        return;
      }

      setSubmitStage(`Done — ${recCount} courses ready!`);
      // Small delay so user sees success, then navigate with fresh flag so recommendations page can show a banner
      await new Promise(r => setTimeout(r, 600));
      router.push(`/recommendations?fresh=1&count=${recCount}`);
    } catch (err: any) {
      console.error("Submit error:", err);
      alert(`Survey failed: ${err.message}`);
    } finally {
      setSubmitting(false);
      setSubmitStage("");
    }
  };

  const displayedRoles = formData.department 
    ? jobRoles.filter(r => r.department?.toLowerCase().includes(formData.department.toLowerCase()))
    : jobRoles;

  const competencyGroups = CORE_COMPETENCIES.reduce((acc, comp) => {
    if (!acc[comp.domain]) acc[comp.domain] = [];
    acc[comp.domain].push(comp);
    return acc;
  }, {} as Record<string, typeof CORE_COMPETENCIES>);

  return (
    <div className="min-h-screen bg-surface-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-surface-900">{t("survey.title")}</h1>
          <p className="text-surface-600 mt-2">
            {t("survey.subtitle")}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep > step.id 
                  ? "bg-primary-600 text-white" 
                  : currentStep === step.id 
                  ? "bg-primary-600 text-white ring-4 ring-primary-100" 
                  : "bg-surface-200 text-surface-500"
              }`}>
                {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`ml-2 text-sm font-medium hidden sm:inline ${
                currentStep >= step.id ? "text-surface-900" : "text-surface-400"
              }`}>
                {({1: t("survey.role"), 2: t("survey.experience"), 3: t("survey.skills"), 4: t("survey.preferences"), 5: t("survey.quickCheck")}[step.id] || step.title)}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${
                  currentStep > step.id ? "bg-primary-600" : "bg-surface-200"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1: Role */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Ministry / Department *
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => updateFormData({ department: e.target.value, job_role_id: "" })}
                  className="input w-full"
                >
                  <option value="">Select your department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Current Designation *
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => updateFormData({ designation: e.target.value })}
                  placeholder="e.g., Statistical Officer, Deputy Director"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Job Role (select closest match)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {displayedRoles.slice(0, 12).map((role) => (
                    <button
                      key={role.id}
                      onClick={() => updateFormData({ job_role_id: role.id })}
                      className={`p-3 text-left rounded-lg border transition-colors ${
                        formData.job_role_id === role.id
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-surface-200 hover:border-primary-300"
                      }`}
                    >
                      <p className="font-medium text-sm">{role.title}</p>
                      <p className="text-xs text-surface-500">{role.department} · {role.level}</p>
                    </button>
                  ))}
                </div>
                {rolesError && jobRoles.length === 0 && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">{rolesError}</p>
                    <button onClick={loadJobRoles} className="mt-2 text-xs font-medium text-amber-700 underline">Retry</button>
                  </div>
                )}
                {!rolesError && jobRoles.length === 0 && (
                  <p className="text-sm text-surface-500 mt-2 flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-surface-300 border-t-primary-600 rounded-full animate-spin" /> Loading roles...
                  </p>
                )}
                {jobRoles.length > 0 && displayedRoles.length === 0 && formData.department && (
                  <p className="text-sm text-surface-500 mt-2">
                    No roles match this department. You can still continue — just enter your designation above.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Education Level
                </label>
                <select
                  value={formData.education_level}
                  onChange={(e) => updateFormData({ education_level: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select education level</option>
                  <option value="Bachelor's">Bachelor's Degree</option>
                  <option value="Master's">Master's Degree</option>
                  <option value="PhD">PhD / Doctorate</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Experience */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Years of Experience *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {EXPERIENCE_LEVELS.map((exp) => (
                    <button
                      key={exp.value}
                      onClick={() => updateFormData({ years_experience: exp.value })}
                      className={`p-4 text-left rounded-lg border transition-colors ${
                        formData.years_experience === exp.value
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-surface-200 hover:border-primary-300"
                      }`}
                    >
                      <p className="font-semibold">{exp.label}</p>
                      <p className="text-sm text-surface-500">{exp.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">How AI uses this</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Based on your experience level, the AI will calibrate course difficulty 
                      and recommend paths that match your career stage. Senior officials get 
                      leadership courses, while newer entrants focus on foundational skills.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Skills Self-Assessment */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-primary-900">Rate Your Familiarity</p>
                    <p className="text-sm text-primary-700 mt-1">
                      Be honest! This helps the AI understand your starting point. 
                      Courses will be recommended based on your gaps, not what you already know.
                    </p>
                  </div>
                </div>
              </div>

              {Object.entries(competencyGroups).map(([domain, comps]) => (
                <div key={domain}>
                  <h4 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-3">
                    {domain}
                  </h4>
                  <div className="space-y-3">
                    {comps.map((comp) => (
                      <div key={comp.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                        <span className="text-sm font-medium text-surface-900">{comp.name}</span>
                        <div className="flex gap-1">
                          {FAMILIARITY_LEVELS.map((level) => (
                            <button
                              key={level.level}
                              onClick={() => handleFamiliarityChange(comp.id, level.level)}
                              title={`${level.name}: ${level.description}`}
                              className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                                (formData.familiarity_scores[comp.id] || 0) === level.level
                                  ? "bg-primary-600 text-white"
                                  : "bg-white border border-surface-200 text-surface-600 hover:border-primary-300"
                              }`}
                            >
                              {level.level}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Preferences */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-3">
                  Preferred Language for Learning
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => updateFormData({ preferred_language: lang.code })}
                      className={`p-3 text-left rounded-lg border transition-colors ${
                        formData.preferred_language === lang.code
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-surface-200 hover:border-primary-300"
                      }`}
                    >
                      <p className="font-medium">{lang.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-3">
                  Learning Modality Preference
                </label>
                <div className="space-y-2">
                  {MODALITY_PREFERENCES.map((mod) => (
                    <button
                      key={mod.value}
                      onClick={() => updateFormData({ preferred_modality: mod.value })}
                      className={`w-full p-4 text-left rounded-lg border transition-colors flex items-center gap-4 ${
                        formData.preferred_modality === mod.value
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-surface-200 hover:border-primary-300"
                      }`}
                    >
                      <mod.icon className="w-6 h-6" />
                      <div>
                        <p className="font-medium">{mod.label}</p>
                        <p className="text-sm text-surface-500">{mod.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-3">
                  Time You Can Dedicate Weekly
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {TIME_AVAILABILITY.map((time) => (
                    <button
                      key={time.value}
                      onClick={() => updateFormData({ time_availability: time.value })}
                      className={`p-4 text-left rounded-lg border transition-colors ${
                        formData.time_availability === time.value
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-surface-200 hover:border-primary-300"
                      }`}
                    >
                      <p className="font-semibold">{time.label}</p>
                      <p className="text-sm text-surface-500">{time.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: AI Quick Check (small quiz generated from AI) */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">AI Quick Check — 5 questions</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Generated by Gemini on port 8001 from your weak areas and role. This validates your self-assessment so recommendations are accurate. No fallback — real AI only.
                    </p>
                  </div>
                </div>
              </div>

              {miniQuizLoading && (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                  <p className="text-sm text-surface-600">Generating your personalized quiz via AI service (port 8001)...</p>
                </div>
              )}

              {miniQuizError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium">AI quiz generation failed</p>
                  <p className="text-sm text-red-700 mt-1">{miniQuizError}</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={generateMiniQuiz} className="btn btn-secondary text-sm">Retry (check AI service on 8001)</button>
                    <button onClick={() => { setMiniQuiz([]); setMiniQuizError(null); }} className="btn btn-secondary text-sm">Skip Quiz & Continue</button>
                  </div>
                  <p className="text-xs text-red-600 mt-2">Check backend logs (port 3001) and AI logs (8001) — ensure GOOGLE_API_KEY is valid and X-API-Key matches.</p>
                </div>
              )}

              {!miniQuizLoading && !miniQuizError && miniQuiz.length > 0 && (
                <div className="space-y-4">
                  {miniQuiz.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-surface-50 rounded-lg border">
                      <p className="font-medium text-surface-900 mb-2">
                        <span className="text-primary-600 mr-2">Q{idx + 1}.</span>{q.text}
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const selected = miniQuizAnswers[q.id] === oi;
                          return (
                            <button
                              key={oi}
                              onClick={() => setMiniQuizAnswers(prev => ({ ...prev, [q.id]: oi }))}
                              className={`w-full text-left p-2.5 rounded border text-sm flex items-center gap-2 ${selected ? "bg-primary-50 border-primary-500 text-primary-800" : "bg-white border-surface-200 hover:border-primary-300"}`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${selected ? "bg-primary-600 text-white" : "bg-surface-100"}`}>
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-surface-500">
                    Answered {Object.keys(miniQuizAnswers).length} / {miniQuiz.length}. Your score refines the AI recommendations.
                  </p>
                </div>
              )}

              {!miniQuizLoading && !miniQuizError && miniQuiz.length === 0 && (
                <p className="text-sm text-surface-500">Waiting to generate quiz...</p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-200">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="btn btn-secondary flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="btn btn-primary flex items-center gap-2"
                disabled={
                  (currentStep === 1 && (!formData.department || !formData.designation)) ||
                  (currentStep === 2 && !formData.years_experience) ||
                  (currentStep === 3 && Object.keys(formData.familiarity_scores).length === 0)
                }
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || miniQuizLoading}
                className="btn btn-primary flex items-center gap-2 text-lg px-6 py-3 min-w-[240px] justify-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {submitStage || "Generating Your Path..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {t("survey.getRecommendations")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Privacy Note */}
        <p className="text-center text-xs text-surface-500 mt-4">
          Your responses are used only for personalized learning recommendations.
          No data is shared with third parties.
        </p>
      </div>
    </div>
  );
}
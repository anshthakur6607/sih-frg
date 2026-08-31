/**
 * Profile Setup / Onboarding Page
 * 
 * Multi-step wizard for completing user profile.
 * Collects professional details and captures consent.
 * 
 * Why: Essential for initial competency mapping.
 * Users must complete this before accessing the full platform.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  GraduationCap, 
  User, 
  Building, 
  Briefcase, 
  Shield,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { profileApi } from "@/lib/api";

/**
 * Form data type
 */
interface ProfileFormData {
  // Step 1: Personal Details
  full_name: string;
  designation: string;
  department: string;
  ministry: string;
  organization_level: string;
  
  // Step 2: Professional Background
  current_assignment: string;
  education: string;
  years_experience: string;
  
  // Step 3: Preferences
  preferred_language: string;
  voice_navigation_enabled: boolean;
  
  // Step 4: Consent
  consent_given: boolean;
}

/**
 * Department options
 */
const DEPARTMENTS = [
  "NSSO (National Sample Survey Office)",
  "CSO (Central Statistics Office)",
  "DIID (Data Innovation & Integration Division)",
  "SDR (Statistics Development & Regulation)",
  "ESD (Economic Statistics Division)",
  "SSD (Social Statistics Division)",
  "Other"
];

/**
 * Language options
 */
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "mr", name: "Marathi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "or", name: "Odia" },
];

const STEPS = [
  { id: 1, title: "Personal Details", icon: User },
  { id: 2, title: "Professional", icon: Briefcase },
  { id: 3, title: "Preferences", icon: Building },
  { id: 4, title: "Consent", icon: Shield },
];

export default function SetupProfilePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: "",
    designation: "",
    department: "",
    ministry: "MoSPI",
    organization_level: "Central",
    current_assignment: "",
    education: "",
    years_experience: "",
    preferred_language: "en",
    voice_navigation_enabled: true,
    consent_given: false,
  });

  /**
   * Load existing profile data
   */
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFormData(prev => ({
          ...prev,
          full_name: profile.full_name || prev.full_name,
          designation: profile.designation || prev.designation,
          department: profile.department || prev.department,
          ministry: profile.ministry || prev.ministry,
          organization_level: profile.organization_level || prev.organization_level,
          current_assignment: profile.current_assignment || "",
          education: profile.education || "",
          years_experience: profile.years_experience?.toString() || "",
          preferred_language: profile.preferred_language || "en",
          voice_navigation_enabled: profile.voice_navigation_enabled ?? true,
          consent_given: profile.consent_given,
        }));
      }
    }

    loadProfile();
  }, [supabase, router]);

  /**
   * Handle input change
   */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
    setError(null);
  }

  /**
   * Validate current step
   */
  function validateStep(step: number): boolean {
    switch (step) {
      case 1:
        return !!(formData.full_name && formData.designation && formData.department);
      case 2:
        return true; // Optional fields
      case 3:
        return !!formData.preferred_language;
      case 4:
        return formData.consent_given;
      default:
        return true;
    }
  }

  /**
   * Handle step navigation
   */
  function handleNext() {
    if (!validateStep(currentStep)) {
      setError("Please fill in all required fields");
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    setError(null);
  }

  function handleBack() {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  }

  /**
   * Handle form submission
   */
   async function handleSubmit() {
    if (!formData.consent_given) {
      setError("Please accept the terms to continue");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Submitting profile update...');
      
      const updatePayload: Record<string, unknown> = {
        full_name: formData.full_name,
        designation: formData.designation,
        department: formData.department,
        ministry: formData.ministry,
        organization_level: formData.organization_level,
        current_assignment: formData.current_assignment || null,
        years_experience: formData.years_experience ? parseFloat(formData.years_experience) : null,
        preferred_language: formData.preferred_language,
        voice_navigation_enabled: formData.voice_navigation_enabled,
        consent_given: formData.consent_given,
        consent_timestamp: formData.consent_given ? new Date().toISOString() : null,
      };
      if (formData.education) {
        updatePayload.education = formData.education;
      }
      
      const response = await profileApi.update(updatePayload);
      console.log('Profile update response:', response);

      console.log('Profile update succeeded, redirecting to dashboard...');
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Profile update error:", JSON.stringify(err), err);
      let msg = 'Unknown error';
      if (err && typeof err === 'object') {
        msg = (err as Record<string, string>).message
          || (err as Record<string, string>).error
          || JSON.stringify(err);
      } else if (err instanceof Error) {
        msg = err.message;
      } else {
        msg = String(err);
      }
      setError(`Failed to save profile: ${msg}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-primary-800 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-primary-800">SkillUp</span>
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">Complete Your Profile</h1>
          <p className="text-surface-600 mt-2">Set up your profile to get personalized learning recommendations</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-colors
                      ${isActive ? "bg-primary-800 text-white" : 
                        isCompleted ? "bg-green-500 text-white" : "bg-surface-200 text-surface-500"}
                    `}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-1 ${isActive ? "text-primary-800 font-medium" : "text-surface-500"}`}>
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`w-16 sm:w-24 h-0.5 mx-2 ${isCompleted ? "bg-green-500" : "bg-surface-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Step 1: Personal Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">Personal Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  className="input"
                  placeholder="e.g., Statistical Officer, Deputy Director"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Ministry</label>
                  <input
                    type="text"
                    name="ministry"
                    value={formData.ministry}
                    onChange={handleChange}
                    className="input"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Level</label>
                  <select
                    name="organization_level"
                    value={formData.organization_level}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="Central">Central</option>
                    <option value="State">State</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Background */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">Professional Background</h2>
              
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Current Assignment
                </label>
                <textarea
                  name="current_assignment"
                  value={formData.current_assignment}
                  onChange={handleChange}
                  className="input min-h-[80px]"
                  placeholder="Describe your current role and responsibilities"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Education / Qualifications
                </label>
                <input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  className="input"
                  placeholder="e.g., M.Sc. Statistics, MBA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  name="years_experience"
                  value={formData.years_experience}
                  onChange={handleChange}
                  className="input"
                  placeholder="e.g., 5"
                  min="0"
                  max="50"
                />
              </div>
            </div>
          )}

          {/* Step 3: Preferences */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">Preferences</h2>
              
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">
                  Preferred Language
                </label>
                <select
                  name="preferred_language"
                  value={formData.preferred_language}
                  onChange={handleChange}
                  className="input"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-4 bg-surface-50 rounded-lg">
                <input
                  type="checkbox"
                  name="voice_navigation_enabled"
                  id="voice_navigation"
                  checked={formData.voice_navigation_enabled}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="voice_navigation" className="text-sm text-surface-700">
                  Enable voice navigation for accessibility
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Consent */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">Consent & Agreement</h2>
              
              <div className="p-4 bg-surface-50 rounded-lg">
                <h3 className="font-medium text-surface-900 mb-2">Terms of Use</h3>
                <p className="text-sm text-surface-600 mb-4">
                  By completing your profile, you agree to:
                </p>
                <ul className="text-sm text-surface-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Allow competency profiling based on your role and background</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Receive personalized learning recommendations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Track your learning progress and earn certificates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Data may be used for aggregate analytics (anonymized)</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-start gap-3 p-4 border border-surface-200 rounded-lg">
                <input
                  type="checkbox"
                  name="consent_given"
                  id="consent"
                  checked={formData.consent_given}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded mt-1"
                />
                <label htmlFor="consent" className="text-sm text-surface-700">
                  <span className="font-medium">I agree to the terms of use and consent</span>
                  <span className="text-red-500"> *</span>
                  <p className="text-surface-500 mt-1">
                    This is required to access the SkillUp platform.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-surface-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                currentStep === 1 
                  ? "text-surface-300 cursor-not-allowed" 
                  : "text-surface-600 hover:bg-surface-100"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 btn btn-primary"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.consent_given}
                className="flex items-center gap-2 btn btn-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
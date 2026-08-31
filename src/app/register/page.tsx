/**
 * Register Page
 * 
 * User registration page for the SkillUp platform.
 * Collects basic information to create an account.
 * 
 * Why: Entry point for new users to join the platform.
 * Part of the auth flow - followed by profile onboarding.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { GraduationCap, Eye, EyeOff, Loader2, Mail, Lock, User, Building } from "lucide-react";
import { authApi } from "@/lib/api";

/**
 * Registration form data
 */
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  designation: string;
  department: string;
}

/**
 * Form validation errors
 */
interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  full_name?: string;
  designation?: string;
  department?: string;
  general?: string;
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
 * Designation options based on typical government roles
 */
const DESIGNATIONS = [
  "Statistical Officer",
  "Senior Statistical Officer",
  "Principal Statistical Officer",
  "Deputy Director",
  "Director",
  "Joint Secretary",
  "Other"
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    designation: "",
    department: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  /**
   * Validate form data
   */
  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.full_name) {
      newErrors.full_name = "Full name is required";
    } else if (formData.full_name.length < 2) {
      newErrors.full_name = "Please enter your full name";
    }

    if (!formData.designation) {
      newErrors.designation = "Please select your designation";
    }

    if (!formData.department) {
      newErrors.department = "Please select your department";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  /**
   * Format auth errors into user-friendly messages
   */
  function formatAuthError(error: unknown): string {
    const err = error as { message?: string; code?: string };
    const message = err?.message || "An unknown error occurred";
    const code = err?.code;

    // Handle specific Supabase auth error codes
    if (code === 'USER_EXISTS' || message.includes("already exists")) {
      return "An account with this email already exists. Please sign in instead.";
    }
    if (code === 'AUTH_CREATION_FAILED') {
      return "Failed to create user account. Please try again.";
    }
    if (code === 'PROFILE_CREATION_FAILED') {
      return "Failed to create user profile. Please try again.";
    }
    if (message.includes("Database error") || message.includes("temporary database error")) {
      return "A temporary database error occurred. Please try again in a few moments.";
    }
    if (message.includes("Network error") || message.includes("fetch")) {
      return "Network error. Please check your internet connection and try again.";
    }
    if (message.includes("Timeout")) {
      return "Request timed out. Please try again.";
    }

    // Default error handling
    if (message && message !== "An unknown error occurred") {
      return message;
    }
    return "Registration failed. Please try again.";
  }

  /**
   * Retry registration through the backend API with simple retry logic
   */
  async function retryRegistration(
    attempt: number
  ): Promise<unknown> {
    try {
      const data = await authApi.register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        designation: formData.designation,
        department: formData.department,
      });
      return data;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        retryCountRef.current = attempt;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        return retryRegistration(attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Register via backend API
      await retryRegistration(1);

      router.push("/login?registered=true");
    } catch (error: unknown) {
      console.error("Registration error:", error);
      const err = error as { message?: string };
      const errorMessage = formatAuthError(error);

      // Handle specific error types
      if (errorMessage.includes("already exists")) {
        setErrors({
          email: "An account with this email already exists. Please sign in.",
        });
      } else if (errorMessage.includes("Database") || errorMessage.includes("temporary")) {
        setErrors({
          general: `${errorMessage} [Error code: DB_RETRY_${retryCountRef.current}]`,
        });
      } else {
        setErrors({
          general: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle input change
   */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-800 to-primary-900 items-center justify-center p-12">
        <div className="max-w-lg text-center text-white">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Join SkillUp Today
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Create your account to start your competency development journey with AI-powered insights and personalized learning paths.
          </p>
          <div className="space-y-3 text-left bg-white/10 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">1</div>
              <span>Complete your profile</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">2</div>
              <span>Take baseline assessment</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">3</div>
              <span>Get personalized recommendations</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm">4</div>
              <span>Earn verified certificates</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-surface-50">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 bg-primary-800 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-primary-800">SkillUp</span>
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-surface-900">
              Create Account
            </h1>
            <p className="mt-2 text-surface-600">
              Register to access the skill intelligence platform
            </p>
          </div>

          {/* Error Message */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-surface-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={handleChange}
                  className={`input pl-14 ${errors.full_name ? "input-error" : ""}`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.full_name && (
                <p className="mt-1 text-sm text-status-error">{errors.full_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input pl-14 ${errors.email ? "input-error" : ""}`}
                  placeholder="you@example.gov.in"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-status-error">{errors.email}</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-surface-700 mb-1">
                Department
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-surface-400" />
                </div>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                   className={`input pl-14 ${errors.department ? "input-error" : ""}`}
                 >
                  <option value="">Select your department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              {errors.department && (
                <p className="mt-1 text-sm text-status-error">{errors.department}</p>
              )}
            </div>

            {/* Designation */}
            <div>
              <label htmlFor="designation" className="block text-sm font-medium text-surface-700 mb-1">
                Designation
              </label>
              <div className="relative">
                <select
                  id="designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                   className={`input pl-14 ${errors.designation ? "input-error" : ""}`}
                 >
                  <option value="">Select your designation</option>
                  {DESIGNATIONS.map((desig) => (
                    <option key={desig} value={desig}>
                      {desig}
                    </option>
                  ))}
                </select>
              </div>
              {errors.designation && (
                <p className="mt-1 text-sm text-status-error">{errors.designation}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  className={`input pl-14 pr-10 ${errors.password ? "input-error" : ""}`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-surface-400 hover:text-surface-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-surface-400 hover:text-surface-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-status-error">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-surface-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`input pl-14 ${errors.confirmPassword ? "input-error" : ""}`}
                  placeholder="Re-enter your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-status-error">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-surface-600">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 hover:text-primary-800 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
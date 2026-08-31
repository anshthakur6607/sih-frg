/**
 * Login Page
 * 
 * User authentication page for the SkillUp platform.
 * Allows users to sign in with email and password.
 * 
 * Why: Entry point for returning users to access the platform.
 * Government-style professional design.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase";


/**
 * Login form data type
 */
interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Form validation errors
 */
interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  const retryCountRef = useRef(0);

  /**
   * Format auth errors into user-friendly messages
   */
  function formatAuthError(error: unknown): string {
    const err = error as { message?: string; code?: string };
    const message = err?.message || "An unknown error occurred";
    const code = err?.code;

    // Handle specific Supabase auth error codes
    if (code === 'invalid_credentials') {
      return "Invalid email or password. Please check and try again.";
    }
    if (code === 'user_not_found') {
      return "No account found with this email. Please register first.";
    }
    if (code === 'session_expired') {
      return "Your session has expired. Please sign in again.";
    }
    if (code === 'user_recovering') {
      return "Account is being recovered. Please try again in a few moments.";
    }
    if (code === 'too_many_attempts') {
      return "Too many failed attempts. Please wait before trying again.";
    }
    if (message.includes("Database error")) {
      return `A temporary database error occurred. Please try again [retry: ${retryCountRef.current}]`;
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
    return "Login failed. Please check your credentials and try again.";
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
      // Sign in with Supabase to establish session (needed for RLS)
      const supabase = createClient();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      // Retry logic for transient database errors
      if (error && error.message?.includes("Database")) {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retryCountRef.current));
          const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (!error2) {
            data = data2;
            error = error2;
          }
        }
      }

      if (error) throw error;
 


      // Clear any stale backend JWT from localStorage
      // (Supabase session token should be used instead)
      window.localStorage.removeItem('access_token');

      // Check if profile is complete (onboarding done)
      if (data?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('designation, department')
          .eq('id', data.user.id)
          .single();

        // Redirect based on profile completion
        if (profile?.designation && profile?.department) {
          router.push('/dashboard');
        } else {
          router.push('/setup-profile');
        }
      } else {
        throw new Error('No user data returned from authentication');
      }
    } catch (error: unknown) {
      console.error("Login error:", error);
      const formattedError = formatAuthError(error);
      setErrors({
        general: formattedError,
      });
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handle input change
   */
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 bg-primary-800 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-primary-800">SkillUp</span>
            </Link>
            <h1 className="mt-6 text-2xl font-bold text-surface-900">
              Welcome Back
            </h1>
            <p className="mt-2 text-surface-600">
              Sign in to access your learning dashboard
            </p>
          </div>

          {/* Error Message */}
          {errors.general && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{errors.general}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
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
                  autoComplete="email"
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

            {/* Password Field */}
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
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input pl-14 pr-10 ${errors.password ? "input-error" : ""}`}
                  placeholder="Enter your password"
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

            {/* Forgot Password Link */}
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                Forgot your password?
              </Link>
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
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Register Link */}
          <p className="mt-8 text-center text-sm text-surface-600">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary-600 hover:text-primary-800 font-medium">
              Register here
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-800 to-primary-900 items-center justify-center p-12">
        <div className="max-w-lg text-center text-white">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Skill Intelligence Platform
          </h2>
          <p className="text-primary-100 text-lg mb-8">
            Assess your competencies, identify skill gaps, and chart your learning journey with AI-powered insights.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">50+</div>
              <div className="text-sm text-primary-200">Competencies</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">4</div>
              <div className="text-sm text-primary-200">Domains</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">AI</div>
              <div className="text-sm text-primary-200">Powered</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
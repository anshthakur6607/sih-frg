/**
 * API Client for SkillUp Backend
 * 
 * This module provides typed methods for communicating with the backend API.
 * Handles authentication, request/response formatting, and error handling.
 * 
 * Why: Centralizes API calls with proper typing and error handling.
 * Makes it easy to update endpoints and handle auth tokens.
 */

import { createClient as createSupabaseClient } from './supabase';

/**
 * Typed error used by apiRequest to expose HTTP status and a stable code
 * that the UI can switch on (e.g. 'MAINTENANCE').
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Base API URL
 * Defaults to localhost in development
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Global flag: when `true` the frontend should display a maintenance/offline
 * banner instead of making further API calls that will necessarily fail.
 */
const MAINTENANCE_EVENT = 'skillup-maintenance';
let backendOffline = false;
export const isBackendOffline = () => backendOffline;

function setBackendOffline(value: boolean) {
  backendOffline = value;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: { offline: value } }));
  }
}

/**
 * Lightweight health check used to detect when the backend (or Supabase) is
 * unreachable. Safe to call on app load; resolves quickly if the server is up.
 */
export async function checkBackendHealth(timeoutMs = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(id);
    const ok = res.ok;
    setBackendOffline(!ok);
    return ok;
  } catch {
    setBackendOffline(true);
    return false;
  }
}

/**
 * Get auth token for backend API requests
 * 
 * Why: The backend now accepts both custom backend JWTs and Supabase session tokens.
 * First checks localStorage for a stored backend JWT, then falls back to the
 * Supabase session token if available.
 */
let _supabase: ReturnType<typeof createSupabaseClient> | null = null;
function getSupabase() {
  if (!_supabase && typeof window !== 'undefined') {
    _supabase = createSupabaseClient();
  }
  return _supabase;
}

async function getAuthToken(): Promise<string | null> {
  // First try Supabase session token (most reliable)
  const client = getSupabase();
  if (client) {
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token) return session.access_token;
  }
  // Fall back to localStorage only if no Supabase session
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('access_token');
    if (stored) return stored;
  }
  return null;
}

/**
 * Make authenticated API request
 * 
 * @param endpoint - API endpoint path (e.g., '/api/profile')
 * @param options - Fetch options (method, body, etc.)
 * 
 * Why: Automatically adds auth token and handles common errors.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    // Failed to fetch → backend is unreachable (offline, CORS, DNS, etc.)
    setBackendOffline(true);
    throw new ApiError(
      'Unable to reach the server. We are currently under maintenance.',
      0,
      'MAINTENANCE'
    );
  }

  // Reset offline flag if the backend is back up
  if (backendOffline && response.ok) {
    setBackendOffline(false);
  }

  // Handle error responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const statusCode = response.status;

    // Treat persistent server/network failures as maintenance
    if (
      statusCode >= 500 ||
      statusCode === 403 ||
      statusCode === 404
    ) {
      setBackendOffline(true);
    }

    const message = error.error || error.detail || error.message || `API error: ${statusCode}`;
    throw new ApiError(message, statusCode, error.code || 'API_ERROR');
  }

  return response.json();
}

// ============================================
// Auth API
// ============================================

export const authApi = {
  /**
   * Register a new user
   */
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    designation: string;
    department: string;
    ministry?: string;
    organization_level?: string;
  }) =>
    apiRequest<{ success: boolean; data: { access_token: string; user: unknown; profile: unknown } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Login with email/password
   */
  login: (email: string, password: string) =>
    apiRequest<{ success: boolean; data: { access_token: string; user: unknown; profile: unknown } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Logout
   */
  logout: () =>
    apiRequest<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  /**
   * Get current user info
   */
  me: () =>
    apiRequest<{ user: unknown; profile: unknown }>('/api/auth/me', {
      method: 'GET',
    }),
};

// ============================================
// Profile API
// ============================================

export const profileApi = {
  /**
   * Get current user's profile
   */
  get: () => apiRequest<{ success: boolean; data: Record<string, unknown> }>('/api/profile', { method: 'GET' }),

  /**
   * Update profile
   */
  update: (data: Record<string, unknown>) =>
    apiRequest<{ success: boolean; data: Record<string, unknown>; error?: string }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Complete onboarding
   */
  completeOnboarding: (data: Record<string, unknown>) =>
    apiRequest<{ success: boolean; data: Record<string, unknown>; error?: string }>('/api/profile/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Get competency scores
   */
  getCompetencies: () =>
    apiRequest<unknown[]>('/api/profile/competencies', { method: 'GET' }),
};

// ============================================
// Competency API
// ============================================

export const competencyApi = {
  /**
   * Get all competency domains
   */
  getDomains: () => apiRequest<unknown[]>('/api/competencies/domains', { method: 'GET' }),

  /**
   * Get all competencies
   */
  getAll: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<unknown[]>(`/api/competencies${query}`, { method: 'GET' });
  },

  /**
   * Get skill gap analysis
   */
  getGaps: () => apiRequest<unknown>('/api/competencies/gaps', { method: 'GET' }),

  /**
   * Run AI assessment
   */
  assess: () =>
    apiRequest<unknown>('/api/competencies/assess', {
      method: 'POST',
    }),
};

// ============================================
// Course API
// ============================================

export const courseApi = {
  /**
   * Get courses with filters
   */
  getAll: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: unknown[]; pagination: unknown }>(`/api/courses${query}`, {
      method: 'GET',
    });
  },

  /**
   * Get course details
   */
  getById: (id: string) => apiRequest<unknown>(`/api/courses/${id}`, { method: 'GET' }),

  /**
   * Get recommended courses
   */
  getRecommended: (limit = 10) =>
    apiRequest<unknown[]>(`/api/courses/recommended?limit=${limit}`, { method: 'GET' }),

  /**
   * Get enrolled courses
   */
  getEnrolled: () => apiRequest<unknown[]>('/api/courses/enrolled', { method: 'GET' }),

  /**
   * Enroll in a course
   */
  enroll: (courseId: string) =>
    apiRequest<unknown>(`/api/courses/${courseId}/enroll`, {
      method: 'POST',
    }),

  /**
   * Get TPAC calendar
   */
  getTpacCalendar: (limit = 20) =>
    apiRequest<unknown[]>(`/api/courses/tpac/calendar?limit=${limit}`, { method: 'GET' }),
};

// ============================================
// Assessment API
// ============================================

export const assessmentApi = {
  /**
   * Get assessment history
   */
  getAll: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: unknown[]; pagination: unknown }>(`/api/assessments${query}`, {
      method: 'GET',
    });
  },

  /**
   * Get assessment details
   */
  getById: (id: string) => apiRequest<unknown>(`/api/assessments/${id}`, { method: 'GET' }),

  /**
   * Start assessment
   */
  start: (courseId: string) =>
    apiRequest<unknown>('/api/assessments/start', {
      method: 'POST',
      body: JSON.stringify({ course_id: courseId }),
    }),

  /**
   * Submit assessment
   */
  submit: (data: {
    attempt_id: string;
    answers: unknown[];
    tab_switch_count: number;
    fullscreen_exits: number;
    time_taken_seconds: number;
  }) =>
    apiRequest<unknown>('/api/assessments/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Record telemetry
   */
  recordTelemetry: (attemptId: string, eventType: string, eventData?: unknown) =>
    apiRequest<unknown>('/api/assessments/telemetry', {
      method: 'POST',
      body: JSON.stringify({
        attempt_id: attemptId,
        event_type: eventType,
        event_data: eventData,
      }),
    }),

  /**
   * Generate quiz
   */
  generateQuiz: (data: {
    question_count?: number;
    bloom_levels?: string[];
    difficulty?: number;
    document_text?: string;
  }) =>
    apiRequest<unknown>('/api/assessments/quiz/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Certificate API
// ============================================

export const certificateApi = {
  /**
   * Get user's certificates
   */
  getAll: () => apiRequest<unknown[]>('/api/certificates', { method: 'GET' }),

  /**
   * Get certificate details
   */
  getById: (id: string) => apiRequest<unknown>(`/api/certificates/${id}`, { method: 'GET' }),

  /**
   * Verify certificate
   */
  verify: (code: string) =>
    apiRequest<unknown>(`/api/certificates/verify/${code}`, { method: 'GET' }),
};

// ============================================
// Admin API
// ============================================

export const adminApi = {
  /**
   * Get dashboard overview
   */
  getDashboard: () => 
    apiRequest<{ success: boolean; data: DashboardData }>('/api/admin/dashboard', { method: 'GET' }),

  /**
   * Get review queue
   */
  getReviews: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: Review[], pagination: unknown }>(`/api/admin/reviews${query}`, {
      method: 'GET',
    });
  },

  /**
   * Review an assessment
   */
  reviewAssessment: (
    attemptId: string,
    data: {
      final_verified_score: number;
      review_status: 'approved' | 'rejected' | 'flagged';
      admin_notes?: string;
    }
  ) =>
    apiRequest<{ success: boolean; data: unknown }>(`/api/admin/reviews/${attemptId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Get all users
   */
  getUsers: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: unknown[]; pagination: unknown }>(`/api/admin/users${query}`, {
      method: 'GET',
    });
  },

  /**
   * Update a user
   */
  updateUser: (userId: string, data: Record<string, unknown>) =>
    apiRequest<{ success: boolean; data: unknown }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Get competency heatmap
   */
  getHeatmap: () => apiRequest<unknown>('/api/admin/heatmap', { method: 'GET' }),

  /**
   * Run what-if simulation
   */
  predict: (scenario: string) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        current_average: number; 
        predicted_average: number; 
        improvement: number; 
        scenario_description: string 
      }; 
    }>('/api/admin/predict', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    }),
};

interface DashboardData {
  overview: {
    total_officials: number;
    average_proficiency: number;
    training_effectiveness: number;
    certificates_issued: number;
  };
  pending_reviews: number;
  completed_courses: number;
  department_distribution: { department: string; count: number }[];
  top_skill_gaps: { competency: string; domain: string; average_gap: number }[];
}

interface Review {
  id: string;
  auto_score: number;
  tab_switch_count: number;
  fullscreen_exits: number;
  time_taken_seconds: number;
  status: string;
  created_at: string;
  user: { full_name: string; designation: string; department: string };
  course: { title: string };
}

// ============================================
// AI API
// ============================================

export const aiApi = {
  /**
   * Multilingual chat with AI tutor
   */
  chat: (data: {
    message: string;
    course_id?: string;
    user_id: string;
    language?: string;
    conversation_history?: Array<{ role: string; content: string }>;
  }) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        answer: string;
        language: string;
        sources: Array<{ course_id: string; preview: string }>;
        audio_url?: string;
      }; 
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Generate quiz from document or competencies
   */
  generateQuiz: (data: {
    question_count?: number;
    bloom_levels?: string[];
    difficulty?: number;
    document_text?: string;
  }) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        questions: Array<{
          id: string;
          text: string;
          options: string[];
          correct_answer: number;
          bloom_level: string;
          difficulty: number;
          explanation: string;
        }>;
        metadata: {
          question_count: number;
          bloom_levels: string[];
          difficulty: number;
          source: string;
          generated_at: string;
        };
      }; 
    }>('/api/ai/quiz/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * AI-powered competency assessment
   */
  assess: (data: {
    designation: string;
    department: string;
    years_experience: number;
    education: string;
    current_assignment?: string;
  }) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        competencies: Array<{
          name: string;
          score: number;
          domain: string;
          reasoning: string;
        }>;
        baseline_scores: Array<{ competency: string; score: number }>;
        assessment_summary: string;
      }; 
    }>('/api/ai/assess', {
      method: 'POST',
      body: JSON.stringify({ 
        user_id: '', // Will be filled by backend
        ...data
      }),
    }),

  /**
   * AI-powered course recommendations
   */
  recommend: (data: {
    skill_gaps: Array<{
      competency_name: string;
      gap_score: number;
    }>;
  }) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        recommendations: Array<{
          course_id: string;
          course_title: string;
          priority: 'high' | 'medium';
          reason: string;
          matching_gap: string;
        }>;
        priority_reasons: string[];
      }; 
    }>('/api/ai/recommend', {
      method: 'POST',
      body: JSON.stringify({ 
        user_id: '', // Will be filled by backend
        ...data
      }),
    }),
};

// ============================================
// iGOT API
// ============================================

export const igotApi = {
  /**
   * Get iGOT courses with filters
   */
  getCourses: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest<{ data: Course[], pagination: unknown }>(`/api/igot/courses${query}`, {
      method: 'GET',
    });
  },

  /**
   * Get iGOT course details
   */
  getCourseById: (id: string) =>
    apiRequest<{ data: Course }>(`/api/igot/courses/${id}`, {
      method: 'GET',
    }),

  /**
   * Get user's enrolled iGOT courses
   */
  getEnrolledCourses: () =>
    apiRequest<{ data: Array<{ course: Course }> }>(`/api/igot/courses/enrolled`, {
      method: 'GET',
    }),

  /**
   * Get upcoming TPAC calendar
   */
  getTpacCalendar: (limit = 20) =>
    apiRequest<{ data: Course[] }>(`/api/igot/courses/tpac/calendar?limit=${limit}`, {
      method: 'GET',
    }),

  /**
   * Enroll in an iGOT course
   */
  enrollInCourse: (courseId: string) =>
    apiRequest<{ 
      success: boolean; 
      data: { 
        enrollment: { 
          course_id: string;
          user_id: string;
          status: string;
          created_at: string;
        };
        message: string;
      }; 
    }>(`/api/igot/enroll/${courseId}`, {
      method: 'POST',
    }),
};

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
  target_competencies: string[];
}

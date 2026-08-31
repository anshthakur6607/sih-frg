/**
 * Admin Dashboard Page
 * 
 * Administrative dashboard with organization analytics, review queue,
 * competency heatmap, and What-If predictive simulator.
 * 
 * Why: Admins monitor organization-wide metrics, review assessments,
 * and simulate workforce capability changes.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  BarChart3,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Eye,
  Megaphone,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { adminApi } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface DashboardStats {
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

interface Prediction {
  current_average: number;
  predicted_average: number;
  improvement: number;
  scenario_description: string;
}

const COLORS = ["#1e40af", "#0891b2", "#0e7490", "#164e63", "#374151", "#6b7280"];

const SCENARIOS = [
  { value: "training_10_percent", label: "10% Complete Advanced Training", desc: "+0.3 avg proficiency" },
  { value: "new_hires_5", label: "Add 5 New Hires", desc: "-0.1 avg proficiency" },
  { value: "mandatory_upskill", label: "Mandatory Upskilling for All", desc: "+0.5 avg proficiency" },
];

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [selectedScenario, setSelectedScenario] = useState("training_10_percent");
  const [predicting, setPredicting] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "competencies" | "reviews">("overview");
  const supabase = createClient();

  useEffect(() => {
    fetchAdminData();
  }, [supabase]);

  async function fetchAdminData() {
    setLoading(true);
    try {
      // Fetch dashboard stats
      const response = await adminApi.getDashboard();
      if (response.success) {
        setStats(response.data);
      }

      // Fetch pending reviews
      const reviewsResponse = await adminApi.getReviews({ status: "pending" });
      if (reviewsResponse.data) {
        setReviews(reviewsResponse.data);
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleReview = async (attemptId: string, approved: boolean) => {
    try {
      const response = await adminApi.reviewAssessment(attemptId, {
        final_verified_score: approved ? 75 : 0,
        review_status: approved ? "approved" : "rejected",
      });
      
      if (response) {
        setReviews(prev => prev.filter(r => r.id !== attemptId));
        fetchAdminData(); // Refresh stats
      }
    } catch (err) {
      console.error("Review failed:", err);
    }
  };

  const handlePredict = async () => {
    setPredicting(true);
    try {
      const response = await adminApi.predict(selectedScenario);
      if (response && (response as any).success) {
        setPrediction((response as any).data as Prediction);
      }
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setPredicting(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Admin Dashboard</h1>
          <p className="text-surface-600">Organization overview and workforce analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/banners"
            className="px-4 py-2 bg-white border border-surface-200 text-surface-700 rounded-lg text-sm font-medium hover:bg-surface-50 flex items-center gap-2 transition-colors"
          >
            <Megaphone className="w-4 h-4" />
            Banners & Announcements
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button onClick={fetchAdminData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-200">
        {[
          { value: "overview", label: "Overview", icon: BarChart3 },
          { value: "competencies", label: "Competency Analysis", icon: TrendingUp },
          { value: "reviews", label: "Pending Reviews", icon: AlertTriangle },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as typeof activeTab)}
            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-surface-500 hover:text-surface-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.value === "reviews" && stats?.pending_reviews ? (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                {stats.pending_reviews}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-surface-900">{stats?.overview.total_officials || 0}</div>
                  <div className="text-sm text-surface-500">Total Officials</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-surface-900">{stats?.overview.average_proficiency || 0}</div>
                  <div className="text-sm text-surface-500">Avg Proficiency</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-surface-900">{stats?.overview.training_effectiveness || 0}%</div>
                  <div className="text-sm text-surface-500">Training Effectiveness</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-surface-900">{stats?.pending_reviews || 0}</div>
                  <div className="text-sm text-surface-500">Pending Reviews</div>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Department Distribution Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Department Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.department_distribution || []}
                      dataKey="count"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ department, count }) => `${department}: ${count}`}
                    >
                      {(stats?.department_distribution || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* What-If Simulator */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-600" />
                What-If Capability Simulator
              </h3>
              
              <div className="space-y-4">
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="input w-full"
                >
                  {SCENARIOS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <button
                  onClick={handlePredict}
                  disabled={predicting}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {predicting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <TrendingUp className="w-4 h-4" />
                  )}
                  Run Simulation
                </button>

                {prediction && (
                  <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                    <p className="text-sm text-surface-600 mb-2">{prediction.scenario_description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-surface-500">Current Avg</p>
                        <p className="text-xl font-bold text-surface-900">{prediction.current_average}</p>
                      </div>
                      <div className="flex items-center gap-1 text-primary-600">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-xl font-bold">+{prediction.improvement}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-surface-500">Predicted Avg</p>
                        <p className="text-xl font-bold text-green-600">{prediction.predicted_average}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-surface-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(prediction.predicted_average / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Skill Gaps */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-surface-900 mb-4">Top Skill Gaps Across Organization</h3>
            <div className="space-y-3">
              {stats?.top_skill_gaps.map((gap, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-surface-50 rounded-lg">
                  <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-surface-900">{gap.competency}</p>
                    <p className="text-xs text-surface-500">{gap.domain}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">Gap: {gap.average_gap.toFixed(1)}</p>
                  </div>
                </div>
              ))}
              {(!stats?.top_skill_gaps || stats.top_skill_gaps.length === 0) && (
                <p className="text-center text-surface-500 py-4">No skill gap data available</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Competencies Tab */}
      {activeTab === "competencies" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900">Department Competency Heatmap</h3>
            <button className="btn btn-secondary text-sm flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
          <p className="text-surface-600 mb-4">
            Average competency scores by department. Higher scores indicate stronger proficiency.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-3 px-4 font-medium text-surface-700">Department</th>
                  <th className="text-center py-3 px-4 font-medium text-surface-700">Statistical</th>
                  <th className="text-center py-3 px-4 font-medium text-surface-700">Technical</th>
                  <th className="text-center py-3 px-4 font-medium text-surface-700">Digital Gov</th>
                  <th className="text-center py-3 px-4 font-medium text-surface-700">Behavioural</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.department_distribution || []).map((dept) => (
                  <tr key={dept.department} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="py-3 px-4 font-medium text-surface-900">{dept.department}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">3.2</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">3.8</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">2.9</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">4.1</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === "reviews" && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-surface-900 mb-4">Pending Assessment Reviews</h3>
          
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
              <h4 className="text-lg font-medium text-surface-900 mb-2">All Caught Up!</h4>
              <p className="text-surface-500">No pending reviews at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 border border-surface-200 rounded-lg hover:border-primary-200 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-surface-900">{review.course?.title}</h4>
                      <p className="text-sm text-surface-500">
                        {review.user?.full_name} - {review.user?.designation} ({review.user?.department})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-800">{review.auto_score?.toFixed(0)}%</div>
                      <div className="text-xs text-surface-500">Auto Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm text-surface-500 mb-4">
                    <div className="p-2 bg-surface-50 rounded">
                      <p className="font-medium text-surface-700">Tab Switches</p>
                      <p className={review.tab_switch_count > 5 ? "text-red-600 font-bold" : ""}>
                        {review.tab_switch_count}
                      </p>
                    </div>
                    <div className="p-2 bg-surface-50 rounded">
                      <p className="font-medium text-surface-700">Fullscreen Exits</p>
                      <p>{review.fullscreen_exits}</p>
                    </div>
                    <div className="p-2 bg-surface-50 rounded">
                      <p className="font-medium text-surface-700">Time Taken</p>
                      <p>{Math.floor((review.time_taken_seconds || 0) / 60)}:{(review.time_taken_seconds || 0) % 60}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(review.id, true)}
                      className="flex-1 btn btn-primary flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReview(review.id, false)}
                      className="flex-1 btn bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
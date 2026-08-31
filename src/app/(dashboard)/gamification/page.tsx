/**
 * Gamification Page
 * 
 * Progress badges, competency milestones, points, and leaderboard.
 * Gamification tied to career progression, not just points.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Award, 
  Trophy, 
  Star, 
  Flame, 
  TrendingUp,
  ChevronRight,
  Target,
  Zap,
  Crown
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  points: number;
  earned_at?: string;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  full_name: string;
  department: string;
  total_points: number;
  current_streak_days: number;
}

interface UserStats {
  total_points: number;
  current_streak_days: number;
  longest_streak_days: number;
  courses_completed: number;
  certificates: number;
  perfect_quizzes: number;
  rank?: number;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  bronze: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", icon: "bg-amber-400" },
  silver: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700", icon: "bg-slate-400" },
  gold: { bg: "bg-yellow-50", border: "border-yellow-400", text: "text-yellow-700", icon: "bg-yellow-400" },
  platinum: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", icon: "bg-purple-400" },
};

const MILESTONES = [
  { points: 100, label: "First Course", icon: "📚" },
  { points: 250, label: "Week Streak", icon: "🔥" },
  { points: 500, label: "5 Courses", icon: "⭐" },
  { points: 1000, label: "Quiz Master", icon: "🏆" },
  { points: 2500, label: "Domain Expert", icon: "🎯" },
  { points: 5000, label: "Career Catalyst", icon: "🚀" },
  { points: 10000, label: "Legend", icon: "👑" },
];

export default function GamificationPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Fetch all data in parallel
      const [badgesRes, leaderboardRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gamification/badges`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/gamification/leaderboard`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ]);

      const badgesData = await badgesRes.json();
      const leaderboardData = await leaderboardRes.json();

      if (badgesData.success) setBadges(badgesData.data || []);
      if (leaderboardData.success) setLeaderboard(leaderboardData.data || []);

      if (statsRes.data) {
        const { count: enrollments } = await supabase
          .from('course_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'completed') as any;

        const { count: certs } = await supabase
          .from('certificates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id) as any;

        const { count: quizzes } = await supabase
          .from('assessment_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('auto_score', 100) as any;

        const userRank = (leaderboardData.data || []).findIndex((e: any) => e.id === user.id) + 1;

        setStats({
          total_points: statsRes.data.total_points || 0,
          current_streak_days: statsRes.data.current_streak_days || 0,
          longest_streak_days: statsRes.data.longest_streak_days || 0,
          courses_completed: (enrollments as any) || 0,
          certificates: (certs as any) || 0,
          perfect_quizzes: (quizzes as any) || 0,
          rank: userRank,
        });
      }
    } catch (err) {
      console.error("Gamification load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const earnedBadges = badges.filter(b => b.earned_at);
  const unearnedBadges = badges.filter(b => !b.earned_at);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-primary-600" />
          Gamification Hub
        </h1>
        <p className="text-surface-600">
          Earn badges, climb the leaderboard, and track your learning milestones
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-5 text-white">
            <Trophy className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.total_points}</div>
            <div className="text-sm text-primary-100">Total Points</div>
            {stats.rank && <div className="text-xs text-primary-200 mt-1">Rank #{stats.rank}</div>}
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl p-5 text-white">
            <Flame className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.current_streak_days}</div>
            <div className="text-sm text-orange-100">Day Streak</div>
            {stats.longest_streak_days > stats.current_streak_days && (
              <div className="text-xs text-orange-200 mt-1">Best: {stats.longest_streak_days}</div>
            )}
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl p-5 text-white">
            <Star className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{stats.courses_completed}</div>
            <div className="text-sm text-green-100">Courses</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-5 text-white">
            <Award className="w-6 h-6 mb-2 opacity-80" />
            <div className="text-3xl font-bold">{earnedBadges.length}</div>
            <div className="text-sm text-purple-100">Badges Earned</div>
          </div>
        </div>
      )}

      {/* Progress Milestones */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Learning Milestones
        </h2>
        <div className="space-y-3">
          {MILESTONES.map((milestone) => {
            const progress = stats ? Math.min(100, (stats.total_points / milestone.points) * 100) : 0;
            const achieved = progress >= 100;
            return (
              <div key={milestone.points} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  achieved ? "bg-primary-100" : "bg-surface-100"
                }`}>
                  {milestone.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${achieved ? "text-surface-900" : "text-surface-600"}`}>
                      {milestone.label}
                    </span>
                    <span className="text-xs text-surface-500">{milestone.points} pts</span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${achieved ? "bg-primary-500" : "bg-surface-300"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges */}
      <div>
        <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-primary-600" />
          Badge Collection
        </h2>

        {earnedBadges.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-surface-600 mb-3">Earned ({earnedBadges.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {earnedBadges.map((badge) => {
                const colors = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
                return (
                  <div 
                    key={badge.id}
                    className={`${colors.bg} border ${colors.border} rounded-xl p-4 text-center relative`}
                  >
                    <div className={`text-4xl mb-2`}>{badge.icon}</div>
                    <p className={`font-semibold text-sm ${colors.text}`}>{badge.name}</p>
                    <p className="text-xs text-surface-500 mt-1">{badge.description}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs font-medium text-yellow-600">{badge.points}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {unearnedBadges.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-surface-600 mb-3">Locked ({unearnedBadges.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {unearnedBadges.map((badge) => {
                const colors = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
                return (
                  <div 
                    key={badge.id}
                    className={`bg-surface-50 border border-surface-200 rounded-xl p-4 text-center opacity-50`}
                  >
                    <div className="text-4xl mb-2 grayscale">🔒</div>
                    <p className="font-semibold text-sm text-surface-700">{badge.name}</p>
                    <p className="text-xs text-surface-400 mt-1">{badge.description}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Zap className="w-3 h-3 text-surface-400" />
                      <span className="text-xs font-medium text-surface-500">{badge.points} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Leaderboard
          </h2>
          <span className="text-sm text-surface-500">Top 10 in MoSPI</span>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-center text-surface-500 py-8">Leaderboard will appear as more officials join</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  entry.rank === 1 ? "bg-yellow-50 border border-yellow-200" :
                  entry.rank === 2 ? "bg-slate-50 border border-slate-200" :
                  entry.rank === 3 ? "bg-orange-50 border border-orange-200" :
                  "bg-surface-50"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.rank === 1 ? "bg-yellow-400 text-white" :
                  entry.rank === 2 ? "bg-slate-400 text-white" :
                  entry.rank === 3 ? "bg-orange-400 text-white" :
                  "bg-surface-200 text-surface-600"
                }`}>
                  {entry.rank === 1 ? <Crown className="w-4 h-4" /> : entry.rank}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-surface-900">{entry.full_name}</p>
                  <p className="text-xs text-surface-500">{entry.department}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-700">{entry.total_points}</p>
                  <p className="text-xs text-surface-500">{entry.current_streak_days}🔥</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
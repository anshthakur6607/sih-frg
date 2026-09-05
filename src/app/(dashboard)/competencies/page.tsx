"use client";

import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  BarChart3,
  Award,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import CompetencyRadarChart from "@/components/CompetencyRadarChart";

interface CompetencyScore {
  competency_id: string;
  competency: { 
    id: string; 
    name: string; 
    domain_id: string;
    domain?: {
      id: string;
      name: string;
    };
  };
  competency_domain?: { 
    id: string; 
    name: string 
  };
  current_score: number;
  required_score: number;
  gap_score?: number;
}

interface GroupedCompetency {
  competency_id: string;
  name: string;
  current_score: number;
  required_score: number;
  gap_score: number;
}

interface DomainGroup {
  domain: string;
  competencies: GroupedCompetency[];
  average_score: number;
  required_average: number;
}

interface RadarDataPoint {
  domain: string;
  current: number;
  required: number;
  percentage: number;
}

export default function CompetenciesPage() {
  const { t } = useLanguage();
  const [competencies, setCompetencies] = useState<CompetencyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchCompetencies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/competencies`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch competencies: ${response.status}`);
      }

      const data = await response.json();
      setCompetencies(data.competencies || data || []);
    } catch (err) {
      console.error("Error fetching competencies:", err);
      setError(err instanceof Error ? err.message : "Failed to load competencies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetencies();
  }, []);

  const getGapSeverity = (gap: number) => {
    if (gap >= 2) return 'high';
    if (gap >= 1) return 'medium';
    return 'low';
  };

  const getGapColor = (gap: number) => {
    if (gap >= 2) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
    if (gap >= 1) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' };
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
  };

  const groupedByDomain: Record<string, DomainGroup> = (competencies as CompetencyScore[]).reduce((acc, item) => {
    const domain = item.competency_domain?.name || "Unknown";
    const gap = item.required_score - item.current_score;

    if (!acc[domain]) {
      acc[domain] = {
        domain,
        competencies: [],
        average_score: 0,
        required_average: 0,
      };
    }

    acc[domain].competencies.push({
      competency_id: item.competency_id,
      name: item.competency?.name || "Unknown",
      current_score: item.current_score,
      required_score: item.required_score,
      gap_score: gap,
    });

    return acc;
  }, {} as Record<string, DomainGroup>);

  Object.keys(groupedByDomain).forEach((domain: string) => {
    const group = groupedByDomain[domain];
    const count = group.competencies.length;
    group.average_score = group.competencies.reduce((sum: number, c: { current_score: number }) => sum + c.current_score, 0) / count;
    group.required_average = group.competencies.reduce((sum: number, c: { required_score: number }) => sum + c.required_score, 0) / count;
  });

  const radarData: RadarDataPoint[] = Object.values(groupedByDomain).map(group => ({
    domain: group.domain,
    current: Math.round(group.average_score * 10) / 10,
    required: Math.round(group.required_average * 10) / 10,
    percentage: group.required_average > 0 
      ? Math.round((group.average_score / group.required_average) * 100) 
      : 0,
  }));

  const allCompetencies = Object.values(groupedByDomain).flatMap(g => g.competencies);
  const highGaps = allCompetencies.filter(c => c.gap_score >= 2).length;
  const mediumGaps = allCompetencies.filter(c => c.gap_score >= 1 && c.gap_score < 2).length;
  const lowGaps = allCompetencies.filter(c => c.gap_score < 1).length;
  const totalAssessed = allCompetencies.length;
  const overallProgress = totalAssessed > 0 
    ? Math.round((lowGaps / totalAssessed) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-surface-600">{t("common.loading") || "Loading competencies..."}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-surface-600 hover:text-primary-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Competencies</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchCompetencies}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (allCompetencies.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-surface-600 hover:text-primary-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="bg-surface-50 border border-surface-200 rounded-lg p-8 text-center">
          <BarChart3 className="w-16 h-16 text-surface-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-surface-800 mb-2">No Competencies Assessed Yet</h3>
          <p className="text-surface-600 mb-6">Complete your skill survey to get your competency assessment.</p>
          <Link
            href="/survey"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Take Skill Survey
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-surface-600 hover:text-primary-600 transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">My Competencies</h1>
          <p className="text-surface-600">View your competency assessment results by domain</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCompetencies}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Overall Progress</h2>
            <p className="text-sm text-surface-500">Competency gap closure rate</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-800">{overallProgress}%</div>
            <p className="text-sm text-surface-500">Gap Closed</p>
          </div>
        </div>
        
        <div className="h-3 bg-surface-200 rounded-full overflow-hidden mb-6">
          <div 
            className="h-full bg-gradient-to-r from-primary-600 to-accent-500 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <h3 className="text-sm font-medium text-surface-700 mb-3">Competency Radar by Domain</h3>
        <CompetencyRadarChart data={radarData} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-surface-900">{totalAssessed}</div>
              <div className="text-sm text-surface-500">Total Assessed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700">{highGaps}</div>
              <div className="text-sm text-surface-500">High Gaps (≥2)</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-700">{mediumGaps}</div>
              <div className="text-sm text-surface-500">Medium Gaps (≥1)</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{lowGaps}</div>
              <div className="text-sm text-surface-500">Achieved (&lt;1)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {Object.values(groupedByDomain).map((domainGroup) => (
          <div key={domainGroup.domain} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900">{domainGroup.domain}</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                domainGroup.average_score >= domainGroup.required_average 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                Avg: {domainGroup.average_score.toFixed(1)} / {domainGroup.required_average.toFixed(1)}
              </div>
            </div>

            <div className="space-y-3">
              {domainGroup.competencies.map((comp) => {
                const colors = getGapColor(comp.gap_score);
                const progress = (comp.current_score / comp.required_score) * 100;
                
                return (
                  <div 
                    key={comp.competency_id}
                    className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-surface-900">{comp.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.badge}`}>
                        Gap: {comp.gap_score.toFixed(1)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              comp.gap_score >= 2 ? 'bg-red-500' : 
                              comp.gap_score >= 1 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-surface-600 whitespace-nowrap">
                        {comp.current_score.toFixed(1)} / {comp.required_score.toFixed(1)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-50 rounded-lg p-4 border border-surface-200">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-surface-600" />
          <h4 className="font-medium text-surface-800">Understanding Your Results</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-surface-700">High Gap (≥2.0)</p>
              <p className="text-surface-500">Requires significant learning effort</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-surface-700">Medium Gap (1.0-1.9)</p>
              <p className="text-surface-500">Moderate improvement needed</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-medium text-surface-700">Achieved (&lt;1.0)</p>
              <p className="text-surface-500">Meets or exceeds requirement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

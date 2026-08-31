/**
 * NSSTA TPAC Calendar Page
 * 
 * Shows upcoming NSSTA TPAC (Training Programme Administration Cell) 
 * classroom sessions across India. Users can browse, filter, and
 * cross-reference with iGOT online courses for blended learning.
 * 
 * Why: TPAC classroom programs are critical for hands-on statistical
 * training. surfacing them alongside iGOT creates a unified learning view.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  GraduationCap,
  Filter,
  Search,
  ExternalLink,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Building,
  Loader2,
} from "lucide-react";

interface TPACEvent {
  id: string;
  topic: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  level: string;
  seats: number;
  seats_available: number;
  source: string;
  competencies: string[];
}

export default function TPACCalendarPage() {
  const { t } = useLanguage();
  const [events, setEvents] = useState<TPACEvent[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all");
  const [recommending, setRecommending] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/integrations/nssta/tpac/calendar", {
        headers: {
          Authorization: `Bearer ${(await (await import("@/lib/supabase")).createClient().auth.getSession()).data.session?.access_token || ""}`,
        },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setEvents(data.data);
        setMeta(data.meta || null);
        setSource(data.source || data.meta?.source || "");
      }
    } catch (err) {
      console.error("Failed to fetch TPAC calendar:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecommend(competencyGap: string) {
    setRecommending(competencyGap);
    try {
      const res = await fetch(
        `http://localhost:3001/api/integrations/recommend-from-calendar?competency_gap=${encodeURIComponent(competencyGap)}&urgency=high`,
        {
          headers: {
            Authorization: `Bearer ${(await (await import("@/lib/supabase")).createClient().auth.getSession()).data.session?.access_token || ""}`,
          },
        }
      );
      const data = await res.json();
      if (data.success && data.data?.length) {
        const rec = data.data[0];
        alert(
          `Recommended for "${competencyGap}":\n\n${rec.topic || rec.name}\nType: ${rec.type === "tpac_classroom" ? "TPAC Classroom" : "iGOT Online"}\nPriority: ${rec.priority}`
        );
      }
    } catch (err) {
      console.error("Recommendation failed:", err);
    } finally {
      setRecommending(null);
    }
  }

  const filtered = events.filter((e) => {
    const matchSearch =
      e.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLevel = levelFilter === "all" || e.level === levelFilter;
    return matchSearch && matchLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-100 text-green-700";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-700";
      case "Advanced":
        return "bg-red-100 text-red-700";
      default:
        return "bg-surface-100 text-surface-600";
    }
  };

  const getAvailabilityColor = (available: number, total: number) => {
    const pct = (available / total) * 100;
    if (pct > 50) return "text-green-600";
    if (pct > 20) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Building className="w-6 h-6 text-primary-600" />
            {t("tpac.title")}
          </h1>
          <p className="text-surface-600 mt-1">
            {t("tpac.subtitle")}
          </p>
          {source && (
            <p className="text-xs mt-1 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${source==='courses_db' ? 'bg-green-100 text-green-700' : source==='nssta.gov.in' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>Source: {source}</span>
              {meta?.note && <span className="text-surface-500">{meta.note}</span>}
            </p>
          )}
        </div>
        <button onClick={fetchEvents} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      {source==='mock' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Showing demo mock data because DB has no TPAC courses. Run <code>seed_courses.sql</code> + <code>seed_igot_portal.sql</code>. NSSTA public site has <b>no API key</b> — it is scraped; if you have a TPAC JSON endpoint, set <code>NSSTA_API_URL</code> in <code>backend/.env</code>.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-primary-800">{events.length}</div>
          <div className="text-sm text-surface-500">Total Programs</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-800">
            {events.filter((e) => e.seats_available > 5).length}
          </div>
          <div className="text-sm text-surface-500">Seats Available</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-800">
            {events.filter((e) => e.level === "Advanced").length}
          </div>
          <div className="text-sm text-surface-500">Advanced Level</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-accent-800">
            {new Set(events.map((e) => e.location)).size}
          </div>
          <div className="text-sm text-surface-500">Locations</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {(["all", "Beginner", "Intermediate", "Advanced"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                levelFilter === level
                  ? "bg-primary-800 text-white"
                  : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-50"
              }`}
            >
              {level === "all" ? "All Levels" : level}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by topic, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10 w-64"
          />
        </div>
      </div>

      {/* Events Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto text-surface-300 mb-4" />
          <h3 className="text-lg font-medium text-surface-900 mb-2">No TPAC Programs Found</h3>
          <p className="text-surface-600 mb-4">
            {events.length === 0
              ? "No upcoming NSSTA TPAC programs available. Check back later."
              : "Try adjusting your filters to see more results."}
          </p>
          <Link href="/courses" className="btn btn-primary">
            Browse iGOT Courses Instead
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filtered.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-md border border-surface-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(event.level)}`}>
                    {event.level}
                  </span>
                  <span className="text-xs text-surface-500 bg-surface-50 px-2 py-1 rounded">
                    {event.duration_days} day{event.duration_days > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-semibold text-surface-900 mb-2">{event.topic}</h3>
                <p className="text-sm text-surface-600 mb-4 line-clamp-2">
                  {event.description || "No description available"}
                </p>

                {/* Details */}
                <div className="space-y-2 text-sm text-surface-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-500" />
                    <span>
                      {new Date(event.start_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {event.end_date &&
                        ` — ${new Date(event.end_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent-500" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className={getAvailabilityColor(event.seats_available, event.seats)}>
                      {event.seats_available} / {event.seats} seats available
                    </span>
                  </div>
                </div>

                {/* Competencies */}
                {event.competencies && event.competencies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {event.competencies.map((comp, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs cursor-pointer hover:bg-primary-100"
                        onClick={() => handleRecommend(comp)}
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href="/courses"
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                  >
                    <BookOpen className="w-4 h-4" />
                    Find Online Course
                  </Link>
                  <button
                    onClick={() => handleRecommend(event.competencies?.[0] || event.topic)}
                    disabled={recommending === event.competencies?.[0]}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                  >
                    {recommending === event.competencies?.[0] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Get Recommendation
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-accent-50 rounded-lg border border-accent-200 p-4">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-accent-600 mt-0.5" />
          <div>
            <p className="font-medium text-accent-900">About NSSTA TPAC Programs</p>
            <ul className="text-sm text-accent-700 mt-1 space-y-1">
              <li>• TPAC (Training Programme Administration Cell) conducts classroom training for government officials</li>
              <li>• Programs are held at NSSTA facilities across India (New Delhi, Hyderabad, etc.)</li>
              <li>• Combine TPAC classroom with iGOT online courses for blended learning</li>
              <li>• Contact your training coordinator to enroll in TPAC programs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

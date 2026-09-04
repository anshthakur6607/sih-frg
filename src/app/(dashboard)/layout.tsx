/**
 * Dashboard Layout
 * 
 * Layout wrapper for all authenticated dashboard pages.
 * Provides the sidebar navigation and header with user info.
 * 
 * Why: Consistent layout for all protected routes after login.
 * Includes authentication check and user menu.
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  GraduationCap, 
  LayoutDashboard, 
  BookOpen, 
  Award, 
  Settings, 
  LogOut,
  Menu,
  X,
  User,
  Bell,
  ChevronDown,
  Brain,
  FileText,
  MessageSquare,
  Target,
  TrendingUp,
  Sparkles,
  Trophy,
  Map,
  Globe,
  Check,
  Building,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_NAMES } from "@/lib/i18n/translations";
import AdminBannerPopup from "@/components/AdminBannerPopup";
import CourseReminderPopup from "@/components/CourseReminderPopup";

const SITE_LANGUAGES_LIST = Object.entries(LANGUAGE_NAMES).map(([code, v]) => ({ code, ...v }));

const NAV_CONFIG: Array<{ href: string; key: string; icon: any }> = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/assessment", key: "nav.skillAssessment", icon: Brain },
  { href: "/recommendations", key: "nav.recommended", icon: Sparkles },
  { href: "/courses", key: "nav.courseCatalog", icon: BookOpen },
  { href: "/my-courses", key: "nav.myCourses", icon: BookOpen },
  { href: "/learning-path", key: "nav.learningPath", icon: Target },
  { href: "/competencies", key: "nav.competencies", icon: TrendingUp },
  { href: "/quiz-generator", key: "nav.quizGenerator", icon: FileText },
  { href: "/ai-tutor", key: "nav.aiTutor", icon: MessageSquare },
  { href: "/passes", key: "nav.passes", icon: Award },
  { href: "/gamification", key: "nav.progress", icon: Trophy },
  { href: "/roadmap", key: "nav.roadmap", icon: Map },
  { href: "/tpac-calendar", key: "nav.tpacCalendar", icon: Building },
  { href: "/assessments", key: "nav.assessmentHistory", icon: Award },
  { href: "/certificates", key: "nav.certificates", icon: Award },
];

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <DashboardShell>{children}</DashboardShell>
    </LanguageProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { language: siteLang, setLanguage: setSiteLang, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const v = localStorage.getItem("skillup_sidebar_collapsed");
    if (v === "1") setCollapsed(true);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed(c => {
      const n = !c;
      localStorage.setItem("skillup_sidebar_collapsed", n ? "1" : "0");
      return n;
    });
  };

  useEffect(() => {
    // Register service worker for PWA
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => 
        console.warn("SW registration failed:", err)
      );
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSiteLangChange = (code: string) => {
    setSiteLang(code);
    setLangMenuOpen(false);
  };

  /**
   * Fetch user profile on mount
   */
  useEffect(() => {
    async function fetchProfile() {
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
        setProfile(profile);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [router, supabase]);

  /**
   * Handle logout
   */
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-surface-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-surface-200 transform transition-transform duration-200 lg:translate-x-0 ${collapsed ? "w-20" : "w-64"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-surface-200 gap-1">
            <Link href="/dashboard" className={`flex items-center gap-2 overflow-hidden ${collapsed ? "justify-center" : ""}`}>
              <div className="w-10 h-10 bg-primary-800 rounded-lg flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              {!collapsed && <span className="text-xl font-bold text-primary-800 truncate">{t("nav.skillup")}</span>}
            </Link>
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md hover:bg-surface-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`p-2 space-y-1 overflow-y-auto h-[calc(100vh-8rem)] ${collapsed ? "px-2" : "p-4"}`}>
          {NAV_CONFIG.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const label = t(item.key, item.key);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-2 py-3" : "px-4 py-3"} ${
                  isActive 
                    ? "bg-primary-50 text-primary-800" 
                    : "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}

        </nav>

        {/* User Info at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary-800" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">
                {profile?.full_name || "User"}
              </p>
              <p className="text-xs text-surface-500 truncate">
                {profile?.designation || ""}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={collapsed ? "lg:pl-20" : "lg:pl-64"}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-surface-200 sticky top-0 z-30">
          <div className="h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={toggleCollapsed} className="hidden lg:flex p-2 rounded-md hover:bg-surface-100" title={collapsed ? "Expand" : "Collapse"}>{collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}</button>
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-surface-100"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Page Title (shown on mobile) */}
            <div className="lg:hidden">
              <span className="font-medium text-surface-900">{t("nav.dashboard")}</span>
            </div>

            {/* Right Side - User Menu */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="p-2 rounded-md hover:bg-surface-100 relative">
                <Bell className="w-5 h-5 text-surface-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-surface-100"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-800" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-surface-700">
                    {profile?.full_name?.split(" ")[0] || "User"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-surface-400" />
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-surface-200 py-1 z-20">
                      <div className="px-4 py-2 border-b border-surface-100">
                        <p className="text-sm font-medium text-surface-900">{profile?.full_name}</p>
                        <p className="text-xs text-surface-500">{profile?.email}</p>
                      </div>
                      <Link
                        href="/dashboard/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4" />
                        {t("nav.settings")}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50 w-full"
                      >
                        <LogOut className="w-4 h-4" />
                        {t("nav.signOut")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
        <AdminBannerPopup />
        <CourseReminderPopup />
      </div>

      {/* Site-wide Language Selector - Floating Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50" ref={langMenuRef}>
        {langMenuOpen && (
          <div className="absolute bottom-14 right-0 bg-white rounded-xl shadow-2xl border border-surface-200 py-2 w-52 mb-2 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-surface-100">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{t("common.selectLanguage")}</p>
            </div>
            {SITE_LANGUAGES_LIST.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSiteLangChange(lang.code)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-surface-50 transition-colors ${
                  siteLang === lang.code ? "bg-primary-50 text-primary-700" : "text-surface-700"
                }`}
              >
                <span>{lang.native} <span className="text-surface-400 text-xs">({lang.name})</span></span>
                {siteLang === lang.code && <Check className="w-4 h-4 text-primary-600" />}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setLangMenuOpen(!langMenuOpen)}
          className="w-12 h-12 rounded-full bg-primary-800 text-white shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center hover:scale-110"
          title={t("common.changeLanguage")}
        >
          <Globe className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
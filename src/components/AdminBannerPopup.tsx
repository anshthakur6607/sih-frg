"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { X, ExternalLink, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  cta_label?: string;
  cta_url?: string;
  related_course_id?: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
}

const SEVERITY_CONFIG = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Info,
    iconColor: "text-blue-600",
    headerBg: "bg-blue-600",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    headerBg: "bg-amber-600",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertCircle,
    iconColor: "text-red-600",
    headerBg: "bg-red-600",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-600",
    headerBg: "bg-green-600",
  },
};

const STORAGE_KEY = "skillup_dismissed_banners";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function AdminBannerPopup() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const supabase = createClient();

  const getDismissedIds = (): string[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const dismissBanner = (bannerId: string) => {
    const dismissed = getDismissedIds();
    if (!dismissed.includes(bannerId)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed, bannerId]));
    }
  };

  useEffect(() => {
    async function fetchBanners() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`${API_URL}/api/banners`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        const activeBanners: Banner[] = data.data || data || [];
        const dismissedIds = getDismissedIds();
        const filtered = activeBanners.filter(
          (b) => !dismissedIds.includes(b.id) && b.is_active
        );
        setBanners(filtered);
      } catch (err) {
        console.error("Failed to fetch banners:", err);
      }
    }

    fetchBanners();

    const interval = setInterval(fetchBanners, 60000);
    return () => clearInterval(interval);
  }, [supabase]);

  const handleDismiss = async (banner: Banner) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_URL}/api/banners/${banner.id}/dismiss`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } catch (err) {
      console.error("Failed to dismiss banner on server:", err);
    }

    dismissBanner(banner.id);

    if (currentIndex >= banners.length - 1) {
      setBanners([]);
      setCurrentIndex(0);
    } else {
      setCurrentIndex((prev) => prev);
    }
  };

  const goToNext = () => {
    if (currentIndex < banners.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (banners.length === 0) return null;

  const banner = banners[currentIndex];
  if (!banner) return null;

  const config = SEVERITY_CONFIG[banner.severity] || SEVERITY_CONFIG.info;
  const SeverityIcon = config.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => handleDismiss(banner)}
      />

      <div className={`relative w-full max-w-lg ${config.bg} ${config.border} border-2 rounded-xl shadow-2xl overflow-hidden`}>
        <div className={`${config.headerBg} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3 text-white">
            <SeverityIcon className="w-5 h-5" />
            <h3 className="font-semibold text-base">{banner.title}</h3>
          </div>
          <button
            onClick={() => handleDismiss(banner)}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-surface-800 text-sm leading-relaxed mb-4">
            {banner.message}
          </p>

          {(banner.cta_label && (banner.cta_url || banner.related_course_id)) && (
            <a
              href={banner.cta_url || `/courses/${banner.related_course_id}`}
              target={banner.cta_url ? "_blank" : "_self"}
              rel={banner.cta_url ? "noopener noreferrer" : ""}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-colors ${config.headerBg} hover:opacity-90`}
            >
              {banner.cta_label}
              {banner.cta_url && <ExternalLink className="w-4 h-4" />}
            </a>
          )}
        </div>

        {banners.length > 1 && (
          <div className="px-6 pb-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentIndex ? config.iconColor.replace("text-", "bg-") : "bg-surface-300"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {currentIndex > 0 && (
                <button
                  onClick={goToPrev}
                  className="text-xs text-surface-500 hover:text-surface-700 px-2 py-1"
                >
                  Previous
                </button>
              )}
              {currentIndex < banners.length - 1 && (
                <button
                  onClick={goToNext}
                  className={`text-xs font-medium px-2 py-1 rounded ${config.headerBg} text-white`}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

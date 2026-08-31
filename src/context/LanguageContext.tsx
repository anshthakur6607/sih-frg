"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { translations, getTranslation, type LangCode, LANGUAGE_NAMES } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase";

type LanguageContextType = {
  language: LangCode;
  setLanguage: (code: string) => void;
  t: (key: string, fallback?: string) => string;
  languages: typeof LANGUAGE_NAMES;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (k: string) => k,
  languages: LANGUAGE_NAMES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LangCode>("en");
  const [onlineTransCache, setOnlineTransCache] = useState<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());

  // Load saved preference
  useEffect(() => {
    const saved = (localStorage.getItem("skillup_site_lang") as LangCode | null)?.toLowerCase() as LangCode | undefined;
    if (saved && LANGUAGE_NAMES[saved]) {
      setLanguageState(saved);
      document.documentElement.lang = saved;
    } else {
      document.documentElement.lang = "en";
    }
    // Listen for external changes (e.g., old layout wrote same key)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "skillup_site_lang" && e.newValue && LANGUAGE_NAMES[e.newValue as LangCode]) {
        setLanguageState(e.newValue as LangCode);
        document.documentElement.lang = e.newValue;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Clear AI cache when language switches (so hi cached text not shown for bn)
  useEffect(() => {
    setOnlineTransCache({});
    pendingRef.current.clear();
  }, [language]);

  // Broadcast changes so components that still read localStorage directly also update
  const setLanguage = useCallback((code: string) => {
    const lc = code.toLowerCase() as LangCode;
    if (!LANGUAGE_NAMES[lc]) return;
    setLanguageState(lc);
    localStorage.setItem("skillup_site_lang", lc);
    document.documentElement.lang = lc;
    window.dispatchEvent(new Event("skillup:language-changed"));
  }, []);

  // Helper to queue AI translation for missing keys (auto-translate)
  const queueTranslate = useCallback((key: string, englishText: string) => {
    if (language === "en") return;
    if (onlineTransCache[key] || pendingRef.current.has(key)) return;
    // Only auto-translate if we have an English source (dictionary fallback or free-form text)
    if (!englishText || englishText.trim().length < 2) return;
    // Don't translate keys that are code-like
    if (englishText.length < 80 && /^[a-z0-9._-]+$/i.test(englishText) && !englishText.includes(" ")) return;
    pendingRef.current.add(key);
    // defer to avoid setState during render
    setTimeout(async () => {
      try {
        // get auth token if available (supabase session)
        let token = "";
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token || "";
        } catch {}
        if (!token) {
          // fallback: try localStorage sb-* keys
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i) || "";
              if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                const v = localStorage.getItem(k);
                if (v) { try { const j = JSON.parse(v); token = j.access_token || j.accessToken || ""; if (token) break; } catch { token = v; break; } }
              }
            }
          } catch {}
        }
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/ai/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ text: englishText, target_language: language, source_language: "en" }),
        });
        if (res.ok) {
          const j = await res.json();
          const translated = j?.data?.translated_text || j?.translated_text;
          if (translated && translated !== englishText) {
            setOnlineTransCache(prev => ({ ...prev, [key]: translated }));
          } else {
            // mark as done even if same (avoid re-fetch)
            setOnlineTransCache(prev => ({ ...prev, [key]: englishText }));
          }
        }
      } catch {}
      finally { pendingRef.current.delete(key); }
    }, 50);
  }, [language, onlineTransCache]);

  // Dictionary lookup + auto AI fallback for missing keys
  const t = useCallback((key: string, fallback?: string) => {
    const dict = translations[language];
    const en = translations.en[key];
    const val = dict?.[key];
    if (val) return val;
    if (onlineTransCache[key]) return onlineTransCache[key];
    // Determine English source text to translate
    const englishSource = en || fallback || key;
    // Auto-translate if language != en and we have an English source that looks translatable
    if (language !== "en" && englishSource && englishSource !== key) {
      // Only queue if key is a known dictionary key missing translation
      queueTranslate(key, englishSource);
      return englishSource; // show English until AI returns
    }
    if (language !== "en" && !en && fallback) {
      // free-form text passed as fallback (e.g., t(course.title, course.title))
      // treat key as free text to translate
      queueTranslate(key, fallback);
    }
    if (!en && fallback) {
      // free-form: key is actually English text, fallback is same
      if (language !== "en") queueTranslate(fallback, fallback);
      return onlineTransCache[fallback] || fallback;
    }
    if (en) return en;
    return fallback ?? key;
  }, [language, onlineTransCache, queueTranslate]);

  // When language != en, lazily translate any missing keys that the UI actually requests via t()
  // We expose a helper to translate free-form text (course titles, etc.) via Sarvam through backend
  // Consumers can call translateText() if they need runtime translation; here we keep t() synchronous and cached.

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGE_NAMES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Helper: translate arbitrary runtime text via backend / Sarvam when language != en.
export async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || targetLang === "en") return text;
  try {
    let token = "";
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || "";
    } catch {}
    if (!token) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          const v = localStorage.getItem(k);
          if (v) { try { const j = JSON.parse(v); token = j.access_token || j.accessToken || ""; if (token) break; } catch { token = v; break; } }
        }
      }
    }
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/ai/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text, target_language: targetLang, source_language: "en" }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j?.data?.translated_text) return j.data.translated_text;
      if (j?.translated_text) return j.translated_text;
      if (typeof j?.data === "string") return j.data;
    }
  } catch {}
  return text;
}

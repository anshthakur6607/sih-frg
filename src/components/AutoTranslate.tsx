"use client";
import { useEffect, useState } from "react";
import { useLanguage, translateText } from "@/context/LanguageContext";

/**
 * AutoTranslate — wraps any dynamic DB text (course title, description, PDF title)
 * When site language is not English, it lazily AI-translates via backend /api/ai/translate (Sarvam)
 * Shows original while translating, then swaps. Caches per (text, lang).
 */
const cache = new Map<string, string>();

export default function AutoTranslate({ text, as: As = "span", className, fallback }: { text: string; as?: any; className?: string; fallback?: string }) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (!text) { setTranslated(""); return; }
    if (language === "en") { setTranslated(text); return; }
    const key = `${language}:${text}`;
    if (cache.has(key)) { setTranslated(cache.get(key)!); return; }
    let cancelled = false;
    // small debounce for fast language switches
    const t = setTimeout(async () => {
      const res = await translateText(text, language);
      if (!cancelled) {
        cache.set(key, res);
        setTranslated(res);
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [text, language]);

  const Tag = As;
  return <Tag className={className}>{translated || fallback || text}</Tag>;
}

// Hook version for inline use
export function useAutoTranslate(text: string) {
  const { language } = useLanguage();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!text) { setOut(""); return; }
    if (language === "en") { setOut(text); return; }
    const key = `${language}:${text}`;
    if (cache.has(key)) { setOut(cache.get(key)!); return; }
    let cancelled = false;
    translateText(text, language).then(r => {
      if (!cancelled) { cache.set(key, r); setOut(r); }
    });
    return () => { cancelled = true; };
  }, [text, language]);
  return out;
}

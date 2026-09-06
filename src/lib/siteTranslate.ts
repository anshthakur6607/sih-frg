/**
 * Site-wide DOM auto-translator.
 *
 * Why this exists: only ~30 strings in the app go through t(). Everything
 * else (page titles, buttons, chart labels, course content, empty states…)
 * is hardcoded English, so the language switcher visibly changed almost
 * nothing. Rewriting 40+ pages to wrap every literal in t() is not feasible;
 * instead, when language != en we translate rendered text nodes in place via
 * the backend /api/ai/translate proxy (Sarvam), with a localStorage cache so
 * repeat visits are instant and free.
 *
 * Safety rules:
 * - code/pre/script/style/noscript and [data-notranslate] subtrees are skipped
 * - verification codes, URLs, numbers, code-like tokens are skipped
 * - strings already matching the target-language dictionary are skipped
 *   (avoids double-translating t() output)
 * - originals are kept in memory; switching back to English restores them
 * - a MutationObserver picks up route changes + dynamic content (30s dashboard
 *   polling, realtime updates); cache hits apply synchronously, no flicker
 */

"use client";

import { useEffect } from "react";
import { translateText } from "@/context/LanguageContext";
import { translations, type LangCode } from "@/lib/i18n/translations";

const CACHE_PREFIX = "skillup_auto_trans_";
const MAX_NODES_PER_SWEEP = 500;
const CONCURRENCY = 6;

// Original text per translated node / attribute, for restore-on-English.
const nodeOriginals = new Map<Text, string>();
const attrOriginals = new Map<Element, { placeholder?: string; ariaLabel?: string }>();
let activeLang = "en";

function loadCache(lang: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveCache(lang: string, cache: Record<string, string>) {
  try {
    const keys = Object.keys(cache);
    // cap growth (FIFO-ish trim)
    const trimmed: Record<string, string> = {};
    for (const k of keys.slice(-1500)) trimmed[k] = cache[k];
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(trimmed));
  } catch {
    /* quota — ignore, memory cache still works */
  }
}

/** True when the string should never be sent for translation. */
function shouldSkip(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return true;
  // must contain at least one letter (any supported script)
  if (!/[A-Za-z\u0900-\u097F\u0980-\u09FF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A80-\u0AFF]/.test(t)) return true;
  // numbers / units only ("2.5 / 5", "85%", "12h")
  if (/^[\d\s.,:%$₹+\-/×h%()•·]+$/i.test(t)) return true;
  // single code-like token: urls, verification codes, routes, keys
  if (!t.includes(" ") && (/^(https?:|www\.|mailto:|\/)/i.test(t) || /^SU-[\d-]+-[A-Z0-9]+$/i.test(t) || /^[A-Za-z0-9_.:/-]{12,}$/.test(t))) return true;
  // short key-like identifiers without spaces
  if (t.length < 60 && /^[a-z0-9._:-]+$/i.test(t) && !t.includes(" ")) return true;
  return false;
}

function isSkippableAncestor(node: Node): boolean {
  let el: Node | null = node.parentNode;
  while (el && el !== document.body) {
    if (el instanceof Element) {
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "CODE" || tag === "PRE" || tag === "TEXTAREA" || tag === "OPTION") return true;
      if (el.hasAttribute("data-notranslate")) return true;
    }
    el = el.parentNode;
  }
  return false;
}

/** Translate a batch of unique strings with limited concurrency. */
async function translateBatch(
  strings: string[],
  lang: string,
  cache: Record<string, string>
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < strings.length) {
      const s = strings[i++];
      if (cache[s]) continue;
      try {
        const out = await translateText(s, lang);
        cache[s] = out || s;
      } catch {
        cache[s] = s;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, strings.length) }, worker));
}

export function useSiteAutoTranslate(language: LangCode) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    activeLang = language;

    // Back to English → restore every mutated node/attribute, stop.
    if (language === "en") {
      nodeOriginals.forEach((orig, node) => {
        try {
          if (node.isConnected) node.textContent = orig;
        } catch { /* detached */ }
      });
      nodeOriginals.clear();
      attrOriginals.forEach((orig, el) => {
        if (!el.isConnected) return;
        if (orig.placeholder !== undefined) el.setAttribute("placeholder", orig.placeholder);
        if (orig.ariaLabel !== undefined) el.setAttribute("aria-label", orig.ariaLabel);
      });
      attrOriginals.clear();
      return;
    }

    let cancelled = false;
    const cache = loadCache(language);
    const knownTranslated = new Set(Object.values(translations[language] || {}));
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSave = () => {
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveCache(language, cache);
      }, 1500);
    };

    async function sweep() {
      if (cancelled || activeLang !== language) return;
      // 1) text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const fresh = new Map<Text, string>();
      let count = 0;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null) && count < MAX_NODES_PER_SWEEP) {
        const text = node.textContent || "";
        if (!text.trim()) continue;
        if (nodeOriginals.has(node)) continue; // already translated this session
        if (isSkippableAncestor(node)) continue;
        if (shouldSkip(text)) continue;
        if (knownTranslated.has(text.trim())) continue; // dictionary output — don't double-translate
        // don't steal nodes React is about to reconcile: only leaf-ish text in stable elements
        fresh.set(node, text);
        count++;
      }
      // 2) placeholders + aria-labels
      const attrJobs: Array<{ el: Element; attr: "placeholder" | "aria-label"; value: string }> = [];
      try {
        document.querySelectorAll("input[placeholder], textarea[placeholder], [aria-label]").forEach((el) => {
          if (attrOriginals.has(el)) return;
          if (el.closest("[data-notranslate]")) return;
          const ph = el.getAttribute("placeholder");
          if (ph && !shouldSkip(ph) && !knownTranslated.has(ph.trim())) {
            attrJobs.push({ el, attr: "placeholder", value: ph });
          }
          const al = el.getAttribute("aria-label");
          if (al && !shouldSkip(al) && !knownTranslated.has(al.trim())) {
            attrJobs.push({ el, attr: "aria-label", value: al });
          }
        });
      } catch { /* selector edge */ }

      if (fresh.size === 0 && attrJobs.length === 0) return;

      // apply cache hits instantly
      const needFetch = new Set<string>();
      fresh.forEach((text, n) => {
        const hit = cache[text];
        if (hit && hit !== text) {
          nodeOriginals.set(n, text);
          try { n.textContent = hit; } catch { nodeOriginals.delete(n); }
        } else if (!hit) {
          needFetch.add(text);
        }
      });
      const attrNeed = new Set<string>();
      for (const j of attrJobs) {
        const hit = cache[j.value];
        if (hit && hit !== j.value) {
          const rec = attrOriginals.get(j.el) || {};
          if (j.attr === "placeholder" && rec.placeholder === undefined) rec.placeholder = j.value;
          if (j.attr === "aria-label" && rec.ariaLabel === undefined) rec.ariaLabel = j.value;
          attrOriginals.set(j.el, rec);
          j.el.setAttribute(j.attr, hit);
        } else if (!hit) {
          attrNeed.add(j.value);
        }
      }

      const toFetch = [...needFetch, ...attrNeed].filter((s) => !cache[s]);
      if (toFetch.length === 0) return;
      await translateBatch(toFetch, language, cache);
      if (cancelled || activeLang !== language) return;
      scheduleSave();
      // apply freshly fetched (guard: node may have been re-rendered meanwhile)
      fresh.forEach((text, n) => {
        if (nodeOriginals.has(n)) return;
        const out = cache[text];
        if (out && out !== text && n.isConnected) {
          nodeOriginals.set(n, text);
          try { n.textContent = out; } catch { nodeOriginals.delete(n); }
        }
      });
      for (const j of attrJobs) {
        if (!j.el.isConnected || attrOriginals.has(j.el)) continue;
        const out = cache[j.value];
        if (out && out !== j.value) {
          const rec = attrOriginals.get(j.el) || {};
          if (j.attr === "placeholder" && rec.placeholder === undefined) rec.placeholder = j.value;
          if (j.attr === "aria-label" && rec.ariaLabel === undefined) rec.ariaLabel = j.value;
          attrOriginals.set(j.el, rec);
          j.el.setAttribute(j.attr, out);
        }
      }
    }

    let sweepTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSweep = () => {
      if (sweepTimer) return;
      sweepTimer = setTimeout(() => {
        sweepTimer = null;
        void sweep();
      }, 600);
    };

    void sweep();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          // ignore our own writes
          if (nodeOriginals.has(t)) continue;
          scheduleSweep();
          return;
        }
        if (m.addedNodes.length > 0) {
          scheduleSweep();
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (sweepTimer) clearTimeout(sweepTimer);
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveCache(language, cache);
      }
    };
  }, [language]);
}

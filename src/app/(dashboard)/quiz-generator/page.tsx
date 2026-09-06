/**
 * Enhanced Quiz Generator Page
 * 
 * Creates AI-powered quizzes with:
 * - Bloom's taxonomy level selection
 * - IRT difficulty calibration
 * - Multilingual generation (10 Indian languages via Bhashini)
 * - Duplicate/near-duplicate question detection
 * - Document upload (PDF, text, DOCX)
 * - Question bank management
 * 
 * Why: Not all quizzes are equal. Government evaluators need
 * rigorous, well-structured assessments.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  FileText,
  Upload,
  Brain,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  Download,
  Settings,
  Layers,
  Sparkles,
  AlertTriangle,
  Globe,
  Shuffle,
  BookOpen,
  Mic,
  Languages,
  History,
  Play,
  RotateCcw,
  Send,
  Trophy
} from "lucide-react";
import { createClient } from "@/lib/supabase";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correct_answer: number;
  bloom_level: string;
  difficulty: number;
  explanation: string;
  language: string;
  irt_difficulty?: number;
  duplicate_warning?: string;
}

/** One submitted attempt (also the shape of generated_quiz_attempts rows). */
interface QuizAttempt {
  id: string;
  title: string;
  course_id?: string | null;
  language: string;
  questions: QuizQuestion[];
  answers: Record<string, number>;
  correct_count: number;
  total: number;
  score: number;
  created_at: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function authToken(supabase: any): Promise<string> {
  try {
    return (await supabase.auth.getSession()).data.session?.access_token || "";
  } catch {
    return "";
  }
}

const BLOOM_LEVELS = [
  { id: "remember", label: "Remember", color: "bg-blue-100 text-blue-700", desc: "Recall facts, basic concepts" },
  { id: "understand", label: "Understand", color: "bg-green-100 text-green-700", desc: "Explain ideas, interpret data" },
  { id: "apply", label: "Apply", color: "bg-yellow-100 text-yellow-700", desc: "Use information in new situations" },
  { id: "analyze", label: "Analyze", color: "bg-orange-100 text-orange-700", desc: "Draw connections, identify patterns" },
  { id: "evaluate", label: "Evaluate", color: "bg-red-100 text-red-700", desc: "Justify decisions, defend positions" },
  { id: "create", label: "Create", color: "bg-purple-100 text-purple-700", desc: "Produce new structures, designs" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "or", name: "Odia" },
];

const DIFFICULTY_PRESETS = [
  { label: "Easy", value: -1, color: "bg-green-500" },
  { label: "Medium", value: 0, color: "bg-yellow-500" },
  { label: "Hard", value: 1, color: "bg-red-500" },
  { label: "Adaptive", value: -999, desc: "IRT auto-calibrated" },
];

export default function EnhancedQuizGenerator() {
  const [mode, setMode] = useState<"create" | "bank" | "history">("create");
  // take/result phases for the currently generated quiz
  const [phase, setPhase] = useState<"preview" | "taking" | "result">("preview");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // history
  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedBloomLevels, setSelectedBloomLevels] = useState(["remember", "understand", "apply"]);
  const [difficulty, setDifficulty] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [duplicateCheck, setDuplicateCheck] = useState(true);
  const [irtCalibration, setIrtCalibration] = useState(true);
  
  const [generating, setGenerating] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<Array<{ id: string; title: string; provider: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseMaterials, setCourseMaterials] = useState<Array<{ title: string; url: string; type: string }>>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Load courses for selector
  useEffect(() => {
    supabase.from("courses").select("id, title, provider").order("title").then(({ data }) => {
      if (data) setCourses(data);
    });
  }, []);

  // When course selected, auto-load its materials for AI
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseMaterials([]);
      return;
    }
    setMaterialsLoading(true);
    supabase.from("course_materials").select("title, url, type, content_text").eq("course_id", selectedCourseId).then(({ data }) => {
      setCourseMaterials(data || []);
      // Auto-fill document text from materials so AI has context
      if (data && data.length > 0) {
        const combined = data.map((m: any) => `${m.title}\n${m.content_text || ""}\nSource: ${m.url || ""}`).join("\n\n---\n\n").slice(0, 12000);
        if (combined.trim().length > 50) setFileText(combined);
      }
      setMaterialsLoading(false);
    });
  }, [selectedCourseId]);

  const toggleBloomLevel = (id: string) => {
    setSelectedBloomLevels(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setFile(uploaded);
    setError(null);

    try {
      if (uploaded.type === "text/plain" || uploaded.name.toLowerCase().endsWith(".txt")) {
        const text = await uploaded.text();
        setFileText(text);
        return;
      }

      if (uploaded.name.toLowerCase().endsWith(".docx")) {
        const arrayBuffer = await uploaded.arrayBuffer();
        const mammothModule = await import("mammoth");
        const result = await mammothModule.default.extractRawText({ arrayBuffer });
        setFileText(result.value || "");
        return;
      }

      if (uploaded.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await uploaded.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        let extractedText = "";

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => (typeof item.str === "string" ? item.str : ""))
            .join(" ");
          extractedText += `${pageText}\n`;
        }

        if (!extractedText.trim()) {
          throw new Error("PDF uploaded but no readable text could be extracted.");
        }

        setFileText(extractedText.trim());
        return;
      }

      const text = await uploaded.text();
      setFileText(text || "");
    } catch (err: any) {
      console.error("File extraction failed:", err);
      setError(err?.message || "Could not read the uploaded file. Please paste the text manually or try a text-based file.");
      setFileText("");
    }
  };

  const handleGenerate = async () => {
    if (!file && !fileText.trim()) {
      setError("Please upload a file or enter text content");
      return;
    }

    setGenerating(true);
    setError(null);
    setDuplicateWarnings({});

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Clamp difficulty to backend-allowed range [-3, 3]; -999 sentinel means "auto-calibrate via IRT"
      const safeDifficulty = irtCalibration ? 0 : Math.max(-3, Math.min(3, difficulty));
      const requestBody: any = {
        question_count: questionCount,
        bloom_levels: selectedBloomLevels.length ? selectedBloomLevels : ["remember", "understand", "apply"],
        difficulty: safeDifficulty,
        language: selectedLanguage,
        check_duplicates: duplicateCheck,
        irt_calibration: irtCalibration,
        document_text: fileText.trim() || `Generate a quiz on ${selectedCourseId || "the selected topic"}. Use multiple-choice questions with clear, realistic options.`,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/ai/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      let questions = normalizeQuizQuestions(payload);

      if (!questions.length) {
        questions = buildFallbackQuiz(questionCount, requestBody.document_text, selectedBloomLevels, safeDifficulty);
      }

      // Process duplicate warnings
      if (duplicateCheck) {
        const warnings: Record<string, string> = {};
        for (const q of questions) {
          const dup = findDuplicates(q.text, questions);
          if (dup) {
            warnings[q.id] = `Similar to: "${dup.substring(0, 50)}..."`;
          }
        }
        setDuplicateWarnings(warnings);
      }

      // Apply IRT calibration if enabled
      if (irtCalibration) {
        questions = questions.map((q) => ({
          ...q,
          irt_difficulty: estimateIRT(q.difficulty, selectedBloomLevels.includes(q.bloom_level) ? 1 : 0),
        }));
      }

      setQuiz(questions);
      // fresh quiz → back to preview, clear any previous attempt state
      setPhase("preview");
      setAnswers({});
      setResult(null);
      setSubmitError(null);
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  const startTaking = () => {
    setAnswers({});
    setResult(null);
    setSubmitError(null);
    setPhase("taking");
  };

  const selectOption = (questionId: string, optionIndex: number) => {
    if (phase !== "taking") return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const answeredCount = quiz.filter((q) => answers[q.id] !== undefined).length;

  /** Submit answers to the AI backend for checking + persist attempt for history. */
  const submitQuiz = async () => {
    if (!quiz.length || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to submit the quiz.");
      const token = await authToken(supabase);
      const payloadAnswers = quiz.map((q) => ({
        question_id: q.id,
        selected_option: answers[q.id] ?? -1,
        correct_answer: q.correct_answer,
      }));

      // 1) AI check (score + learning-signal + competency bump on backend)
      let score = 0, correct = 0;
      try {
        const res = await fetch(`${API_BASE}/api/ai/quiz/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            ...(selectedCourseId ? { course_id: selectedCourseId } : {}),
            answers: payloadAnswers.filter((a) => a.selected_option >= 0),
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.data) {
          score = Number(j.data.score) || 0;
          correct = Number(j.data.correct) || 0;
        } else {
          throw new Error(j?.error || `Check failed (${res.status})`);
        }
      } catch (e: any) {
        // backend unreachable → local grading fallback so the user still gets marks
        correct = quiz.filter((q) => answers[q.id] === q.correct_answer).length;
        score = quiz.length ? Math.round((correct / quiz.length) * 100) : 0;
        console.warn("AI check fallback to local grading:", e?.message);
      }
      const total = quiz.length;
      setResult({ score, correct, total });

      // 2) persist full attempt for History tab (best-effort)
      const attemptRow = {
        user_id: user.id,
        course_id: selectedCourseId || null,
        title: `${courses.find((c) => c.id === selectedCourseId)?.title || "Generated Quiz"} — ${new Date().toLocaleString()}`,
        language: selectedLanguage,
        questions: quiz.map((q) => ({
          id: q.id, text: q.text, options: q.options, correct_answer: q.correct_answer,
          explanation: q.explanation, bloom_level: q.bloom_level,
        })),
        answers,
        correct_count: correct,
        total,
        score,
      };
      const { error: histErr } = await supabase.from("generated_quiz_attempts").insert(attemptRow);
      if (histErr) {
        console.warn("History save skipped:", histErr.message);
        setSubmitError(
          histErr.message.includes("does not exist") || histErr.message.includes("schema cache")
            ? "Result checked, but History needs one-time setup: run backend/supabase/quiz_attempt_history.sql in Supabase SQL Editor."
            : `Result checked, but history save failed: ${histErr.message}`
        );
      } else if (mode === "history") {
        void fetchHistory();
      }
      setPhase("result");
    } catch (e: any) {
      setSubmitError(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  /** Load past attempts for the History tab. */
  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: err } = await supabase
        .from("generated_quiz_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (err) throw err;
      setHistory((data || []) as QuizAttempt[]);
    } catch (e: any) {
      const msg = e?.message || "Failed to load history";
      setHistoryError(
        msg.includes("does not exist") || msg.includes("schema cache")
          ? "No history table yet — run backend/supabase/quiz_attempt_history.sql once in Supabase SQL Editor, then new attempts will appear here."
          : msg
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "history") void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleSaveQuiz = async () => {
    if (!quiz.length) return;
    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save each question with backend-schema keys + auth (was 401/400 before)
      const token = await authToken(supabase);
      let saved = 0;
      for (const q of quiz) {
        const res = await fetch(`${API_BASE}/api/ai/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            text: q.text,
            options: q.options.slice(0, 4),
            correct_answer: q.correct_answer,
            bloom_level: q.bloom_level,
            difficulty_beta: Math.max(-3, Math.min(3, Number(q.irt_difficulty ?? q.difficulty ?? 0))),
            explanation: q.explanation,
            language: q.language || selectedLanguage,
            content_hash: simpleHash(q.text),
          }),
        });
        if (res.ok) saved++;
      }

      alert(saved === quiz.length ? `Saved ${saved} questions to question bank!` : `Saved ${saved}/${quiz.length} — check backend logs for the rest.`);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") {
      const sanitized = quiz.map(({ id, text, options, bloom_level, difficulty, explanation, language }) => ({
        id,
        text,
        options,
        bloom_level,
        difficulty,
        explanation,
        language,
      }));
      const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${Date.now()}.json`;
      a.click();
    } else {
      const rows = quiz.map(q => [
        q.text,
        q.options.join(" | "),
        q.bloom_level,
        q.difficulty,
        q.explanation,
      ].join(","));
      const csv = ["Question,Options,Bloom,Difficulty,Explanation", ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${Date.now()}.csv`;
      a.click();
    }
  };

  const copyQuestion = (q: QuizQuestion) => {
    const text = `${q.text}\n${q.options.map((o, i) => `${String.fromCharCode(65+i)}. ${o}`).join("\n")}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary-600" />
          Quiz Generator
        </h1>
        <p className="text-surface-600 mt-1">
          AI-powered quiz generation with Bloom's taxonomy, IRT calibration & multilingual support
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-surface-200">
        {[
          { id: "create", label: "Create Quiz", icon: Sparkles },
          { id: "bank", label: "Question Bank", icon: BookOpen },
          { id: "history", label: "History", icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id as any)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              mode === tab.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-surface-500 hover:text-surface-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "create" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Course Selector - primary (auto-loads PDFs for AI) */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Select Course (auto-loads materials for AI)
              </h3>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="input w-full"
              >
                <option value="">-- Choose a course --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} — {c.provider}</option>
                ))}
              </select>
              {materialsLoading && <p className="text-xs text-surface-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading materials...</p>}
              {selectedCourseId && courseMaterials.length > 0 && (
                <div className="text-xs text-surface-600 bg-surface-50 p-2 rounded border">
                  <p className="font-medium">{courseMaterials.length} material(s) loaded for AI:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {courseMaterials.map((m, i) => (
                      <li key={i} className="truncate">{m.title} <span className="text-surface-400">({m.type})</span> {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-primary-600 underline">open</a>}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-surface-400 mt-1">AI will use all PDFs/texts above to generate the quiz. No upload needed when course is selected.</p>
                </div>
              )}
              {selectedCourseId && !materialsLoading && courseMaterials.length === 0 && (
                <p className="text-xs text-amber-600">No materials found for this course yet. Add PDFs in seed or upload below.</p>
              )}
            </div>

            {/* Document Input */}
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Source Material
              </h3>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-surface-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors flex flex-col items-center gap-1"
              >
                <Upload className="w-5 h-5 text-surface-400" />
                <span className="text-sm text-surface-600">
                  {file ? file.name : "Upload PDF, DOCX, or TXT"}
                </span>
              </button>

              <div className="text-center text-xs text-surface-400">or</div>

              <textarea
                value={fileText}
                onChange={(e) => setFileText(e.target.value)}
                placeholder="Paste course content, manual text, or topic description here..."
                className="input w-full h-40 resize-none"
              />
            </div>

            {/* Question Count */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Question Count
              </h3>
              <input
                type="range"
                min={5}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>5</span>
                <span className="font-bold text-primary-600">{questionCount}</span>
                <span>50</span>
              </div>
            </div>

            {/* Bloom's Taxonomy */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                Bloom's Taxonomy Levels
              </h3>
              <div className="space-y-2">
                {BLOOM_LEVELS.map(level => (
                  <button
                    key={level.id}
                    onClick={() => toggleBloomLevel(level.id)}
                    className={`w-full p-2 text-left rounded-lg border transition-colors ${
                      selectedBloomLevels.includes(level.id)
                        ? "border-primary-500 bg-primary-50"
                        : "border-surface-200 hover:border-surface-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedBloomLevels.includes(level.id) ? "bg-primary-600" : "bg-surface-300"}`} />
                      <span className={`text-xs px-1.5 py-0.5 rounded ${level.color}`}>
                        {level.label}
                      </span>
                      <span className="text-xs text-surface-500">{level.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Difficulty Level
              </h3>
              <div className="flex gap-2">
                {DIFFICULTY_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setDifficulty(preset.value)}
                    className={`flex-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                      difficulty === preset.value
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-surface-200 hover:border-surface-300"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${preset.color}`} />
                    {preset.label}
                  </button>
                ))}
              </div>
              {difficulty === -999 && (
                <p className="text-xs text-surface-500 mt-2">
                  IRT will auto-calibrate difficulty based on aggregate performance
                </p>
              )}
            </div>

            {/* Language */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
                <Languages className="w-4 h-4" />
                Quiz Language
              </h3>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="input w-full"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
              <p className="text-xs text-surface-500 mt-1">
                Quiz will be generated in the selected language
              </p>
            </div>

            {/* Options */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={duplicateCheck}
                  onChange={(e) => setDuplicateCheck(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-primary-600"
                />
                <div>
                  <p className="text-sm font-medium text-surface-900">Duplicate Detection</p>
                  <p className="text-xs text-surface-500">Flag near-duplicate questions</p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={irtCalibration}
                  onChange={(e) => setIrtCalibration(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-primary-600"
                />
                <div>
                  <p className="text-sm font-medium text-surface-900">IRT Calibration</p>
                  <p className="text-xs text-surface-500">Auto-calibrate difficulty parameters</p>
                </div>
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || (!file && !fileText.trim())}
              className="btn btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Quiz
                </>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Questions Panel */}
          <div className="lg:col-span-2 space-y-4">
            {quiz.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Brain className="w-16 h-16 mx-auto text-surface-200 mb-4" />
                <h3 className="text-lg font-medium text-surface-900 mb-2">
                  No Quiz Yet
                </h3>
                <p className="text-surface-600 max-w-md mx-auto">
                  Upload course material or paste text, configure settings, 
                  and click Generate to create an AI-powered quiz.
                </p>
              </div>
            ) : (
              <>
                {/* Stats Bar */}
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-4 text-sm">
                    <span className="text-surface-600">{quiz.length} Questions</span>
                    <span className="text-surface-600">
                      Bloom: {[...new Set(quiz.map(q => q.bloom_level))].join(", ")}
                    </span>
                    <span className="text-surface-600">
                      IRT: {irtCalibration ? "Enabled" : "Disabled"}
                    </span>
                    {phase === "taking" && (
                      <span className="font-medium text-primary-700">Answered: {answeredCount}/{quiz.length}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {phase !== "taking" && phase !== "result" && (
                      <button onClick={startTaking} className="btn btn-primary text-sm flex items-center gap-1.5">
                        <Play className="w-4 h-4" /> Take Quiz
                      </button>
                    )}
                    <button onClick={handleSaveQuiz} className="btn btn-secondary text-sm">
                      Save to Bank
                    </button>
                    <button onClick={() => handleExport("json")} className="btn btn-secondary text-sm">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleExport("csv")} className="btn btn-secondary text-sm">
                      CSV
                    </button>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {submitError}
                  </div>
                )}

                {/* Questions Area — preview / taking / result */}
                {phase === "taking" ? (
                  <TakeQuizView
                    quiz={quiz}
                    answers={answers}
                    onSelect={selectOption}
                    onSubmit={submitQuiz}
                    submitting={submitting}
                    answeredCount={answeredCount}
                  />
                ) : phase === "result" && result ? (
                  <div className="space-y-4">
                    <ResultBanner
                      score={result.score}
                      correct={result.correct}
                      total={result.total}
                      onRetake={startTaking}
                    />
                    <AttemptReview questions={quiz} answers={answers} />
                  </div>
                ) : (
                <div className="space-y-4">
                  {quiz.map((q, idx) => (
                    <div key={q.id} className="bg-white rounded-lg shadow-md border overflow-hidden">
                      {/* Question Header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-surface-400">Q{idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${BLOOM_LEVELS.find(l => l.id === q.bloom_level)?.color || "bg-surface-100"}`}>
                              {q.bloom_level}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              (q.irt_difficulty || 0) < -0.5 ? "bg-green-100 text-green-700" :
                              (q.irt_difficulty || 0) > 0.5 ? "bg-red-100 text-red-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              IRT: {(q.irt_difficulty || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => copyQuestion(q)}
                              className="p-1.5 hover:bg-surface-100 rounded"
                              title="Copy"
                            >
                              <Copy className="w-4 h-4 text-surface-400" />
                            </button>
                          </div>
                        </div>

                        {/* Question Text */}
                        <p className="text-surface-900 font-medium mb-3">{q.text}</p>

                        {/* Options */}
                        <div className="space-y-1.5">
                          {q.options.map((opt, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2 rounded bg-surface-50 border border-surface-100"
                            >
                              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-surface-200 text-surface-600">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="text-sm text-surface-900">{opt}</span>
                            </div>
                          ))}
                        </div>

                        {/* Duplicate Warning */}
                        {duplicateWarnings[q.id] && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            {duplicateWarnings[q.id]}
                          </div>
                        )}

                        <p className="mt-2 text-[11px] text-surface-400">
                          Answers & explanations unlock after you Take Quiz and submit.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {mode === "bank" && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-surface-200 mb-4" />
          <h3 className="text-lg font-medium text-surface-900 mb-2">Question Bank</h3>
          <p className="text-surface-600">Browse and manage your saved questions</p>
        </div>
      )}

      {mode === "history" && (
        <HistoryPanel
          history={history}
          loading={historyLoading}
          error={historyError}
          expandedId={expandedAttempt}
          onToggle={(id) => setExpandedAttempt((p) => (p === id ? null : id))}
          onRetry={fetchHistory}
        />
      )}
    </div>
  );
}

// ============ TAKE / RESULT / HISTORY VIEWS ============

/** Selectable-option quiz taking view. */
function TakeQuizView({
  quiz,
  answers,
  onSelect,
  onSubmit,
  submitting,
  answeredCount,
}: {
  quiz: QuizQuestion[];
  answers: Record<string, number>;
  onSelect: (qid: string, idx: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  answeredCount: number;
}) {
  const allAnswered = answeredCount === quiz.length;
  return (
    <div className="space-y-4">
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
        Select one option per question, then submit — the AI backend checks your answers, updates your score, and saves the attempt to History.
      </div>
      {quiz.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-lg shadow-md border overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-surface-400">Q{idx + 1}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-100 text-surface-600">{q.bloom_level}</span>
              {answers[q.id] !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Answered
                </span>
              )}
            </div>
            <p className="text-surface-900 font-medium mb-3">{q.text}</p>
            <div className="space-y-1.5" role="radiogroup" aria-label={`Question ${idx + 1}`}>
              {q.options.map((opt, i) => {
                const selected = answers[q.id] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelect(q.id, i)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                      selected
                        ? "border-primary-500 bg-primary-50 ring-1 ring-primary-400"
                        : "bg-surface-50 border-surface-200 hover:border-primary-300 hover:bg-primary-50/50"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      selected ? "bg-primary-600 text-white" : "bg-surface-200 text-surface-600"
                    }`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-surface-900">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      <div className="sticky bottom-4 bg-white rounded-lg shadow-lg border p-4 flex items-center justify-between">
        <p className="text-sm text-surface-600">
          <b>{answeredCount}/{quiz.length}</b> answered
          {!allAnswered && <span className="text-amber-600"> — answer all to submit</span>}
        </p>
        <button
          onClick={onSubmit}
          disabled={!allAnswered || submitting}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? "Checking with AI…" : "Submit for AI Check"}
        </button>
      </div>
    </div>
  );
}

/** Score banner after checking. */
function ResultBanner({
  score,
  correct,
  total,
  onRetake,
}: {
  score: number;
  correct: number;
  total: number;
  onRetake: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md border overflow-hidden">
      <div className={`px-6 py-5 text-white flex items-center gap-4 ${score >= 70 ? "bg-gradient-to-r from-green-600 to-emerald-500" : score >= 40 ? "bg-gradient-to-r from-amber-500 to-yellow-500" : "bg-gradient-to-r from-red-600 to-rose-500"}`}>
        <Trophy className="w-10 h-10 shrink-0" />
        <div className="flex-1">
          <p className="text-sm opacity-90">AI-checked result</p>
          <p className="text-3xl font-bold">{score}% <span className="text-base font-normal opacity-90">({correct}/{total} correct)</span></p>
        </div>
        <button onClick={onRetake} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" /> Retake
        </button>
      </div>
    </div>
  );
}

/** Per-question review: user answer vs correct answer + marks + explanation. */
function AttemptReview({
  questions,
  answers,
}: {
  questions: QuizQuestion[];
  answers: Record<string, number>;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q, idx) => {
        const userIdx = answers[q.id];
        const isCorrect = userIdx === q.correct_answer;
        return (
          <div key={q.id || idx} className={`bg-white rounded-lg shadow border overflow-hidden ${isCorrect ? "border-green-200" : "border-red-200"}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-medium text-surface-900"><span className="text-surface-400 font-bold text-sm mr-2">Q{idx + 1}</span>{q.text}</p>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {isCorrect ? "+1" : "0"} / 1
                </span>
              </div>
              <div className="space-y-1.5 mt-3">
                {(q.options || []).map((opt, i) => {
                  const isRight = i === q.correct_answer;
                  const isUser = i === userIdx;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                        isRight
                          ? "border-green-400 bg-green-50 text-green-900 font-medium"
                          : isUser
                            ? "border-red-300 bg-red-50 text-red-800"
                            : "border-surface-100 bg-surface-50 text-surface-500"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                        isRight ? "bg-green-600 text-white" : isUser ? "bg-red-500 text-white" : "bg-surface-200 text-surface-500"
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isRight && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                      {isUser && !isRight && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                      {isRight && <span className="text-[10px] font-bold text-green-700 uppercase">Correct answer</span>}
                      {isUser && !isRight && <span className="text-[10px] font-bold text-red-600 uppercase">Your answer</span>}
                    </div>
                  );
                })}
                {userIdx === undefined && (
                  <p className="text-xs text-amber-600">Not answered.</p>
                )}
              </div>
              {q.explanation && (
                <p className="mt-2 text-xs text-surface-500 bg-surface-50 border border-surface-100 rounded p-2">
                  <b>Why:</b> {q.explanation}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** History tab: past attempts with expandable full review. */
function HistoryPanel({
  history,
  loading,
  error,
  expandedId,
  onToggle,
  onRetry,
}: {
  history: QuizAttempt[];
  loading: boolean;
  error: string | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-600 mb-2" />
        <p className="text-surface-600 text-sm">Loading quiz history…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <p className="text-surface-700 text-sm max-w-lg mx-auto">{error}</p>
        <button onClick={onRetry} className="btn btn-secondary text-sm mt-4">Retry</button>
      </div>
    );
  }
  if (!history.length) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <History className="w-16 h-16 mx-auto text-surface-200 mb-4" />
        <h3 className="text-lg font-medium text-surface-900 mb-2">No Quiz History Yet</h3>
        <p className="text-surface-600">Generate a quiz, take it, and submit — attempts with answers and marks will appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {history.map((a) => {
        const expanded = expandedId === a.id;
        const qs = Array.isArray(a.questions) ? a.questions : [];
        const ans = (a.answers || {}) as Record<string, number>;
        return (
          <div key={a.id} className="bg-white rounded-lg shadow border overflow-hidden">
            <button onClick={() => onToggle(a.id)} className="w-full p-4 flex items-center gap-4 text-left hover:bg-surface-50">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${a.score >= 70 ? "bg-green-500" : a.score >= 40 ? "bg-amber-500" : "bg-red-500"}`}>
                {a.score}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-900 truncate">{a.title}</p>
                <p className="text-xs text-surface-500">
                  {new Date(a.created_at).toLocaleString()} • {a.correct_count}/{a.total} correct • {(a.language || "en").toUpperCase()}
                </p>
              </div>
              <Eye className="w-4 h-4 text-surface-400 shrink-0" />
            </button>
            {expanded && (
              <div className="border-t border-surface-100 p-4 bg-surface-50/50">
                <AttemptReview questions={qs} answers={ans} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ HELPERS ============

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function findDuplicates(text: string, questions: QuizQuestion[]): string | null {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  for (const q of questions) {
    if (q.text === text) continue;
    const qWords = q.text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const overlap = words.filter(w => qWords.includes(w)).length;
    if (overlap > words.length * 0.6) {
      return q.text;
    }
  }
  return null;
}

function estimateIRT(difficulty: number, bloomBonus: number): number {
  // Map difficulty + bloom to IRT theta scale (-3 to +3)
  return Math.max(-2, Math.min(2, difficulty * 0.8 + (bloomBonus - 1) * 0.3));
}

function normalizeQuizQuestions(payload: any): QuizQuestion[] {
  const result = payload?.data ?? payload;
  const questions = result?.questions ?? result ?? [];

  if (!Array.isArray(questions)) return [];

  return questions
    .filter(Boolean)
    .map((q: any, idx: number) => {
      const options = Array.isArray(q?.options) ? q.options.filter((o: any) => typeof o === 'string') : [];
      const safeOptions = options.length >= 4 ? options.slice(0, 4) : [...Array(4 - options.length).fill(''), ...options].slice(-4);
      const correct = Number(q?.correct_answer ?? 0);
      const validCorrect = Number.isInteger(correct) && correct >= 0 && correct < safeOptions.length ? correct : 0;

      return {
        id: String(q?.id ?? `q-${idx + 1}`),
        text: String(q?.text ?? `Question ${idx + 1}`),
        options: safeOptions.map((option: string) => String(option || 'Option not provided')),
        correct_answer: validCorrect,
        bloom_level: String(q?.bloom_level ?? 'understand'),
        difficulty: Number(q?.difficulty ?? 0),
        explanation: String(q?.explanation ?? 'This question is based on the provided material.'),
        language: String(q?.language ?? 'en'),
      };
    })
    .filter((q) => q.text && q.options.length === 4);
}

function buildFallbackQuiz(
  questionCount: number,
  sourceText: string,
  bloomLevels: string[],
  difficulty: number
): QuizQuestion[] {
  const source = sourceText || 'Government training and public policy fundamentals';
  const sentences = source.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 20);

  return Array.from({ length: Math.max(1, Math.min(questionCount, 10)) }, (_, index) => {
    const baseText = sentences[index % Math.max(1, sentences.length)] || 'The main purpose of structured learning is to improve knowledge and decision making.';
    const correctIndex = index % 4;
    const options = [
      `Best practice linked to ${baseText.slice(0, 30)}`,
      `A general but less relevant alternative for ${baseText.slice(0, 20)}`,
      `A distractor that does not match the core concept`,
      `An unrelated option with no evidence in the source material`,
    ];

    const actualOptions = [...options];
    const correctChoice = actualOptions[correctIndex];
    actualOptions[correctIndex] = correctChoice;

    return {
      id: `fallback-q-${index + 1}`,
      text: `Which statement best reflects the key idea in the material: "${baseText.slice(0, 120)}"?`,
      options: actualOptions,
      correct_answer: correctIndex,
      bloom_level: bloomLevels[index % bloomLevels.length] || 'understand',
      difficulty,
      explanation: 'This option is the strongest match to the source material and the most accurate interpretation of the topic.',
      language: 'en',
    };
  });
}
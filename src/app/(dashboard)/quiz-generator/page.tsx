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
  Languages
} from "lucide-react";
import { createClient } from "@/lib/supabase";

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
  const [mode, setMode] = useState<"create" | "bank" | "live">("create");
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
  const [selectedQuestion, setSelectedQuestion] = useState<QuizQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<Array<{ id: string; title: string; provider: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseMaterials, setCourseMaterials] = useState<Array<{ title: string; url: string; type: string }>>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [adaptiveAnswer, setAdaptiveAnswer] = useState<number | null>(null);
  const [adaptiveAnswers, setAdaptiveAnswers] = useState<Array<{ question_id: string; selected_option: number }>>([]);
  const [adaptiveSubmitted, setAdaptiveSubmitted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<QuizQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  
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

  useEffect(() => {
    if (mode !== "bank") return;
    (async () => {
      setBankLoading(true);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/questions`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load question bank");
        setBankQuestions(data.data || []);
      } catch (err: any) { setError(err.message || "Could not load question bank"); }
      finally { setBankLoading(false); }
    })();
  }, [mode, supabase]);

  const toggleBloomLevel = (id: string) => {
    setSelectedBloomLevels(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setFile(uploaded);

    if (uploaded.type === "text/plain" || uploaded.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFileText(ev.target?.result as string || "");
      reader.readAsText(uploaded);
    } else {
      // For PDF/DOCX, we'd need a server-side processor
      // For now, show a note
      setFileText(`[${uploaded.name} uploaded - will be processed server-side]`);
    }
  };

  const isAdaptive = difficulty === -999;

  const generateAdaptiveQuestion = async (history: Array<{ question_id: string; selected_option: number }>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in before generating a quiz");
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const requestBody = {
      course_id: selectedCourseId || undefined,
      question_count: 1,
      bloom_levels: selectedBloomLevels,
      difficulty: 0,
      language: selectedLanguage,
      adaptive: true,
      previous_answers: history,
      document_text: file && !fileText.trim() ? undefined : fileText,
    };
    let response: Response;
    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") || file.name.toLowerCase().endsWith(".docx"))) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("config", JSON.stringify({ ...requestBody, document_text: undefined }));
      response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/quiz/generate-from-file`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
    } else {
      response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data?.questions?.[0]) {
      throw new Error(data.error || data.detail || "Could not generate the next adaptive question");
    }
    return data.data.questions[0] as QuizQuestion;
  };

  const handleAdaptiveNext = async () => {
    const current = quiz[quiz.length - 1];
    if (!current || adaptiveAnswer === null) {
      setError("Select an answer before continuing");
      return;
    }
    const history = [...adaptiveAnswers, { question_id: current.id, selected_option: adaptiveAnswer }];
    setGenerating(true);
    setError(null);
    try {
      setAdaptiveAnswers(history);
      if (history.length >= questionCount) {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const submit = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/quiz/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            course_id: selectedCourseId || undefined,
            answers: history.map(answer => ({
              question_id: answer.question_id,
              selected_option: answer.selected_option,
              correct_answer: quiz.find(question => question.id === answer.question_id)?.correct_answer,
            })),
          }),
        });
        const submitData = await submit.json().catch(() => ({}));
        if (!submit.ok) throw new Error(submitData.error || "Could not submit quiz");
        setAdaptiveSubmitted(true);
        return;
      }
      const next = await generateAdaptiveQuestion(history);
      setQuiz(prev => [...prev, next]);
      setAdaptiveAnswer(null);
    } catch (err: any) {
      setError(err.message || "Failed to generate the next question");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!file && !fileText.trim() && !selectedCourseId) {
      setError("Select a course with study material, upload a PDF/DOCX/TXT, or paste text");
      return;
    }

    setGenerating(true);
    setError(null);
    setDuplicateWarnings({});
    setAdaptiveAnswers([]);
    setAdaptiveAnswer(null);
    setAdaptiveSubmitted(false);
    setSelectedOptions({});
    setQuizSubmitted(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      // Build request
      // Clamp difficulty to backend-allowed range [-3, 3]; -999 sentinel means "auto-calibrate via IRT"
      const safeDifficulty = irtCalibration ? 0 : Math.max(-3, Math.min(3, difficulty));
      const requestBody: any = {
        course_id: selectedCourseId || undefined,
        question_count: questionCount,
        bloom_levels: selectedBloomLevels,
        difficulty: safeDifficulty,
        language: selectedLanguage,
        check_duplicates: duplicateCheck,
        irt_calibration: irtCalibration,
        adaptive: isAdaptive,
        previous_answers: [],
      };
      if (isAdaptive) requestBody.question_count = 1;

      let response: any;

      if (file && (file.type === "application/pdf" || file.name.endsWith(".pdf") || file.name.endsWith(".docx"))) {
        // Upload file for server-side processing
        const formData = new FormData();
        formData.append("file", file);
        formData.append("config", JSON.stringify(requestBody));

        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/ai/quiz/generate-from-file`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });
      } else {
        // Text-based generation
        requestBody.document_text = fileText;

        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/ai/quiz/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      const data = await response.json();

      if (data.success && data.data?.questions) {
        let questions: QuizQuestion[] = data.data.questions.filter((q: QuizQuestion) =>
          q.text?.trim() && Array.isArray(q.options) && q.options.length === 4 &&
          new Set(q.options.map(option => option.trim().toLowerCase())).size === 4 &&
          Number.isInteger(q.correct_answer) && q.correct_answer >= 0 && q.correct_answer < 4
        );
        if (questions.length === 0) throw new Error("The AI returned no valid multiple-choice questions. Please retry.");
        
        // Process duplicate warnings
        if (duplicateCheck) {
          const warnings: Record<string, string> = {};
          for (const q of questions) {
            const hash = simpleHash(q.text);
            const dup = findDuplicates(q.text, questions);
            if (dup) {
              warnings[q.id] = `Similar to: "${dup.substring(0, 50)}..."`;
            }
          }
          setDuplicateWarnings(warnings);
        }

        // Apply IRT calibration if enabled
        if (irtCalibration) {
          questions = questions.map((q, i) => ({
            ...q,
            irt_difficulty: estimateIRT(q.difficulty, selectedBloomLevels.includes(q.bloom_level) ? 1 : 0),
          }));
        }

        setQuiz(questions);
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quiz.length) return;
    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      // Save each question through the authenticated backend question-bank API.
      for (const q of quiz) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/ai/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            text: q.text,
            options: q.options,
            correct_answer: q.correct_answer,
            bloom_level: q.bloom_level,
            difficulty_beta: q.difficulty,
            explanation: q.explanation,
            language: q.language || selectedLanguage,
            content_hash: simpleHash(q.text),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not save a question");
      }

      setBankQuestions(prev => [...quiz, ...prev]);
      alert(`Saved ${quiz.length} questions to question bank!`);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleSubmitGeneratedQuiz = async () => {
    if (!quiz.length || quiz.some(q => selectedOptions[q.id] === undefined)) {
      setError("Select an option for every question before submitting");
      return;
    }
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "")}/api/ai/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          course_id: selectedCourseId || undefined,
          answers: quiz.map(q => ({ question_id: q.id, selected_option: selectedOptions[q.id], correct_answer: q.correct_answer })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit quiz");
      setQuizSubmitted(true);
      alert(`Quiz checked: ${data.data.correct}/${data.data.total} correct (${data.data.score}%). Progress updated.`);
    } catch (err: any) { setError(err.message || "Could not submit quiz"); }
  };

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") {
      const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${Date.now()}.json`;
      a.click();
    } else {
      const rows = quiz.map(q => [
        q.text,
        q.options.join(" | "),
        String.fromCharCode(65 + q.correct_answer),
        q.bloom_level,
        q.difficulty,
        q.explanation,
      ].join(","));
      const csv = ["Question,Options,Correct,Bloom,Difficulty,Explanation", ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${Date.now()}.csv`;
      a.click();
    }
  };

  const copyQuestion = (q: QuizQuestion) => {
    const text = `${q.text}\n${q.options.map((o, i) => `${String.fromCharCode(65+i)}. ${o}`).join("\n")}\nAnswer: ${String.fromCharCode(65+q.correct_answer)}`;
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
              disabled={generating || (!file && !fileText.trim() && !selectedCourseId)}
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
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex gap-4 text-sm">
                    <span className="text-surface-600">{quiz.length} Questions</span>
                    <span className="text-surface-600">
                      Bloom: {[...new Set(quiz.map(q => q.bloom_level))].join(", ")}
                    </span>
                    <span className="text-surface-600">
                      IRT: {irtCalibration ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex gap-2">
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

                {/* Questions List */}
                <div className="space-y-4">
                  {quiz.slice(isAdaptive ? -1 : undefined).map((q, idx) => (
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
                            {!isAdaptive && <>
                              <button onClick={() => copyQuestion(q)} className="p-1.5 hover:bg-surface-100 rounded" title="Copy">
                                <Copy className="w-4 h-4 text-surface-400" />
                              </button>
                              <button onClick={() => setSelectedQuestion(selectedQuestion?.id === q.id ? null : q)} className="p-1.5 hover:bg-surface-100 rounded">
                                <Eye className="w-4 h-4 text-surface-400" />
                              </button>
                            </>}
                          </div>
                        </div>

                        {/* Question Text */}
                        <p className="text-surface-900 font-medium mb-3">{q.text}</p>

                        {/* Options */}
                        <div className="space-y-1.5">
                          {q.options.map((opt, i) => (
                            <label
                              key={i}
                              className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${((isAdaptive && adaptiveAnswer === i) || (!isAdaptive && selectedOptions[q.id] === i)) ? "bg-primary-50 border-primary-300" : "bg-surface-50 border-transparent"}`}
                            >
                              <input type="radio" name={`quiz-${q.id}`} checked={isAdaptive ? adaptiveAnswer === i : selectedOptions[q.id] === i} onChange={() => isAdaptive ? setAdaptiveAnswer(i) : setSelectedOptions(prev => ({ ...prev, [q.id]: i }))} />
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                isAdaptive && adaptiveAnswer === i ? "bg-primary-500 text-white" : "bg-surface-200 text-surface-600"
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="text-sm text-surface-900">{opt}</span>
                            </label>
                          ))}
                        </div>

                        {/* Duplicate Warning */}
                        {duplicateWarnings[q.id] && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            {duplicateWarnings[q.id]}
                          </div>
                        )}

                        {/* Expanded View */}
                        {!isAdaptive && selectedQuestion?.id === q.id && (
                          <div className="mt-3 pt-3 border-t border-surface-100">
                            <p className="text-xs font-medium text-surface-700 mb-1">Explanation:</p>
                            <p className="text-sm text-surface-600">{q.explanation}</p>
                            <div className="mt-2 flex gap-2">
                              <span className="text-xs bg-surface-100 text-surface-600 px-2 py-1 rounded">
                                Difficulty: {q.difficulty}
                              </span>
                              <span className="text-xs bg-surface-100 text-surface-600 px-2 py-1 rounded">
                                Language: {q.language || selectedLanguage}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!isAdaptive && quiz.length > 0 && (
                  <div className="mt-5 flex items-center gap-3">
                    <button onClick={handleSubmitGeneratedQuiz} disabled={quizSubmitted || Object.keys(selectedOptions).length !== quiz.length} className="btn btn-primary flex-1">
                      {quizSubmitted ? "Quiz Submitted & Checked" : "Submit Answers & Update Progress"}
                    </button>
                    <span className="text-xs text-surface-500">{Object.keys(selectedOptions).length}/{quiz.length} answered</span>
                  </div>
                )}
                {isAdaptive && quiz.length > 0 && !adaptiveSubmitted && (
                  <div className="mt-5 rounded-lg border border-primary-200 bg-primary-50 p-4">
                    <p className="text-sm text-primary-800 mb-3">Question {quiz.length} of {questionCount}. Your answer is hidden until you submit the quiz.</p>
                    <button onClick={handleAdaptiveNext} disabled={generating || adaptiveAnswer === null} className="btn btn-primary w-full">
                      {generating ? "Generating next question..." : quiz.length >= questionCount ? "Submit Quiz" : "Submit answer & generate next"}
                    </button>
                  </div>
                )}
                {isAdaptive && adaptiveSubmitted && (
                  <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-800">
                    Quiz submitted successfully. Your responses have been recorded.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {mode === "bank" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="text-lg font-medium text-surface-900">Question Bank</h3><p className="text-sm text-surface-600">Your saved AI questions</p></div>
            <span className="text-sm text-surface-500">{bankQuestions.length} questions</span>
          </div>
          {bankLoading ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : bankQuestions.length === 0 ? (
            <div className="py-10 text-center text-surface-500"><BookOpen className="w-12 h-12 mx-auto text-surface-200 mb-3" />No saved questions yet. Generate a quiz and click Save to Bank.</div>
          ) : <div className="space-y-3">{bankQuestions.map((q, index) => <div key={q.id || index} className="border rounded-lg p-4">
            <p className="font-medium text-surface-900">{index + 1}. {q.text}</p>
            <div className="grid md:grid-cols-2 gap-2 mt-3">{q.options.map((option, i) => <div key={i} className={`text-sm p-2 rounded ${i === q.correct_answer ? "bg-green-50 text-green-800 border border-green-200" : "bg-surface-50"}`}>{String.fromCharCode(65 + i)}. {option}</div>)}</div>
            {q.explanation && <p className="text-xs text-surface-500 mt-3">{q.explanation}</p>}
          </div>)}</div>}
        </div>
      )}
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

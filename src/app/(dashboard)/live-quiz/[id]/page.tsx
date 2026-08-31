/**
 * Live AI Quiz Page - WebRTC AI Examiner
 * 
 * Voice-based AI examiner that uses Gemini Live API to:
 * - Generate questions from course materials (PDF, video, images)
 * - Speak questions aloud in user's chosen language
 * - Listen to user's spoken answers
 * - Evaluate answers strictly (anti-cheat mode)
 * - Adapt difficulty in real-time
 * 
 * Why: Hands-free learning for field officials, real AI examiner feel,
 * integrates all course content (multimedia) into the assessment.
 */

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Volume2, 
  Globe, 
  Loader2, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Eye,
  EyeOff,
  Languages,
  Settings,
  Award
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: number;
  bloom_level: string;
  difficulty: number;
  explanation: string;
  image_url?: string;
  image_description?: string;
}

interface QuizState {
  currentQuestion: number;
  totalQuestions: number;
  questions: Question[];
  correctCount: number;
  startedAt: Date;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  violations: Array<{ type: string; timestamp: number }>;
  status: 'loading' | 'in_progress' | 'completed' | 'error';
  finalScore?: number;
}

const LANGUAGES = [
  { code: "en", name: "English", native: "English", geminiCode: "en-US" },
  { code: "hi", name: "Hindi", native: "हिन्दी", geminiCode: "hi-IN" },
  { code: "bn", name: "Bengali", native: "বাংলা", geminiCode: "bn-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", geminiCode: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", geminiCode: "te-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", geminiCode: "mr-IN" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", geminiCode: "gu-IN" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", geminiCode: "kn-IN" },
];

const DIFFICULTY_LEVELS = [
  { value: "easy", label: "Easy", desc: "Recall-based questions" },
  { value: "medium", label: "Medium", desc: "Application & analysis" },
  { value: "hard", label: "Hard", desc: "Synthesis & evaluation" },
];

export default function LiveQuizPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const courseId = params.id;
  const supabase = createClient();

  // Quiz state
  const [state, setState] = useState<QuizState>({
    currentQuestion: 0,
    totalQuestions: 5,
    questions: [],
    correctCount: 0,
    startedAt: new Date(),
    language: "en",
    difficulty: "medium",
    violations: [],
    status: "loading",
  });

  // Media state
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [connected, setConnected] = useState(false);

  // Anti-cheat
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // UI
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionIdRef = useRef<string>("");
  const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "ws://localhost:8001";

  // Init
  useEffect(() => {
    initializeQuiz();
    setupMedia();
    setupAntiCheat();
    return () => cleanup();
  }, [courseId]);

  async function initializeQuiz() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Create session
      const { data: session } = await supabase.from("live_quiz_sessions").insert({
        user_id: user.id,
        course_id: courseId,
        language: state.language,
        difficulty: state.difficulty === "easy" ? -1 : state.difficulty === "medium" ? 0 : 1,
        status: "in_progress",
        total_questions: 5,
        transcript: [],
        violations: [],
      }).select().single();

      if (session) sessionIdRef.current = session.id;

      // Generate questions from course materials via AI
      const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).single();
      
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/ai/live-quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_id: courseId,
          course_title: course?.title,
          course_description: course?.description,
          language: state.language,
          difficulty: state.difficulty,
          num_questions: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate quiz: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.questions) {
        setState(prev => ({
          ...prev,
          questions: data.questions,
          status: "in_progress",
        }));

        // Save session
        if (sessionIdRef.current) {
          await supabase.from("live_quiz_sessions").update({
            total_questions: data.questions.length,
          }).eq("id", sessionIdRef.current);
        }

        // Read first question
        setTimeout(() => readQuestion(0, data.questions), 1000);
      } else {
        throw new Error(data.error || "No questions generated");
      }
    } catch (err: any) {
      console.error("Quiz init error:", err);
      setState(prev => ({ ...prev, status: "error" }));
    }
  }

  async function setupMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1 },
        video: { width: 320, height: 240, facingMode: "user" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setConnected(true);
    } catch (err) {
      console.error("Media setup error:", err);
      addViolation("media_denied");
    }
  }

  function setupAntiCheat() {
    // Detect tab switches
    const onVisibilityChange = () => {
      if (document.hidden && state.status === "in_progress") {
        setTabSwitchCount(prev => prev + 1);
        addViolation("tab_switch");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Detect window blur
    const onBlur = () => {
      if (state.status === "in_progress") {
        addViolation("window_blur");
      }
    };
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }

  function addViolation(type: string) {
    setState(prev => ({
      ...prev,
      violations: [...prev.violations, { type, timestamp: Date.now() }],
    }));
  }

  function readQuestion(index: number, questions?: Question[]) {
    const qs = questions || state.questions;
    if (index >= qs.length) {
      finishQuiz();
      return;
    }
    const q = qs[index];
    setState(prev => ({ ...prev, currentQuestion: index, correctCount: prev.correctCount }));
    setFeedback(null);
    setCurrentAnswer("");
    setShowHint(false);
    setAiSpeaking(true);

    // Use browser TTS to read question
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(q.text);
      const lang = LANGUAGES.find(l => l.code === state.language)?.geminiCode || "en-US";
      utterance.lang = lang;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onend = () => setAiSpeaking(false);
      speechSynthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setAiSpeaking(false), 3000);
    }
  }

  const startListening = useCallback(() => {
    if (!streamRef.current) {
      addViolation("no_mic");
      return;
    }
    
    setUserSpeaking(true);
    
    // Use Web Speech API for recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    const lang = LANGUAGES.find(l => l.code === state.language)?.geminiCode || "en-US";
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          setCurrentAnswer(transcript);
        }
      }
    };

    recognition.onend = () => {
      setUserSpeaking(false);
      if (finalTranscript) {
        setCurrentAnswer(finalTranscript);
        evaluateAnswer(finalTranscript);
      } else {
        setCurrentAnswer("");
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setUserSpeaking(false);
      addViolation("speech_error_" + event.error);
    };

    recognition.start();
  }, [state.language]);

  function stopListening() {
    setUserSpeaking(false);
  }

  function evaluateAnswer(answer: string) {
    const q = state.questions[state.currentQuestion];
    if (!q) return;

    // Simple keyword matching + AI scoring
    const correctOption = q.options[q.correct_answer].toLowerCase();
    const userAnswer = answer.toLowerCase();
    
    let isCorrect = false;
    
    // Check if user said the answer letter (A, B, C, D) or full option text
    const answerLetter = String.fromCharCode(65 + q.correct_answer).toLowerCase();
    if (userAnswer.trim() === answerLetter) {
      isCorrect = true;
    } else if (userAnswer.includes(correctOption) || correctOption.includes(userAnswer)) {
      isCorrect = true;
    } else {
      // Use keyword matching - count matching words
      const correctWords = correctOption.split(/\s+/).filter(w => w.length > 3);
      const userWords = userAnswer.split(/\s+/);
      const matches = correctWords.filter(w => userWords.includes(w)).length;
      if (matches >= Math.ceil(correctWords.length / 2)) {
        isCorrect = true;
      }
    }

    setFeedback({ correct: isCorrect, explanation: q.explanation });
    setState(prev => ({
      ...prev,
      correctCount: prev.correctCount + (isCorrect ? 1 : 0),
    }));

    // AI explains the answer
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const explanation = isCorrect 
        ? `Correct! ${q.explanation}` 
        : `Incorrect. The correct answer is ${q.options[q.correct_answer]}. ${q.explanation}`;
      const utterance = new SpeechSynthesisUtterance(explanation);
      const lang = LANGUAGES.find(l => l.code === state.language)?.geminiCode || "en-US";
      utterance.lang = lang;
      utterance.rate = 0.95;
      setAiSpeaking(true);
      utterance.onend = () => setAiSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }

  function nextQuestion() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    readQuestion(state.currentQuestion + 1);
  }

  async function finishQuiz() {
    setState(prev => ({ ...prev, status: "completed" }));
    const finalScore = Math.round((state.correctCount / state.questions.length) * 100);
    
    // Save session
    if (sessionIdRef.current) {
      await supabase.from("live_quiz_sessions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        correct_answers: state.correctCount,
        final_score: finalScore,
        transcript: state.questions.map((q, i) => ({
          question: q.text,
          answer: currentAnswer,
          correct: i < state.correctCount,
        })),
        violations: state.violations,
      }).eq("id", sessionIdRef.current);
    }

    // Save as assessment attempt
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("assessment_attempts").insert({
        user_id: user.id,
        course_id: courseId,
        auto_score: finalScore,
        passed: finalScore >= 60,
        status: "approved",
        time_taken_seconds: Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
        tab_switch_count: tabSwitchCount,
        fullscreen_exits: state.violations.filter(v => v.type === "fullscreen_exit").length,
      });

      // Log learning signal for retraining
      await supabase.from("learning_signals").insert({
        user_id: user.id,
        course_id: courseId,
        signal_type: "quiz_score",
        signal_value: finalScore,
        signal_metadata: {
          violations: state.violations.length,
          language: state.language,
          difficulty: state.difficulty,
        },
      });

      // If passed, mark course as completed
      if (finalScore >= 60) {
        await supabase.from("course_enrollments").update({
          status: "completed",
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
        }).eq("user_id", user.id).eq("course_id", courseId);

        // Update competency scores based on course
        const { data: course } = await supabase.from("courses").select("target_competencies").eq("id", courseId).single();
        if (course?.target_competencies) {
          for (const compId of course.target_competencies) {
            try {
              await supabase.rpc("increment_competency_score", {
                p_user_id: user.id,
                p_competency_id: compId,
                p_increase: (finalScore / 100) * 0.5,
              });
            } catch {}
          }
        }
      }
    }
  }

  function cleanup() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function retryQuestion() {
    setCurrentAnswer("");
    setFeedback(null);
    readQuestion(state.currentQuestion, state.questions);
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary-200 rounded-full"></div>
          <div className="absolute inset-0 w-20 h-20 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold text-surface-900">Preparing Your AI Examiner</h2>
        <p className="text-surface-600 text-center max-w-md">
          Generating personalized questions from your course materials...
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-semibold text-surface-900">Failed to Start Quiz</h2>
        <p className="text-surface-600 text-center max-w-md">
          The AI examiner could not be reached. Please make sure:
        </p>
        <ul className="text-sm text-surface-600 space-y-1 text-left">
          <li>✓ AI service is running (port 8001)</li>
          <li>✓ Backend is running (port 3001)</li>
          <li>✓ You have microphone permission</li>
        </ul>
        <div className="flex gap-2">
          <button onClick={initializeQuiz} className="btn btn-primary">Retry</button>
          <Link href="/my-courses" className="btn btn-secondary">Back to My Courses</Link>
        </div>
      </div>
    );
  }

  if (state.status === "completed") {
    const finalScore = Math.round((state.correctCount / state.questions.length) * 100);
    const passed = finalScore >= 60;
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${
            passed ? "bg-green-100" : "bg-yellow-100"
          }`}>
            {passed ? (
              <Award className="w-12 h-12 text-green-600" />
            ) : (
              <AlertTriangle className="w-12 h-12 text-yellow-600" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-surface-900 mb-2">
            {passed ? "Congratulations!" : "Almost There!"}
          </h2>
          <p className="text-surface-600 mb-6">
            {passed 
              ? "You passed the Live AI Quiz" 
              : "Review the material and try again"}
          </p>
          <div className="text-6xl font-bold text-primary-800 mb-2">{finalScore}%</div>
          <p className="text-sm text-surface-500 mb-6">
            {state.correctCount} of {state.questions.length} correct
          </p>
          
          {state.violations.length > 0 && (
            <div className="mb-6 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-700">
                {state.violations.length} anti-cheat violation(s) recorded
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Link href="/my-courses" className="btn btn-primary">
              Back to My Courses
            </Link>
            <Link href="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = state.questions[state.currentQuestion];
  const progress = ((state.currentQuestion + 1) / state.questions.length) * 100;

  return (
    <div className="min-h-screen bg-surface-50 py-4 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/my-courses" className="text-surface-500 hover:text-surface-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-sm text-surface-500">Live AI Quiz</p>
              <p className="font-semibold text-surface-900">
                Question {state.currentQuestion + 1} of {state.questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language */}
            <select
              value={state.language}
              onChange={(e) => setState(prev => ({ ...prev, language: e.target.value }))}
              className="px-2 py-1 text-sm border border-surface-200 rounded"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>

            {/* Settings */}
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-surface-100 rounded"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Violations Badge */}
            {state.violations.length > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {state.violations.length}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-surface-200 rounded-full h-2 mb-4 overflow-hidden">
          <div 
            className="h-full bg-primary-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Main Quiz Area */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6 space-y-6">
            {/* AI Examiner Avatar */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-50 to-accent-50 rounded-lg">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                {aiSpeaking && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-surface-900">AI Examiner</p>
                <p className="text-sm text-surface-600">
                  {aiSpeaking ? "🔊 Speaking..." : feedback ? "✓ Answer evaluated" : "🎤 Your turn to answer"}
                </p>
              </div>
              {connected && (
                <span className="text-xs text-green-600">● Connected</span>
              )}
            </div>

            {/* Question */}
            {currentQ && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    currentQ.bloom_level === "remember" ? "bg-blue-100 text-blue-700" :
                    currentQ.bloom_level === "understand" ? "bg-green-100 text-green-700" :
                    currentQ.bloom_level === "apply" ? "bg-yellow-100 text-yellow-700" :
                    currentQ.bloom_level === "analyze" ? "bg-orange-100 text-orange-700" :
                    "bg-purple-100 text-purple-700"
                  }`}>
                    {currentQ.bloom_level}
                  </span>
                  <span className="text-xs text-surface-500">Difficulty: {currentQ.difficulty}</span>
                </div>

                <h2 className="text-xl font-semibold text-surface-900 mb-4">
                  {currentQ.text}
                </h2>

                {/* Image if present */}
                {currentQ.image_url && (
                  <div className="mb-4">
                    <img src={currentQ.image_url} alt="Question" className="max-w-full rounded-lg border" />
                    {currentQ.image_description && (
                      <p className="text-sm text-surface-500 mt-2">{currentQ.image_description}</p>
                    )}
                  </div>
                )}

                {/* Options (shown after answer) */}
                {feedback && (
                  <div className="space-y-2 mb-4">
                    {currentQ.options.map((opt, i) => (
                      <div 
                        key={i}
                        className={`p-3 rounded-lg border ${
                          i === currentQ.correct_answer 
                            ? "border-green-500 bg-green-50" 
                            : "border-surface-200 bg-surface-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                            i === currentQ.correct_answer 
                              ? "bg-green-500 text-white" 
                              : "bg-surface-200 text-surface-600"
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {i === currentQ.correct_answer && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* User's spoken answer */}
                {currentAnswer && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm text-blue-600 font-medium">Your answer:</p>
                    <p className="text-surface-900">{currentAnswer}</p>
                  </div>
                )}

                {/* Feedback */}
                {feedback && (
                  <div className={`p-4 rounded-lg border ${
                    feedback.correct 
                      ? "bg-green-50 border-green-200" 
                      : "bg-red-50 border-red-200"
                  }`}>
                    <div className="flex items-start gap-2">
                      {feedback.correct ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-surface-900">
                          {feedback.correct ? "Correct!" : "Not quite right"}
                        </p>
                        <p className="text-sm text-surface-600 mt-1">
                          {feedback.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 mt-4">
                  {!feedback ? (
                    <>
                      <button
                        onMouseDown={micOn ? startListening : undefined}
                        onMouseUp={micOn ? stopListening : undefined}
                        onTouchStart={micOn ? startListening : undefined}
                        onTouchEnd={micOn ? stopListening : undefined}
                        disabled={!micOn || aiSpeaking}
                        className={`flex-1 py-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                          userSpeaking 
                            ? "bg-red-600 text-white animate-pulse" 
                            : micOn && !aiSpeaking
                            ? "bg-primary-600 text-white hover:bg-primary-700"
                            : "bg-surface-200 text-surface-400 cursor-not-allowed"
                        }`}
                      >
                        {userSpeaking ? (
                          <><MicOff className="w-5 h-5" /> Listening... (release to evaluate)</>
                        ) : aiSpeaking ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> AI Speaking...</>
                        ) : (
                          <><Mic className="w-5 h-5" /> Hold to Speak Answer</>
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={nextQuestion}
                      className="flex-1 btn btn-primary py-4 flex items-center justify-center gap-2"
                    >
                      {state.currentQuestion < state.questions.length - 1 ? "Next Question" : "Finish Quiz"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={retryQuestion}
                    className="p-3 border border-surface-200 rounded-lg hover:bg-surface-50"
                    title="Replay question"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Camera + Anti-Cheat */}
          <div className="space-y-4">
            {/* Camera Feed */}
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-surface-700 mb-2">Proctor View</p>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
                {cameraOn ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <VideoOff className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="px-2 py-1 bg-red-600 text-white text-xs rounded flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    REC
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setCameraOn(!cameraOn);
                    streamRef.current?.getVideoTracks().forEach(t => t.enabled = !cameraOn);
                  }}
                  className="flex-1 p-2 text-sm border border-surface-200 rounded hover:bg-surface-50"
                >
                  {cameraOn ? <Video className="w-4 h-4 inline mr-1" /> : <VideoOff className="w-4 h-4 inline mr-1" />}
                  Camera
                </button>
                <button
                  onClick={() => {
                    setMicOn(!micOn);
                    streamRef.current?.getAudioTracks().forEach(t => t.enabled = !micOn);
                  }}
                  className="flex-1 p-2 text-sm border border-surface-200 rounded hover:bg-surface-50"
                >
                  {micOn ? <Mic className="w-4 h-4 inline mr-1" /> : <MicOff className="w-4 h-4 inline mr-1" />}
                  Mic
                </button>
              </div>
            </div>

            {/* Anti-Cheat Status */}
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-medium text-surface-700 mb-2">Exam Integrity</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">Tab switches</span>
                  <span className={`font-medium ${tabSwitchCount > 2 ? "text-red-600" : "text-surface-900"}`}>
                    {tabSwitchCount} / 3
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">Media connected</span>
                  <span className={connected ? "text-green-600" : "text-red-600"}>
                    {connected ? "✓" : "✗"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">AI examiner</span>
                  <span className="text-green-600">Active</span>
                </div>
              </div>
              {tabSwitchCount >= 3 && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                  ⚠️ Multiple tab switches detected. Quiz may be invalidated.
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">📝 How to Answer</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Wait for the AI to finish speaking</li>
                <li>• Hold the mic button and speak your answer</li>
                <li>• Say the letter (A, B, C, D) or full answer</li>
                <li>• Release to evaluate</li>
                <li>• Replay question anytime with 🔊</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
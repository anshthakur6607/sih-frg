/**
 * AI Tutor Chat Page
 * 
 * Multilingual RAG-powered chat assistant for learning support.
 * Supports voice mode and course-contextual responses.
 * 
 * Why: Provides real-time learner support with AI tutor.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  Send, 
  Loader2,
  Globe,
  Volume2,
  Settings,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { aiApi } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  language: string;
  sources?: Array<{ course_id: string; preview: string }>;
  audio_url?: string;
}

const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
];

export default function AITutorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState("en");
  const [voiceMode, setVoiceMode] = useState(false);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [showCourseFilter, setShowCourseFilter] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load user's enrolled courses for context
    loadCourses();
    // Load chat history
    loadChatHistory();
  }, [supabase]);

  const loadCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load all courses from courses table + enrolled courses
      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, title")
        .order("title");

      const { data: enrolledData } = await supabase
        .from("course_enrollments")
        .select("course:courses(id, title)")
        .eq("user_id", user.id);

      // Merge: enrolled courses first, then all courses
      const enrolledIds = new Set(
        enrolledData?.map((e: any) => e.course?.id).filter(Boolean) || []
      );
      const merged: Array<{ id: string; title: string }> = [];

      // Add enrolled courses first
      for (const e of enrolledData || []) {
        const c = e.course as any;
        if (c?.id && !merged.find(m => m.id === c.id)) {
          merged.push(c);
        }
      }
      // Add remaining courses
      for (const c of allCourses || []) {
        if (!merged.find(m => m.id === c.id)) {
          merged.push(c);
        }
      }

      setCourses(merged);
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("tutor_sessions")
        .select("conversation_history")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (data?.[0]?.conversation_history) {
        const history = data[0].conversation_history.map((msg: any, idx: number) => ({
          id: `hist-${idx}`,
          role: msg.role,
          content: msg.text || msg.content,
          timestamp: new Date(msg.timestamp || Date.now()),
          language: msg.language || "en",
        }));
        setMessages(history);
      } else {
        // Welcome message
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm your AI Learning Tutor. I can help you with statistical concepts, course material, quiz preparation, and more. You can ask me in English, Hindi, or other Indian languages. How can I help you today?",
          timestamp: new Date(),
          language: "en",
        }]);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      language,
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setSending(true);

    try {
      const response = await aiApi.chat({
        message: userInput,
        course_id: selectedCourse || undefined,
        user_id: (await supabase.auth.getUser()).data.user?.id || "",
        language,
      });

      if (response && (response as any).success) {
        const data = (response as any).data;
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
          language: data.language,
          sources: data.sources,
          audio_url: data.audio_url,
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Save to history
        saveChatHistory();
      } else {
        throw new Error("Failed to get response");
      }
    } catch (err: any) {
      const detail = err?.message || err?.code || "Unknown error";
      const isMaintenance = err?.code === "MAINTENANCE" || detail.includes("maintenance");
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: isMaintenance
          ? `Backend is unreachable (${detail}). Check that backend (port 3001) and AI service (port 8001) are running, then retry.`
          : `AI request failed: ${detail}. If this persists, check AI service logs on port 8001 (GOOGLE_API_KEY, X-API-Key).`,
        timestamp: new Date(),
        language: "en",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const saveChatHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("tutor_sessions").upsert({
        user_id: user.id,
        course_id: selectedCourse || "general",
        module_id: "chat",
        conversation_history: messages.map(m => ({
          role: m.role,
          text: m.content,
          timestamp: m.timestamp.toISOString(),
          language: m.language,
        })),
        last_timestamp: 0,
        summary_state: messages.slice(-2).map(m => m.content).join(" | "),
      });
    } catch (err) {
      console.error("Failed to save chat history:", err);
    }
  };

  const LANG_TO_BCP47: Record<string,string> = { en:"en-US", hi:"hi-IN", bn:"bn-IN", ta:"ta-IN", te:"te-IN", mr:"mr-IN", gu:"gu-IN", kn:"kn-IN", ml:"ml-IN", or:"or-IN" };

  const toggleSTT = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported — use Chrome. Or type your question."); return; }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = LANG_TO_BCP47[language] || "en-US";
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalTxt = "";
    rec.onstart = () => setIsRecording(true);
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i=e.resultIndex;i<e.results.length;i++){
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += t + " ";
        else interim += t;
      }
      setInput((finalTxt + interim).trimStart());
    };
    rec.onend = () => { setIsRecording(false); if (finalTxt.trim()) setInput(finalTxt.trim()); };
    rec.onerror = () => setIsRecording(false);
    try { rec.start(); } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col bg-white rounded-lg shadow-md border border-surface-200 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-800 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">AI Learning Tutor</h2>
            <p className="text-xs text-primary-100">Multilingual RAG-powered assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Course Context Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowCourseFilter(!showCourseFilter)}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              {selectedCourse ? courses.find(c => c.id === selectedCourse)?.title : "General"}
            </button>
            {showCourseFilter && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border w-64 z-10">
                <button 
                  onClick={() => setSelectedCourse("")}
                  className={`w-full px-3 py-2 text-left text-sm ${!selectedCourse ? "bg-primary-50 text-primary-700" : "text-surface-700 hover:bg-surface-50"}`}
                >
                  General (All Courses)
                </button>
                {courses.map(course => (
                  <button 
                    key={course.id}
                    onClick={() => { setSelectedCourse(course.id); setShowCourseFilter(false); }}
                    className={`w-full px-3 py-2 text-left text-sm ${selectedCourse === course.id ? "bg-primary-50 text-primary-700" : "text-surface-700 hover:bg-surface-50"}`}
                  >
                    {course.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm text-white bg-white/10"
          >
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.native}</option>
            ))}
          </select>

          {/* Voice Mode Toggle */}
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className={`p-2 rounded ${voiceMode ? "bg-green-500" : "bg-white/20 hover:bg-white/30"}`}
            title={voiceMode ? "Disable voice mode" : "Enable voice mode"}
          >
            {voiceMode ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
              }`}
            >
              {msg.role === "user" ? <MessageSquare className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            
            <div className={`flex-1 max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
              <div 
                className={`inline-block px-4 py-2 rounded-2xl ${
                  msg.role === "user" 
                    ? "bg-primary-800 text-white rounded-tr-none" 
                    : "bg-surface-100 text-surface-900 rounded-tl-none"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-surface-500 cursor-pointer flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Sources
                    </summary>
                    <div className="mt-1 space-y-1">
                      {msg.sources.map((src, idx) => (
                        <div key={idx} className="text-xs text-surface-600 bg-surface-50 p-2 rounded">
                          <span className="font-medium">{src.course_id}</span>
                          <p className="truncate">{src.preview}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Audio Player */}
                {msg.audio_url && (
                  <audio controls className="mt-2 w-full" src={msg.audio_url} />
                )}

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-surface-400">{formatTime(msg.timestamp)}</span>
                  <span className="text-xs text-surface-400 px-1.5 py-0.5 bg-surface-100 rounded">
                    {LANGUAGES.find(l => l.code === msg.language)?.native || msg.language}
                  </span>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={() => copyMessage(msg.content)} className="p-1 hover:bg-surface-200 rounded" title="Copy">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button className="p-1 hover:bg-surface-200 rounded" title="Helpful">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button className="p-1 hover:bg-surface-200 rounded" title="Not helpful">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 animate-spin text-accent-600" />
            </div>
            <div className="bg-surface-100 rounded-2xl rounded-tl-none px-4 py-2 max-w-[80%]">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-75" />
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-surface-200">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening… speak now" : "Ask me anything — or tap mic to speak (Shift+Enter for new line)"}
            rows={1}
            maxLength={1000}
            className={`input flex-1 resize-none ${isRecording ? "ring-2 ring-red-300 bg-red-50" : "pr-12"}`}
            disabled={sending}
          />
          <button
            type="button"
            onClick={toggleSTT}
            title={isRecording ? "Stop listening" : `Speak in ${LANGUAGES.find(l=>l.code===language)?.native || language}`}
            className={`p-3 h-10 flex-shrink-0 rounded-lg border flex items-center justify-center ${isRecording ? "bg-red-600 text-white border-red-600 animate-pulse" : "bg-white border-surface-200 hover:bg-surface-50 text-surface-700"}`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="btn btn-primary p-3 h-10 flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-surface-500 mt-1 text-center">
          Supports: English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia
        </p>
      </div>
    </div>
  );
}
/**
 * Roadmap Page - SkillUp Platform Vision
 * 
 * Shows the phased roadmap for SkillUp platform.
 * Also serves as a feature showcase / landing page for the dashboard.
 */

"use client";

import { useState } from "react";
import { 
  Rocket, 
  Target, 
  Globe, 
  Shield, 
  Cpu, 
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Database,
  Cloud,
  Lock,
  BarChart3,
  Award
} from "lucide-react";

const PHASES = [
  {
    id: 1,
    name: "Phase 1: Foundation",
    subtitle: "MoSPI Pilot",
    status: "completed" as const,
    period: "Months 1-3",
    icon: Rocket,
    color: "bg-green-500",
    colorLight: "bg-green-50 border-green-200",
    colorText: "text-green-700",
    colorBorder: "border-green-500",
    features: [
      { text: "Competency profiling for NSSO/CSO officials", done: true },
      { text: "iGOT course catalog integration", done: true },
      { text: "Basic AI recommendation engine", done: true },
      { text: "Pre-assessment survey (role/experience)", done: true },
      { text: "Course enrollment & progress tracking", done: true },
      { text: "Live AI Quiz (voice-based)", done: true },
    ],
  },
  {
    id: 2,
    name: "Phase 2: Intelligence",
    subtitle: "Full AI Integration",
    status: "active" as const,
    period: "Months 4-6",
    icon: Brain,
    color: "bg-blue-500",
    colorLight: "bg-blue-50 border-blue-200",
    colorText: "text-blue-700",
    colorBorder: "border-blue-500",
    features: [
      { text: "Knowledge graph (officials ↔ skills ↔ courses ↔ roles)", done: true },
      { text: "Hybrid recommender (content + collaborative + rule-based)", done: true },
      { text: "Bloom's taxonomy + IRT quiz generation", done: true },
      { text: "Multilingual support (10 Indian languages)", done: true },
      { text: "RAG-based AI tutor (iGOT + statistical manuals)", done: true },
      { text: "Real-time iGOT webhook sync", done: false },
      { text: "NSSTA TPAC calendar integration", done: false },
    ],
  },
  {
    id: 3,
    name: "Phase 3: Scale",
    subtitle: "National Expansion",
    status: "pending" as const,
    period: "Months 7-12",
    icon: Globe,
    color: "bg-purple-500",
    colorLight: "bg-purple-50 border-purple-200",
    colorText: "text-purple-700",
    colorBorder: "border-purple-500",
    features: [
      { text: "State statistical departments (DES) onboarding", done: false },
      { text: "Predictive workforce analytics", done: false },
      { text: "Skill heatmaps by state/department", done: false },
      { text: "What-If simulator for HR planning", done: false },
      { text: "Gamification & competency milestones", done: false },
      { text: "PWA offline-first mobile mode", done: false },
      { text: "APAR/performance data linkage (RBAC)", done: false },
    ],
  },
  {
    id: 4,
    name: "Phase 4: Observatory",
    subtitle: "National Platform",
    status: "pending" as const,
    period: "Year 2+",
    icon: TrendingUp,
    color: "bg-primary-600",
    colorLight: "bg-primary-50 border-primary-200",
    colorText: "text-primary-700",
    colorBorder: "border-primary-600",
    features: [
      { text: "National Statistical Skills Observatory", done: false },
      { text: "UNSD/PARIS21 benchmark integration", done: false },
      { text: "International statistical capacity framework", done: false },
      { text: "DIKSHA/SWAYAM e-learning federation", done: false },
      { text: "MeghRaj (GI Cloud) deployment", done: false },
      { text: "GIGW/CERT-In compliance certification", done: false },
      { text: "Blockchain certificate verification", done: false },
    ],
  },
];

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Knowledge Graph AI",
    desc: "XAI-compliant recommendations with explainable reasoning chains. Every course suggestion comes with why.",
    tags: ["Explainable AI", "Graph DB", "Hybrid Recommender"],
  },
  {
    icon: Mic,
    title: "Voice AI Examiner",
    desc: "Live AI quizzes over voice. Gemini-powered, speaks in 10 languages, detects cheating automatically.",
    tags: ["WebRTC", "Voice AI", "Multilingual"],
  },
  {
    icon: Database,
    title: "RAG-Powered Tutor",
    desc: "AI mentor grounded in iGOT content + NSSTA statistical manuals. Ask real questions, get precise answers.",
    tags: ["RAG", "Vector DB", "Contextual AI"],
  },
  {
    icon: Cloud,
    title: "iGOT Ecosystem",
    desc: "Real-time sync with iGOT Karmayogi via webhooks. NSSTA TPAC calendar as first-class data source.",
    tags: ["Webhooks", "NSSTA", "iGOT"],
  },
  {
    icon: Shield,
    title: "MeghRaj Compliant",
    desc: "Built for GI Cloud deployment from day one. GIGW accessibility, CERT-In ready, data localization.",
    tags: ["GI Cloud", "GIGW", "CERT-In"],
  },
  {
    icon: BarChart3,
    title: "Predictive Analytics",
    desc: "Forecast skill shortages 1-2 years out. What-if simulators for workforce planning.",
    tags: ["IRT", "Forecasting", "Workforce AI"],
  },
];

function Brain(props: any) { return <Cpu {...props} />; }
function Mic(props: any) { return <Award {...props} />; }

export default function RoadmapPage() {
  const [activePhase, setActivePhase] = useState(2);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-surface-900">SkillUp Platform Roadmap</h1>
        <p className="text-surface-600 mt-2 max-w-2xl mx-auto">
          From MoSPI pilot to a National Statistical Skills Observatory — 
          a phased, evidence-driven approach to building India's statistical capacity
        </p>
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
        {PHASES.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setActivePhase(phase.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activePhase === phase.id
                ? `${phase.color} text-white`
                : phase.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            <phase.icon className="w-4 h-4" />
            {phase.name}
          </button>
        ))}
      </div>

      {/* Phase Detail */}
      {PHASES.map((phase) => (
        <div
          key={phase.id}
          className={`${phase.colorLight} border rounded-xl p-6 ${phase.status === "active" ? "ring-2 ring-offset-2 ring-" + phase.color.replace("bg-", "") : ""}`}
          style={{ display: activePhase === phase.id ? "block" : "none" }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${phase.color} text-white`}>
                  {phase.status === "completed" ? "Completed" : phase.status === "active" ? "In Progress" : "Planned"}
                </span>
                <span className="text-xs text-surface-500">{phase.period}</span>
              </div>
              <h2 className={`text-xl font-bold ${phase.colorText}`}>{phase.name}</h2>
              <p className="text-sm text-surface-600">{phase.subtitle}</p>
            </div>
            <phase.icon className={`w-8 h-8 ${phase.colorText}`} />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            {phase.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                {feature.done ? (
                  <CheckCircle className={`w-5 h-5 ${phase.colorText} mt-0.5 flex-shrink-0`} />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${phase.colorBorder} mt-0.5 flex-shrink-0`} />
                )}
                <span className={`text-sm ${feature.done ? "text-surface-900" : "text-surface-500"}`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Key Capabilities */}
      <div>
        <h2 className="text-xl font-bold text-surface-900 mb-4">Key Platform Capabilities</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="bg-white rounded-lg shadow p-4 border border-surface-100">
              <cap.icon className="w-6 h-6 text-primary-600 mb-2" />
              <h3 className="font-semibold text-surface-900 mb-1">{cap.title}</h3>
              <p className="text-sm text-surface-600 mb-3">{cap.desc}</p>
              <div className="flex flex-wrap gap-1">
                {cap.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-surface-100 text-surface-600 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Section */}
      <div className="bg-surface-900 text-white rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-6 h-6 text-primary-400" />
          <h2 className="text-xl font-bold">Government Compliance Architecture</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Cloud, title: "MeghRaj GI Cloud", desc: "Designed for GovCloud deployment" },
            { icon: Globe, title: "GIGW Accessibility", desc: "WCAG 2.1 AA compliant" },
            { icon: Lock, title: "CERT-In Ready", desc: "Security incident response" },
            { icon: Database, title: "Data Localization", desc: "All data stored in India" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-2">
              <item.icon className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-surface-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* International Frameworks */}
      <div className="bg-accent-50 border border-accent-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-accent-900 mb-4">International Benchmarking</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { name: "UNSD Framework", desc: "Statistical capacity-building indicators" },
            { name: "PARIS21", desc: "Partnership in Statistics for Development" },
            { name: "SDG 17.18", desc: "Capacity building for statistical systems" },
          ].map((framework) => (
            <div key={framework.name} className="p-3 bg-white rounded-lg border border-accent-100">
              <p className="font-medium text-accent-900">{framework.name}</p>
              <p className="text-xs text-accent-700 mt-1">{framework.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
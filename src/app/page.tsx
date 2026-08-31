/**
 * Home Page - SkillUp Platform
 * 
 * Landing page for the SkillUp Skill Intelligence & Learning Platform.
 * Provides overview of the platform and navigation to key features.
 * 
 * Why: This is the entry point for unauthenticated users.
 * Government-style design with professional appearance.
 */

import Link from "next/link";
import { 
  BarChart3, 
  GraduationCap, 
  Award, 
  Shield,
  Users,
  BookOpen,
  Target,
  TrendingUp
} from "lucide-react";

/**
 * Feature card component
 * Displays a key platform feature with icon and description
 */
function FeatureCard({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md border border-surface-200 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary-800" />
      </div>
      <h3 className="text-lg font-semibold text-surface-900 mb-2">{title}</h3>
      <p className="text-surface-600 text-sm">{description}</p>
    </div>
  );
}

/**
 * Stats component
 * Shows platform statistics in a clean grid
 */
function StatsSection() {
  const stats = [
    { value: "50+", label: "Competency Areas" },
    { value: "1000+", label: "Government Officials" },
    { value: "500+", label: "Training Courses" },
    { value: "85%", label: "Success Rate" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-3xl font-bold text-primary-800">{stat.value}</div>
          <div className="text-sm text-surface-600">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Main Home page component
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header / Navigation */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-800 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-primary-800">SkillUp</span>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-surface-600 hover:text-primary-800 text-sm font-medium">
                Features
              </Link>
              <Link href="#about" className="text-surface-600 hover:text-primary-800 text-sm font-medium">
                About
              </Link>
              <Link href="#contact" className="text-surface-600 hover:text-primary-800 text-sm font-medium">
                Contact
              </Link>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-surface-600 hover:text-primary-800 text-sm font-medium px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-primary-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-accent-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
              Skill Intelligence & Learning Platform
            </h1>
            <p className="text-lg text-surface-600 mb-8">
              Empowering government officials with AI-driven competency assessment, 
              personalized learning paths, and skill gap analysis for improved governance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-primary-800 text-white px-8 py-3 rounded-md text-base font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Start Your Journey
              </Link>
              <Link
                href="#features"
                className="border-2 border-primary-800 text-primary-800 px-8 py-3 rounded-md text-base font-medium hover:bg-primary-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-y border-surface-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StatsSection />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-surface-900 mb-4">
              Comprehensive Skill Development Solution
            </h2>
            <p className="text-surface-600 max-w-2xl mx-auto">
              A complete platform designed for government officials to assess, 
              develop, and certify their competencies across multiple domains.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Target}
              title="AI Competency Assessment"
              description="Intelligent evaluation of your skills across Statistical, Technical, Digital Governance, and Behavioural domains."
            />
            <FeatureCard
              icon={TrendingUp}
              title="Skill Gap Analysis"
              description="Identify your skill gaps with visual Red-Yellow-Green indicators and personalized recommendations."
            />
            <FeatureCard
              icon={BookOpen}
              title="Personalized Learning Paths"
              description="Get course recommendations tailored to your role, department, and identified skill gaps."
            />
            <FeatureCard
              icon={Award}
              title="AI Quiz Generation"
              description="Auto-generate assessments from course materials using advanced AI with Bloom's taxonomy tagging."
            />
            <FeatureCard
              icon={Shield}
              title="Anti-Cheat Security"
              description="Secure assessment environment with tab-switch detection, fullscreen enforcement, and telemetry."
            />
            <FeatureCard
              icon={BarChart3}
              title="Executive Dashboards"
              description="Comprehensive analytics for both employees and administrators with skill heatmaps and predictions."
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-surface-900 mb-6">
                Built for Government Excellence
              </h2>
              <p className="text-surface-600 mb-6">
                SkillUp is designed specifically for MoSPI and NSSTA officials, 
                aligning with the 4 mandated competency domains:
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <span className="font-medium text-surface-900">Statistical Competencies</span>
                    <p className="text-sm text-surface-600">Survey Sampling, National Accounts, SDG Indicators</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <span className="font-medium text-surface-900">Technical Skills</span>
                    <p className="text-sm text-surface-600">Python, R, SQL, GIS, AI/ML, Open Data</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <span className="font-medium text-surface-900">Digital Governance</span>
                    <p className="text-sm text-surface-600">Cybersecurity, Data Privacy, DPI, Govt Cloud</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-primary-800 text-sm font-bold">4</span>
                  </div>
                  <div>
                    <span className="font-medium text-surface-900">Behavioural Skills</span>
                    <p className="text-sm text-surface-600">Leadership, Communication, Ethics, Change Management</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-xl p-8">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-surface-900 mb-4">
                  Platform Benefits
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-surface-700">
                    <Shield className="w-4 h-4 text-primary-600" />
                    Secure assessment with anti-cheat
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <TrendingUp className="w-4 h-4 text-primary-600" />
                    Real-time progress tracking
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <Award className="w-4 h-4 text-primary-600" />
                    Verified certificates
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <Users className="w-4 h-4 text-primary-600" />
                    NSSTA TPAC classroom integration
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 text-surface-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-bold">SkillUp</span>
              </div>
              <p className="text-sm">
                AI-enabled Skill Intelligence & Learning Platform for Government Officials
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                <li><Link href="#about" className="hover:text-white">About</Link></li>
                <li><Link href="/login" className="hover:text-white">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>MoSPI, Government of India</li>
                <li>NSSTA, Greater Noida</li>
                <li>support@skillup.gov.in</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-surface-800 mt-8 pt-8 text-sm text-center">
            <p>&copy; 2024 SkillUp. All rights reserved. Government of India.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
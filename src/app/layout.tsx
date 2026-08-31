/**
 * Root Layout for SkillUp Platform
 * 
 * This is the root layout component that wraps all pages.
 * It sets up the HTML structure, fonts, metadata, and global providers.
 * 
 * Why: Next.js 15 uses the App Router where layout.tsx provides
 * the root-level structure that persists across page navigations.
 */

import type { Metadata } from "next";
import "./globals.css";
import { MaintenanceProvider } from "@/components/maintenance-banner";

/**
 * Metadata for SEO and browser
 * Defines the page title, description, and favicon
 */
export const metadata: Metadata = {
  title: "SkillUp - Skill Intelligence & Learning Platform",
  description: "AI-enabled skill intelligence platform for MoSPI and NSSTA government officials. Assess competencies, identify skill gaps, and personalized learning paths.",
  keywords: ["skill development", "government training", "competency assessment", "learning platform", "MoSPI", "NSSTA"],
  authors: [{ name: "SkillUp Team" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "noindex, nofollow", // Government site - restrict indexing for demo
};

/**
 * Root layout component
 * 
 * @param children - The page content to render
 * 
 * This component:
 * 1. Sets up the HTML document structure
 * 2. Applies global styles
 * 3. Provides layout that persists across navigations
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-50 antialiased">
        <MaintenanceProvider>{children}</MaintenanceProvider>
      </body>
    </html>
  );
}
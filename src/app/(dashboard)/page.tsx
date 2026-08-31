/**
 * Dashboard Redirect
 * 
 * Redirects /dashboard to /dashboard page for cleaner URLs
 */
import { redirect } from "next/navigation";

export default function DashboardRoot() {
  redirect("/dashboard");
}
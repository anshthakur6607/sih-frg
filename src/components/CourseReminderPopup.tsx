"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { X, BookOpen, Clock, Bell } from "lucide-react";
import Link from "next/link";

interface Enrollment {
  id: string;
  progress: number;
  enrolled_at: string;
  course: {
    id: string;
    title: string;
    duration_hours: number;
  };
}

const STORAGE_KEY = "skillup_last_reminder_check";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function CourseReminderPopup() {
  const [reminders, setReminders] = useState<Enrollment[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const lastCheck = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toDateString();

    if (lastCheck === today) {
      setDismissed(true);
      return;
    }

    async function fetchReminders() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`${API_URL}/api/reminders/pending`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        const enrollmentList: Enrollment[] = data.data || data || [];
        setReminders(enrollmentList);
      } catch (err) {
        console.error("Failed to fetch reminders:", err);
      }
    }

    fetchReminders();
  }, [supabase]);

  const handleSnooze = async (enrollmentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${API_URL}/api/reminders/snooze/${enrollmentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (err) {
      console.error("Failed to snooze reminder:", err);
    }

    setReminders((prev) => prev.filter((r) => r.id !== enrollmentId));
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toDateString());
    setDismissed(true);
  };

  if (dismissed || reminders.length === 0) return null;

  const getDaysEnrolled = (dateStr: string) => {
    const enrolled = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-surface-200 overflow-hidden">
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <Bell className="w-5 h-5" />
            <h3 className="font-semibold text-base">Continue Your Learning</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-surface-600 text-sm mb-5">
            You have {reminders.length} incomplete course{reminders.length > 1 ? "s" : ""} waiting for you.
            Pick up where you left off!
          </p>

          <div className="space-y-3">
            {reminders.map((enrollment) => {
              const days = getDaysEnrolled(enrollment.enrolled_at);
              return (
                <div
                  key={enrollment.id}
                  className="p-4 bg-surface-50 rounded-lg border border-surface-200 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-surface-900 text-sm">
                          {enrollment.course?.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{days} day{days !== 1 ? "s" : ""} since enrolled</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-surface-600 mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{enrollment.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${enrollment.progress || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/courses/${enrollment.course?.id}`}
                      className="flex-1 bg-blue-600 text-white text-center px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Continue
                    </Link>
                    <button
                      onClick={() => handleSnooze(enrollment.id)}
                      className="px-3 py-2 bg-surface-100 text-surface-600 rounded-lg text-sm font-medium hover:bg-surface-200 transition-colors"
                    >
                      Snooze
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleDismiss}
            className="mt-4 w-full text-center text-sm text-surface-500 hover:text-surface-700 transition-colors"
          >
            Remind me tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}

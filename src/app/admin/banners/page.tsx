/**
 * Admin Banners Management Page
 *
 * Allows admins to create, edit, delete, and manage banners
 * that appear to users across the platform.
 */

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Megaphone,
  ChevronDown,
  Send,
} from "lucide-react";

interface Banner {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  cta_label?: string;
  cta_url?: string;
  related_course_id?: string;
  target_departments?: string[];
  target_designations?: string[];
  target_ministries?: string[];
  target_levels?: string[];
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
}

interface BannerForm {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  cta_label: string;
  cta_url: string;
  related_course_id: string;
  target_departments: string[];
  target_designations: string[];
  target_ministries: string[];
  target_levels: string[];
  starts_at: string;
  ends_at: string;
}

interface Course {
  id: string;
  title: string;
}

interface Department {
  department: string;
}

interface ReminderForm {
  course_id: string;
  department: string;
  designation: string;
}

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info (Blue)", color: "bg-blue-600" },
  { value: "warning", label: "Warning (Amber)", color: "bg-amber-500" },
  { value: "critical", label: "Critical (Red)", color: "bg-red-600" },
  { value: "success", label: "Success (Green)", color: "bg-green-600" },
];

const LEVEL_OPTIONS = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function AdminBannersPage() {
  const { t } = useLanguage();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const supabase = createClient();

  const emptyForm: BannerForm = {
    title: "",
    message: "",
    severity: "info",
    cta_label: "",
    cta_url: "",
    related_course_id: "",
    target_departments: [],
    target_designations: [],
    target_ministries: [],
    target_levels: [],
    starts_at: "",
    ends_at: "",
  };

  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [reminderForm, setReminderForm] = useState<ReminderForm>({
    course_id: "",
    department: "",
    designation: "",
  });

  useEffect(() => {
    fetchData();
  }, [supabase]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [bannersRes, coursesRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/banners/admin`, { headers }),
        fetch(`${API_URL}/api/courses?limit=200`, { headers }),
        fetch(`${API_URL}/api/admin/users?limit=500`, { headers }),
      ]);

      if (bannersRes.ok) {
        const bannersData = await bannersRes.json();
        setBanners(bannersData.data || bannersData || []);
      }

      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(coursesData.data || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const userList: any[] = usersData.data || [];
        const depts = Array.from(new Set(userList.map((u: any) => u.department).filter(Boolean))) as string[];
        setDepartments(depts.sort());
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };

      const payload: Record<string, unknown> = { ...form };
      if (!form.cta_url) delete payload.cta_url;
      if (!form.cta_label) delete payload.cta_label;
      if (!form.related_course_id) delete payload.related_course_id;
      if (!form.starts_at) delete payload.starts_at;
      if (!form.ends_at) delete payload.ends_at;
      if (form.target_departments.length === 0) delete payload.target_departments;
      if (form.target_designations.length === 0) delete payload.target_designations;
      if (form.target_ministries.length === 0) delete payload.target_ministries;
      if (form.target_levels.length === 0) delete payload.target_levels;

      const url = editingId
        ? `${API_URL}/api/banners/${editingId}`
        : `${API_URL}/api/banners`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to save banner:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${API_URL}/api/banners/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error("Failed to delete banner:", err);
    }
  }

  async function handleToggle(id: string, currentState: boolean) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${API_URL}/api/banners/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !currentState }),
      });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, is_active: !currentState } : b))
      );
    } catch (err) {
      console.error("Failed to toggle banner:", err);
    }
  }

  function handleEdit(banner: Banner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      message: banner.message,
      severity: banner.severity,
      cta_label: banner.cta_label || "",
      cta_url: banner.cta_url || "",
      related_course_id: banner.related_course_id || "",
      target_departments: banner.target_departments || [],
      target_designations: banner.target_designations || [],
      target_ministries: banner.target_ministries || [],
      target_levels: banner.target_levels || [],
      starts_at: banner.starts_at ? banner.starts_at.split("T")[0] : "",
      ends_at: banner.ends_at ? banner.ends_at.split("T")[0] : "",
    });
    setShowForm(true);
  }

  async function handleSendReminder(e: React.FormEvent) {
    e.preventDefault();
    setSendingReminder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${API_URL}/api/banners/reminder`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reminderForm),
      });

      if (res.ok) {
        setShowReminderForm(false);
        setReminderForm({ course_id: "", department: "", designation: "" });
        alert("Reminders sent successfully!");
      } else {
        const err = await res.json();
        alert(`Failed to send reminders: ${err.error}`);
      }
    } catch (err) {
      console.error("Failed to send reminders:", err);
    } finally {
      setSendingReminder(false);
    }
  }

  function toggleArrayField(
    field: keyof Pick<BannerForm, "target_departments" | "target_designations" | "target_ministries" | "target_levels">,
    value: string
  ) {
    setForm((prev) => {
      const arr = prev[field];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [field]: next };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Banners & Announcements</h1>
            <p className="text-sm text-slate-500">Manage platform-wide banners and notifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReminderForm(true)}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Reminder
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Banner
          </button>
        </div>
      </div>

      {/* Banners Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-700">Banner</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Severity</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Targeting</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Schedule</th>
              <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
              <th className="text-right py-3 px-4 font-medium text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No banners yet. Create your first one!
                </td>
              </tr>
            )}
            {banners.map((banner) => (
              <tr key={banner.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900">{banner.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{banner.message}</p>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium text-white ${
                      SEVERITY_OPTIONS.find((s) => s.value === banner.severity)?.color || "bg-blue-600"
                    }`}
                  >
                    {banner.severity}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">
                  {banner.target_departments?.length ? (
                    <span>{banner.target_departments.length} dept{banner.target_departments.length !== 1 ? "s" : ""}</span>
                  ) : (
                    <span className="text-slate-400">All users</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">
                  {banner.starts_at && banner.ends_at ? (
                    <>
                      {new Date(banner.starts_at).toLocaleDateString()} -{" "}
                      {new Date(banner.ends_at).toLocaleDateString()}
                    </>
                  ) : (
                    <span className="text-slate-400">No schedule</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleToggle(banner.id, banner.is_active)}
                    className="flex items-center gap-1.5"
                    title={banner.is_active ? "Deactivate" : "Activate"}
                  >
                    {banner.is_active ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                    <span className={`text-xs font-medium ${banner.is_active ? "text-green-600" : "text-slate-400"}`}>
                      {banner.is_active ? "Active" : "Inactive"}
                    </span>
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(banner)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Banner Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Banner" : "Create New Banner"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="Important Notice: System Update"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message *</label>
                <textarea
                  required
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="The platform will be under maintenance on..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Severity</label>
                <div className="flex gap-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, severity: opt.value as any }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.severity === opt.value
                          ? `${opt.color} text-white border-transparent`
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">CTA Label</label>
                  <input
                    type="text"
                    value={form.cta_label}
                    onChange={(e) => setForm((prev) => ({ ...prev, cta_label: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    placeholder="Learn More"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">CTA URL</label>
                  <input
                    type="url"
                    value={form.cta_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, cta_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Related Course</label>
                <select
                  value={form.related_course_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, related_course_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="">None</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Starts At</label>
                  <input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ends At</label>
                  <input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Departments</label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleArrayField("target_departments", dept)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.target_departments.includes(dept)
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Levels</label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleArrayField("target_levels", level)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        form.target_levels.includes(level)
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editingId ? "Update Banner" : "Create Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Reminder Form Modal */}
      {showReminderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReminderForm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Send Completion Reminder</h2>
              <button onClick={() => setShowReminderForm(false)} className="p-2 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReminder} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Send a reminder to users who have an incomplete enrollment in a specific course.
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Course</label>
                <select
                  required
                  value={reminderForm.course_id}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, course_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="">Select a course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Department (Optional)</label>
                <select
                  value={reminderForm.department}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation (Optional)</label>
                <input
                  type="text"
                  value={reminderForm.designation}
                  onChange={(e) => setReminderForm((prev) => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  placeholder="e.g., Section Officer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReminderForm(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReminder}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {sendingReminder ? "Sending..." : "Send Reminders"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronRight, Calendar, CheckCircle2, Clock, AlertCircle, Pencil, Trash2, Plus, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedTask {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  projectId: number;
  categoryId: number | null;
  categoryName: string | null;
  assignedToId: number | null;
  assignedToName: string | null;
  assigneeIds?: number[];
  assignees?: { id: number; name: string; email: string }[];
  createdById: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedProject {
  id: number;
  name: string;
  status: string;
}

interface PersonalNote {
  id: number;
  content: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("arch_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Request failed");
  }
  return res.json();
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-primary/10 text-primary border-primary/30",
  review: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30",
  done: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

const priorityDot: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

// ─── My Feed Page ─────────────────────────────────────────────────────────────

type Filter = "all" | "todo" | "in_progress" | "review" | "done";

export default function MyFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [noteInput, setNoteInput] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // ── Feed query ──
  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => apiFetch<{ projects: FeedProject[]; tasks: FeedTask[] }>("/api/feed"),
  });

  // ── Personal notes queries ──
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["personal-notes"],
    queryFn: () => apiFetch<PersonalNote[]>("/api/personal-notes"),
  });

  const createNote = useMutation({
    mutationFn: (content: string) =>
      apiFetch<PersonalNote>("/api/personal-notes", { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personal-notes"] }); setNoteInput(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateNote = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiFetch<PersonalNote>(`/api/personal-notes/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personal-notes"] }); setEditingId(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/personal-notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal-notes"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Filtering & grouping ──
  const allTasks = feed?.tasks ?? [];
  const projects = feed?.projects ?? [];

  const filtered = filter === "all" ? allTasks : allTasks.filter(t => t.status === filter);

  const byProject: Record<number, FeedTask[]> = {};
  for (const t of filtered) {
    if (!byProject[t.projectId]) byProject[t.projectId] = [];
    byProject[t.projectId].push(t);
  }
  const projectsWithTasks = projects.filter(p => byProject[p.id]?.length);

  const counts: Record<Filter, number> = {
    all: allTasks.length,
    todo: allTasks.filter(t => t.status === "todo").length,
    in_progress: allTasks.filter(t => t.status === "in_progress").length,
    review: allTasks.filter(t => t.status === "review").length,
    done: allTasks.filter(t => t.status === "done").length,
  };

  const filterTabs: { key: Filter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { key: "todo", label: "Todo", icon: <Clock className="w-3.5 h-3.5" /> },
    { key: "in_progress", label: "In Progress", icon: <Loader2 className="w-3.5 h-3.5" /> },
    { key: "review", label: "Review", icon: <AlertCircle className="w-3.5 h-3.5" /> },
    { key: "done", label: "Done", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border bg-card px-4 md:px-8 py-5">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight">My Feed</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.role === "admin"
                ? "All tasks across every project"
                : "Tasks you created or are assigned to"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-8">

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {filterTabs.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                    filter === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {icon}
                  {label}
                  <span className={`ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-mono ${
                    filter === key ? "bg-white/20" : "bg-secondary"
                  }`}>
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Tasks */}
            {feedLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : projectsWithTasks.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No tasks{filter !== "all" ? ` with status "${filter.replace("_", " ")}"` : ""}</p>
              </div>
            ) : (
              <div className="space-y-8">
                {projectsWithTasks.map(project => (
                  <section key={project.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="font-bold text-base tracking-tight">{project.name}</h2>
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {byProject[project.id].length}
                      </span>
                      <Link
                        href={`/projects/${project.id}`}
                        className="ml-auto text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
                      >
                        Open project <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {byProject[project.id].map(task => (
                        <Link
                          key={task.id}
                          href={`/projects/${task.projectId}/tasks/${task.id}`}
                          className="group bg-card border-2 border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
                              {task.title}
                            </span>
                            <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${priorityDot[task.priority]}`} title={task.priority} />
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${statusColors[task.status]}`}>
                              {task.status.replace("_", " ")}
                            </span>
                            {task.categoryName && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border font-medium">
                                {task.categoryName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                            {task.assignees?.length ? (
                              <span className="truncate max-w-[180px]">
                                → {task.assignees.map(assignee => assignee.name).join(", ")}
                              </span>
                            ) : task.assignedToName ? (
                              <span className="truncate max-w-[120px]">→ {task.assignedToName}</span>
                            ) : null}
                            {task.dueDate && (
                              <span className={`flex items-center gap-1 ml-auto ${
                                new Date(task.dueDate) < new Date() && task.status !== "done"
                                  ? "text-red-500 font-medium"
                                  : ""
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {format(new Date(task.dueDate), "MMM d")}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Personal Notes */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <StickyNote className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-base tracking-tight">Personal Notes</h2>
                <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {notes.length}
                </span>
              </div>

              {/* Add note */}
              <div className="bg-card border-2 border-border rounded-lg p-4 mb-4">
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Jot down a personal note…"
                  rows={3}
                  className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground"
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && noteInput.trim()) {
                      createNote.mutate(noteInput.trim());
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">⌘↵ to save</span>
                  <button
                    disabled={!noteInput.trim() || createNote.isPending}
                    onClick={() => noteInput.trim() && createNote.mutate(noteInput.trim())}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {createNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add Note
                  </button>
                </div>
              </div>

              {/* Notes list */}
              {notesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No personal notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {notes.map(note => (
                    <div key={note.id} className="bg-card border-2 border-border rounded-lg p-4 group">
                      {editingId === note.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full bg-background border-2 border-primary rounded p-2 text-sm resize-none outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => editContent.trim() && updateNote.mutate({ id: note.id, content: editContent.trim() })}
                              disabled={!editContent.trim() || updateNote.isPending}
                              className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-40"
                            >
                              {updateNote.isPending ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs font-medium px-3 py-1.5 border border-border rounded-md hover:bg-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <p className="flex-1 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteNote.mutate(note.id)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                        {format(new Date(note.updatedAt), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Note {
  id: number;
  content: string;
  projectId: number;
  taskId: number | null;
  userId: number;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("arch_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Request failed");
  }
  return res.json();
}

// ─── Project notes ──────────────────────────────────────────────────────────

export function projectNotesKey(projectId: number) {
  return ["notes", "project", projectId] as const;
}

export function useProjectNotes(projectId: number) {
  return useQuery({
    queryKey: projectNotesKey(projectId),
    queryFn: () => apiFetch<Note[]>(`/api/projects/${projectId}/notes`),
    enabled: !!projectId,
  });
}

export function useCreateProjectNote(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<Note>(`/api/projects/${projectId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectNotesKey(projectId) }),
  });
}

// ─── Task notes ──────────────────────────────────────────────────────────────

export function taskNotesKey(projectId: number, taskId: number) {
  return ["notes", "task", projectId, taskId] as const;
}

export function useTaskNotes(projectId: number, taskId: number) {
  return useQuery({
    queryKey: taskNotesKey(projectId, taskId),
    queryFn: () => apiFetch<Note[]>(`/api/projects/${projectId}/tasks/${taskId}/notes`),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateTaskNote(projectId: number, taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiFetch<Note>(`/api/projects/${projectId}/tasks/${taskId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskNotesKey(projectId, taskId) }),
  });
}

// ─── Edit / Delete (shared) ───────────────────────────────────────────────────

export function useUpdateNote(invalidateKey: readonly unknown[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) =>
      apiFetch<Note>(`/api/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  });
}

export function useDeleteNote(invalidateKey: readonly unknown[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      apiFetch<void>(`/api/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: invalidateKey }),
  });
}

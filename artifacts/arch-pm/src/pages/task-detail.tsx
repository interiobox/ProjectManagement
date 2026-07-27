import { useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import {
  useGetTask,
  useUpdateTask,
  useGetFileHistory,
  getGetTaskQueryKey,
  getGetFileHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Paperclip, Clock, Save, File, History, UploadCloud,
  Download, Loader2, AlertCircle, X, Image, Film, FileText,
  FileSpreadsheet, Presentation, Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { NotesSection } from "@/components/notes-section";
import { useTaskNotes, useCreateTaskNote, taskNotesKey } from "@/hooks/use-notes";
import { cn } from "@/lib/utils";

// ── File type helpers ─────────────────────────────────────────────────────────

const ACCEPT_ALL = [
  "image/*", "video/*", "audio/*",
  "application/pdf",
  ".dwg", ".dxf", ".rvt", ".ifc", ".skp",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip", ".rar", ".7z",
].join(",");

function fileIcon(mimeType: string | undefined, name: string) {
  const mime = mimeType ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return <Image className="w-5 h-5" />;
  if (mime.startsWith("video/")) return <Film className="w-5 h-5" />;
  if (mime === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (["ppt", "pptx"].includes(ext)) return <Presentation className="w-5 h-5 text-orange-500" />;
  if (["dwg", "dxf", "rvt", "ifc", "skp"].includes(ext)) return <Wrench className="w-5 h-5 text-primary" />;
  return <File className="w-5 h-5" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ── Upload area component ─────────────────────────────────────────────────────

interface UploadAreaProps {
  projectId: number;
  taskId: number;
  onSuccess: () => void;
}

function UploadArea({ projectId, taskId, onSuccess }: UploadAreaProps) {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<{ name: string; progress: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const token = localStorage.getItem("arch_token");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${base}/api/projects/${projectId}/tasks/${taskId}/files`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? "Upload failed");
    }
    return res.json();
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setUploading(true);
    setQueue(arr.map(f => ({ name: f.name, progress: 0 })));

    let anyError = false;
    for (let i = 0; i < arr.length; i++) {
      try {
        await uploadFile(arr[i]);
        setQueue(q => q.map((item, idx) => idx === i ? { ...item, progress: 100 } : item));
      } catch (e: any) {
        anyError = true;
        toast({ title: `Failed: ${arr[i].name}`, description: e.message, variant: "destructive" });
      }
    }

    setUploading(false);
    setQueue([]);
    if (!anyError) {
      toast({ title: arr.length === 1 ? "File uploaded" : `${arr.length} files uploaded` });
    }
    onSuccess();
  }, [projectId, taskId, onSuccess]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="p-3">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30",
          uploading && "pointer-events-none opacity-60"
        )}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ALL}
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          data-testid="input-file-upload"
        />
        <UploadCloud className={cn("w-8 h-8 mx-auto mb-2 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-bold text-foreground">
          {dragging ? "Drop to upload" : "Click or drag files here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Photos · Videos · PDFs · DWG · PPTX · XLSX · Word · ZIP — up to 200 MB each
        </p>
      </div>

      {/* Upload progress list */}
      {queue.length > 0 && (
        <div className="mt-3 space-y-2">
          {queue.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span className="truncate flex-1 font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {item.progress === 100 ? "done" : "uploading…"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TaskDetail() {
  const { id, taskId: taskIdStr } = useParams<{ id: string; taskId: string }>();
  const projectId = Number(id);
  const taskId = Number(taskIdStr);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useGetTask(projectId, taskId, {
    query: { enabled: !!projectId && !!taskId, queryKey: getGetTaskQueryKey(projectId, taskId) },
  });

  const updateMutation = useUpdateTask();
  const { data: notes, isLoading: loadingNotes } = useTaskNotes(projectId, taskId);
  const createNote = useCreateTaskNote(projectId, taskId);

  const [descEdit, setDescEdit] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [historyFileId, setHistoryFileId] = useState<number | null>(null);

  const { data: fileHistory, isLoading: loadingHistory } = useGetFileHistory(
    projectId, taskId, historyFileId || 0,
    { query: { enabled: !!historyFileId, queryKey: getGetFileHistoryQueryKey(projectId, taskId, historyFileId || 0) } }
  );

  const refreshTask = () => queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(projectId, taskId) });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { status: e.target.value as any } },
      { onSuccess: () => { refreshTask(); toast({ title: "Status updated" }); } }
    );
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { priority: e.target.value as any } },
      { onSuccess: () => { refreshTask(); toast({ title: "Priority updated" }); } }
    );
  };

  const saveDescription = () => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { description: descValue } },
      { onSuccess: () => { refreshTask(); setDescEdit(false); toast({ title: "Description saved" }); } }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!task) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card sticky top-0 z-10 p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full">
            <Link href={`/projects/${projectId}`} className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Project
            </Link>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {task.categoryName && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded border border-border">
                      {task.categoryName}
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">TASK-{task.id}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">{task.title}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Created {format(new Date(task.createdAt), "MMM d, yyyy")}
                  </div>
                  {task.createdByName && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">
                        {task.createdByName.charAt(0)}
                      </div>
                      By {task.createdByName}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 bg-secondary/30 p-2 rounded-lg border border-border/50 shrink-0">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Status</label>
                  <select
                    value={task.status}
                    onChange={handleStatusChange}
                    disabled={updateMutation.isPending}
                    className="bg-card border border-border text-sm font-bold px-3 py-2 rounded outline-none focus:border-primary w-[140px] appearance-none"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Priority</label>
                  <select
                    value={task.priority || "medium"}
                    onChange={handlePriorityChange}
                    disabled={updateMutation.isPending}
                    className="bg-card border border-border text-sm font-bold px-3 py-2 rounded outline-none focus:border-primary w-[110px] appearance-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/10">
          <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/50 border-b border-border p-3 px-5 flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider">Description</h3>
                  {!descEdit && (
                    <button
                      onClick={() => { setDescValue(task.description || ""); setDescEdit(true); }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {descEdit ? (
                    <div className="space-y-3">
                      <textarea
                        value={descValue}
                        onChange={e => setDescValue(e.target.value)}
                        className="w-full min-h-[150px] p-3 bg-background border-2 border-border rounded focus:border-primary outline-none text-sm leading-relaxed font-medium resize-none"
                        placeholder="Add task details..."
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setDescEdit(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary rounded transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={saveDescription}
                          disabled={updateMutation.isPending}
                          className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-foreground leading-relaxed font-medium whitespace-pre-wrap min-h-[80px]">
                      {task.description
                        ? task.description
                        : <span className="text-muted-foreground italic">No description yet. Click Edit to add one.</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <NotesSection
                notes={notes}
                isLoading={loadingNotes}
                onPost={content => createNote.mutate(content)}
                isPosting={createNote.isPending}
                invalidateKey={taskNotesKey(projectId, taskId)}
                title="Notes & Comments"
                placeholder="Leave a note, question, or update..."
              />
            </div>

            {/* Right column — Files */}
            <div className="space-y-6">
              <div className="bg-card border-2 border-border rounded-lg flex flex-col">
                <div className="bg-secondary/50 border-b border-border p-3 px-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-bold text-sm uppercase tracking-wider flex-1">Files</h3>
                  <span className="bg-background border border-border px-1.5 rounded text-[10px] font-mono">
                    {task.files?.length || 0}
                  </span>
                </div>

                {/* Upload area */}
                <UploadArea projectId={projectId} taskId={taskId} onSuccess={refreshTask} />

                {/* File list */}
                {task.files && task.files.length > 0 && (
                  <div className="border-t border-border divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                    {task.files.map(file => (
                      <div key={file.id} className="group flex items-start gap-3 p-3 hover:bg-secondary/30 transition-colors">
                        <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          {fileIcon(file.mimeType ?? undefined, file.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-bold text-sm truncate leading-tight" title={file.name}>
                              {file.name}
                            </p>
                            <span className="shrink-0 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ml-1">
                              v{file.version}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] font-mono text-muted-foreground">
                            <span>{formatBytes(file.size)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Uploaded by{" "}
                              <span className="font-semibold text-foreground">
                                {file.uploadedByName || "Unknown user"}
                              </span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span title={format(new Date(file.createdAt), "PPpp")}>
                              {format(new Date(file.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={file.url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                            {file.version > 1 && (
                              <button
                                onClick={() => setHistoryFileId(file.id)}
                                className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                              >
                                <History className="w-3 h-3" /> History
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!task.files?.length && (
                  <div className="text-center py-6 px-4 text-muted-foreground border-t border-border">
                    <p className="text-xs font-mono">No files yet. Upload one above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version history drawer */}
      <Drawer open={!!historyFileId} onOpenChange={open => !open && setHistoryFileId(null)}>
        <DrawerContent className="border-t-2 border-border max-h-[85vh]">
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle className="text-xl">Version History</DrawerTitle>
              <DrawerDescription className="font-mono text-xs">All uploaded versions of this file.</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : fileHistory && fileHistory.length > 0 ? (
                fileHistory.sort((a, b) => b.version - a.version).map(v => (
                  <div key={v.id} className="flex items-center gap-3 bg-secondary/30 border border-border rounded-lg p-3">
                    <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm shrink-0">
                      v{v.version}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{v.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}
                        {v.uploadedByName ? ` · ${v.uploadedByName}` : ""}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">{formatBytes(v.size)}</p>
                    </div>
                    <a href={v.url || "#"} target="_blank" rel="noreferrer" className="text-primary hover:text-primary/80 shrink-0" title="Download">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No history found.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <DrawerClose asChild>
                <button className="w-full bg-secondary text-secondary-foreground font-bold py-3 rounded hover:bg-secondary/80 transition-colors">
                  Close
                </button>
              </DrawerClose>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </AppLayout>
  );
}

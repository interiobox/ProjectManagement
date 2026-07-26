import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { 
  useGetTask, 
  useUpdateTask,
  useUploadFile,
  useGetFileHistory,
  getGetTaskQueryKey,
  getGetFileHistoryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Paperclip, Clock, Save, File, History, UploadCloud, Download, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const uploadSchema = z.object({
  name: z.string().min(1, "File name is required"),
});

export default function TaskDetail() {
  const { id, taskId: taskIdStr } = useParams<{ id: string; taskId: string }>();
  const projectId = Number(id);
  const taskId = Number(taskIdStr);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useGetTask(projectId, taskId, {
    query: { enabled: !!projectId && !!taskId, queryKey: getGetTaskQueryKey(projectId, taskId) }
  });

  const updateMutation = useUpdateTask();
  const uploadMutation = useUploadFile();
  
  const [descEdit, setDescEdit] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [historyFileId, setHistoryFileId] = useState<number | null>(null);

  const { data: fileHistory, isLoading: loadingHistory } = useGetFileHistory(projectId, taskId, historyFileId || 0, {
    query: { enabled: !!historyFileId, queryKey: getGetFileHistoryQueryKey(projectId, taskId, historyFileId || 0) }
  });

  const uploadForm = useForm<{ name: string }>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { name: "" }
  });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { status: e.target.value as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(projectId, taskId) });
          toast({ title: "Status updated" });
        }
      }
    );
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { priority: e.target.value as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(projectId, taskId) });
          toast({ title: "Priority updated" });
        }
      }
    );
  };

  const saveDescription = () => {
    updateMutation.mutate(
      { projectId, id: taskId, data: { description: descValue } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(projectId, taskId) });
          setDescEdit(false);
          toast({ title: "Description saved" });
        }
      }
    );
  };

  const onUpload = (data: { name: string }) => {
    // Generate a fake url based on name for demo purposes
    const ext = data.name.includes('.') ? '' : '.pdf';
    const filename = `${data.name}${ext}`;
    const fakeUrl = `https://storage.archfirm.local/projects/${projectId}/tasks/${taskId}/${encodeURIComponent(filename)}`;
    
    uploadMutation.mutate(
      {
        projectId,
        taskId,
        data: {
          name: filename,
          mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          size: Math.floor(Math.random() * 5000000) + 100000, // random size 100KB - 5MB
          url: fakeUrl
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(projectId, taskId) });
          setIsUploadOpen(false);
          uploadForm.reset();
          toast({ title: "File uploaded successfully" });
        },
        onError: (err: any) => {
          toast({ title: "Upload failed", description: err.data?.error || "An error occurred", variant: "destructive" });
        }
      }
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
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-2">
                  {task.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Created {format(new Date(task.createdAt), "MMM d, yyyy")}
                  </div>
                  {task.createdByName && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
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

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/10">
          <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
                <div className="bg-secondary/50 border-b border-border p-3 px-5 flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider">Description</h3>
                  {!descEdit && (
                    <button 
                      onClick={() => {
                        setDescValue(task.description || "");
                        setDescEdit(true);
                      }}
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
                        onChange={(e) => setDescValue(e.target.value)}
                        className="w-full min-h-[150px] p-3 bg-background border-2 border-border rounded focus:border-primary outline-none text-sm leading-relaxed font-medium"
                        placeholder="Add task details..."
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setDescEdit(false)}
                          className="px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-secondary rounded transition-colors"
                        >
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
                    <div className="text-foreground leading-relaxed font-medium whitespace-pre-wrap min-h-[100px]">
                      {task.description ? task.description : <span className="text-muted-foreground italic">No description provided.</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Files */}
            <div className="space-y-6">
              <div className="bg-card border-2 border-border rounded-lg flex flex-col">
                <div className="bg-secondary/50 border-b border-border p-3 px-4 flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> Files
                    <span className="bg-background border border-border px-1.5 rounded text-[10px]">{task.files?.length || 0}</span>
                  </h3>
                  
                  <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                      <button className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 flex items-center gap-1">
                        <UploadCloud className="w-3.5 h-3.5" /> Upload
                      </button>
                    </DialogTrigger>
                    <DialogContent className="border-2 border-border sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Upload File</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={uploadForm.handleSubmit(onUpload)} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">File Name</label>
                          <input 
                            {...uploadForm.register("name")} 
                            className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary" 
                            placeholder="e.g. site-plan-v2.pdf" 
                          />
                          {uploadForm.formState.errors.name && <p className="text-sm text-destructive">{uploadForm.formState.errors.name.message}</p>}
                        </div>
                        <div className="bg-secondary/50 border border-dashed border-border rounded-lg p-6 text-center">
                          <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium">In this demo, enter a name to simulate an upload.</p>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">If name matches existing, version increments.</p>
                        </div>
                        <button type="submit" disabled={uploadMutation.isPending} className="w-full bg-primary text-primary-foreground font-bold p-3 rounded mt-2 flex justify-center">
                          {uploadMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload Document"}
                        </button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
                  {task.files && task.files.length > 0 ? (
                    task.files.map(file => (
                      <div key={file.id} className="group flex items-start gap-3 p-3 rounded hover:bg-secondary/50 border border-transparent hover:border-border transition-colors">
                        <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          <File className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold text-sm truncate" title={file.name}>{file.name}</p>
                            <span className="shrink-0 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">
                              v{file.version}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-muted-foreground">
                            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <span>•</span>
                            <span>{format(new Date(file.createdAt), "MMM d")}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={file.url || "#"} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                              <Download className="w-3 h-3" /> Download
                            </a>
                            {file.version > 1 && (
                              <button 
                                onClick={() => setHistoryFileId(file.id)}
                                className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:text-foreground"
                              >
                                <History className="w-3 h-3" /> History
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 px-4">
                      <div className="w-12 h-12 rounded-full bg-secondary text-muted-foreground flex items-center justify-center mx-auto mb-3">
                        <Paperclip className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold">No files attached</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload blueprints or specs.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      <Drawer open={!!historyFileId} onOpenChange={(open) => !open && setHistoryFileId(null)}>
        <DrawerContent className="border-t-2 border-border max-h-[85vh]">
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle className="text-xl">Version History</DrawerTitle>
              <DrawerDescription className="font-mono">Previous versions of this document.</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : fileHistory && fileHistory.length > 0 ? (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {fileHistory.sort((a, b) => b.version - a.version).map((v) => (
                    <div key={v.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-accent text-accent-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold text-sm z-10">
                        v{v.version}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card border-2 border-border p-4 rounded-lg shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold text-sm text-foreground">{v.name}</div>
                          <a href={v.url || "#"} className="text-primary hover:text-primary/80" title="Download">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground mt-2">
                          {format(new Date(v.createdAt), "MMM d, yyyy HH:mm")}
                        </div>
                        {v.uploadedByName && (
                          <div className="text-xs text-muted-foreground mt-1">
                            By {v.uploadedByName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p>No history found for this file.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border mt-auto">
              <DrawerClose asChild>
                <button className="w-full bg-secondary text-secondary-foreground font-bold py-3 rounded">Close</button>
              </DrawerClose>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </AppLayout>
  );
}

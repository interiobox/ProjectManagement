import { useState } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { 
  useGetProject, 
  useListTasks, 
  useCreateCategory, 
  useCreateTask,
  getGetProjectQueryKey,
  getListTasksQueryKey,
  useUpdateTask,
  useDeleteTask
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ArrowLeft, MoreVertical, Calendar, Clock, FileText, CheckCircle2, ChevronRight, MessageSquare, Trash2, Edit } from "lucide-react";
import { NotesSection } from "@/components/notes-section";
import { useProjectNotes, useCreateProjectNote, projectNotesKey } from "@/hooks/use-notes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AssigneePicker } from "@/components/assignee-picker";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo"),
  categoryId: z.coerce.number().optional(),
  assigneeIds: z.array(z.number()).default([]),
});

type TaskForm = z.infer<typeof taskSchema>;

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
});

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: loadingProject } = useGetProject(projectId, { 
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } 
  });
  
  const { data: tasks, isLoading: loadingTasks } = useListTasks(projectId, {
    query: { enabled: !!projectId, queryKey: getListTasksQueryKey(projectId) }
  });

  const createTaskMutation = useCreateTask();
  const createCategoryMutation = useCreateCategory();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  const { data: notes, isLoading: loadingNotes } = useProjectNotes(projectId);
  const createNote = useCreateProjectNote(projectId);

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium", status: "todo", assigneeIds: [] }
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { color: "#0d3b66" }
  });

  const onTaskSubmit = (data: TaskForm) => {
    createTaskMutation.mutate(
      { projectId, data: { ...data, assigneeIds: data.assigneeIds?.length ? data.assigneeIds : undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setIsTaskDialogOpen(false);
          taskForm.reset();
          toast({ title: "Task created" });
        },
        onError: (err: any) => toast({ title: "Error", description: err.data?.error || "An error occurred", variant: "destructive" })
      }
    );
  };

  const onCategorySubmit = (data: z.infer<typeof categorySchema>) => {
    createCategoryMutation.mutate(
      { projectId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setIsCategoryDialogOpen(false);
          categoryForm.reset();
          toast({ title: "Category created" });
        },
        onError: (err: any) => toast({ title: "Error", description: err.data?.error || "An error occurred", variant: "destructive" })
      }
    );
  };

  const handleUpdateTaskStatus = (taskId: number, newStatus: any) => {
    updateTaskMutation.mutate(
      { projectId, id: taskId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
        }
      }
    );
  };

  const handleDeleteTask = (taskId: number) => {
    if(confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(
        { projectId, id: taskId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
            toast({ title: "Task deleted" });
          }
        }
      )
    }
  }

  if (loadingProject || loadingTasks) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!project) return null;

  const categories = project.categories || [];
  const groupedTasks: Record<string, typeof tasks> = { "Uncategorized": [] };
  
  categories.forEach(c => { groupedTasks[c.name] = []; });
  
  tasks?.forEach(task => {
    if (task.categoryId && task.categoryName) {
      if (!groupedTasks[task.categoryName]) groupedTasks[task.categoryName] = [];
      groupedTasks[task.categoryName]!.push(task);
    } else {
      groupedTasks["Uncategorized"]!.push(task);
    }
  });

  const statusColors: Record<string, string> = {
    todo: "bg-muted text-muted-foreground",
    in_progress: "bg-primary/20 text-primary",
    review: "bg-accent/20 text-accent",
    done: "bg-green-500/20 text-green-700"
  };

  const priorityColors: Record<string, string> = {
    low: "text-muted-foreground",
    medium: "text-primary",
    high: "text-accent",
    urgent: "text-destructive font-bold"
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-secondary/30">
        <div className="bg-card border-b border-border p-4 md:p-6 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto w-full">
            <Link href="/projects" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
            </Link>
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                  <span className="px-2.5 py-1 rounded bg-secondary font-mono text-xs font-bold uppercase tracking-wider">
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                {project.description && (
                  <p className="text-muted-foreground max-w-3xl leading-relaxed">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold px-4 py-2.5 rounded flex items-center gap-2 text-sm transition-colors">
                      <Plus className="w-4 h-4" /> Category
                    </button>
                  </DialogTrigger>
                  <DialogContent className="border-2 border-border p-6 rounded-lg sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>New Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Category Name</label>
                        <input {...categoryForm.register("name")} className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary" placeholder="e.g. Architectural Docs" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Color (Hex)</label>
                        <div className="flex gap-2">
                          <input type="color" {...categoryForm.register("color")} className="w-12 h-12 p-1 bg-background border-2 border-border rounded cursor-pointer" />
                          <input type="text" {...categoryForm.register("color")} className="flex-1 bg-background border-2 border-border p-3 rounded outline-none focus:border-primary font-mono uppercase" />
                        </div>
                      </div>
                      <button type="submit" disabled={createCategoryMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold p-3 rounded mt-2">
                        {createCategoryMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Add Category"}
                      </button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded flex items-center gap-2 text-sm transition-colors">
                      <Plus className="w-4 h-4" /> Task
                    </button>
                  </DialogTrigger>
                  <DialogContent className="border-2 border-border p-6 rounded-lg sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>New Task</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                        <input {...taskForm.register("title")} className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary" placeholder="Task title..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                        <textarea {...taskForm.register("description")} className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary min-h-[80px]" placeholder="Details..." />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Category</label>
                          <select {...taskForm.register("categoryId")} className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary">
                            <option value="">None</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Priority</label>
                          <select {...taskForm.register("priority")} className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <AssigneePicker
                        value={taskForm.watch("assigneeIds") ?? []}
                        onChange={assigneeIds => taskForm.setValue("assigneeIds", assigneeIds)}
                        disabled={createTaskMutation.isPending}
                      />
                      <button type="submit" disabled={createTaskMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold p-3 rounded mt-4">
                        {createTaskMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Task"}
                      </button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-8 pb-10">
            {Object.entries(groupedTasks).map(([catName, catTasks]) => {
              if (catName === "Uncategorized" && catTasks?.length === 0 && categories.length > 0) return null;
              const catObj = categories.find(c => c.name === catName);
              return (
                <div key={catName} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    {catObj?.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catObj.color }} />}
                    <h2 className="text-lg font-bold tracking-tight">{catName}</h2>
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded ml-2">{catTasks?.length || 0}</span>
                  </div>
                  
                  {catTasks?.length === 0 ? (
                    <div className="bg-card border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                      <p className="font-mono text-sm">No tasks in this category.</p>
                      <button 
                        onClick={() => {
                          taskForm.setValue("categoryId", catObj?.id || undefined);
                          setIsTaskDialogOpen(true);
                        }}
                        className="text-primary font-bold mt-2 hover:underline text-sm"
                      >
                        Add one now
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catTasks?.map(task => (
                        <div key={task.id} className="bg-card border-2 border-border rounded-lg p-4 flex flex-col group hover-elevate transition-all">
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <Link href={`/projects/${projectId}/tasks/${task.id}`} className="font-bold text-base leading-tight hover:text-primary transition-colors flex-1 line-clamp-2">
                              {task.title}
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5 p-1 -mr-1">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 font-medium border-2 border-border rounded-lg shadow-xl">
                                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => handleUpdateTaskStatus(task.id, "todo")}>Set Todo</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => handleUpdateTaskStatus(task.id, "in_progress")}>Set In Progress</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => handleUpdateTaskStatus(task.id, "review")}>Set Review</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer font-bold" onClick={() => handleUpdateTaskStatus(task.id, "done")}>Set Done</DropdownMenuItem>
                                <div className="h-px bg-border my-1" />
                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer font-bold" onClick={() => handleDeleteTask(task.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                           <div className="flex flex-wrap gap-2 mb-4">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${statusColors[task.status] || "bg-secondary text-secondary-foreground"}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-border bg-background ${priorityColors[task.priority || "medium"]}`}>
                              {task.priority}
                            </span>
                          </div>

                           {task.assignees && task.assignees.length > 0 && (
                             <div className="flex items-start gap-2 mb-4 text-xs text-muted-foreground">
                               <span className="font-bold shrink-0">Assigned:</span>
                               <span className="flex flex-wrap gap-1">
                                 {task.assignees.map(assignee => (
                                   <span key={assignee.id} className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">
                                     {assignee.name}
                                   </span>
                                 ))}
                               </span>
                             </div>
                           )}

                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50 text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-3">
                              {task.fileCount ? (
                                <div className="flex items-center gap-1">
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{task.fileCount}</span>
                                </div>
                              ) : null}
                            </div>
                            <Link href={`/projects/${projectId}/tasks/${task.id}`} className="text-primary font-bold flex items-center group-hover:underline">
                              Open <ChevronRight className="w-3 h-3 ml-0.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Project-level Notes */}
            <NotesSection
              notes={notes}
              isLoading={loadingNotes}
              onPost={(content) => createNote.mutate(content)}
              isPosting={createNote.isPending}
              invalidateKey={projectNotesKey(projectId)}
              title="Project Notes"
              placeholder="Add a project-level note or comment..."
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

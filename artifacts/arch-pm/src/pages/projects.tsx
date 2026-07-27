import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout";
import {
  useListProjects,
  useCreateProject,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  CheckSquare,
  FileText,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "on_hold", "completed", "archived"]).default("active"),
});

type ProjectForm = z.infer<typeof projectSchema>;

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-500/10 text-green-700 border-green-500/20" },
  on_hold: { label: "On Hold", className: "bg-accent/10 text-accent border-accent/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground border-border" },
};

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { status: "active" },
  });

  const onSubmit = (data: ProjectForm) => {
    createProject.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setIsOpen(false);
          form.reset();
          toast({ title: "Project created" });
        },
        onError: (err: any) =>
          toast({
            title: "Error",
            description: err.data?.error ?? "An error occurred",
            variant: "destructive",
          }),
      }
    );
  };

  const filtered = projects?.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-primary" />
              Projects
            </h1>
            <p className="text-muted-foreground font-mono mt-1">
              {projects?.length ?? 0} total project{projects?.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-3 rounded flex items-center gap-2 transition-colors"
                data-testid="button-new-project"
              >
                <Plus className="w-5 h-5" /> New Project
              </button>
            </DialogTrigger>
            <DialogContent className="border-2 border-border p-6 sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Project Name
                  </label>
                  <input
                    {...form.register("name")}
                    className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary transition-colors"
                    placeholder="e.g. Meridian Tower Phase 2"
                    data-testid="input-project-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive font-bold">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    {...form.register("description")}
                    className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary transition-colors min-h-[80px] resize-none"
                    placeholder="Project scope and objectives..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </label>
                  <select
                    {...form.register("status")}
                    className="w-full bg-background border-2 border-border p-3 rounded outline-none focus:border-primary appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={createProject.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold p-3 rounded mt-2 flex justify-center items-center gap-2 transition-colors"
                  data-testid="button-submit-project"
                >
                  {createProject.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Create Project"
                  )}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-card border-2 border-border pl-9 pr-4 py-2.5 rounded outline-none focus:border-primary text-sm transition-colors"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "active", "on_hold", "completed", "archived"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors border-2",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Project list */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered?.length === 0 ? (
          <div className="bg-card border-2 border-dashed border-border rounded-lg py-20 text-center">
            <FolderKanban className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-bold text-muted-foreground">No projects found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "Create your first project to get started."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered?.map((project) => {
              const sc = statusConfig[project.status] ?? statusConfig.active;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group bg-card border-2 border-border rounded-lg p-5 flex flex-col hover:border-primary/50 transition-all hover:shadow-md"
                  data-testid={`project-card-${project.id}`}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors flex-1">
                      {project.name}
                    </h2>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                        sc.className
                      )}
                    >
                      {sc.label}
                    </span>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-auto pt-3 border-t border-border/50 text-xs text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{(project as any).taskCount ?? 0} tasks</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{(project as any).fileCount ?? 0} files</span>
                    </div>
                    {project.createdAt && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Calendar className="w-3 h-3" />
                        <span className="font-mono text-[10px]">
                          {format(new Date(project.createdAt), "MMM d, yy")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-end mt-3">
                    <span className="text-xs font-bold text-primary flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                      Open project <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

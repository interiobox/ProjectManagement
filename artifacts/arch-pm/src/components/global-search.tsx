import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  FolderKanban,
  Loader2,
  Search,
  CheckSquare,
} from "lucide-react";
import {
  listTasks,
  useListProjects,
  type Project,
  type Task,
} from "@workspace/api-client-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";

type ProjectSearchResult = Project & { resultType: "project" };
type TaskSearchResult = Task & {
  resultType: "task";
  projectName: string;
};

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const { data: projects = [] } = useListProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskSearchResult[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || projects.length === 0) return;

    let cancelled = false;
    setLoadingTasks(true);

    Promise.all(
      projects.map(async (project) => {
        const projectTasks = await listTasks(project.id);
        return projectTasks.map((task) => ({
          ...task,
          projectName: project.name,
          resultType: "task" as const,
        }));
      }),
    )
      .then((results) => {
        if (!cancelled) setTasks(results.flat());
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projects]);

  const projectResults = useMemo<ProjectSearchResult[]>(
    () => projects.map((project) => ({ ...project, resultType: "project" })),
    [projects],
  );

  const closeAndNavigate = (path: string) => {
    setOpen(false);
    setQuery("");
    setLocation(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-md items-center gap-3 rounded-md border border-border bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        data-testid="button-global-search"
        aria-label="Search projects and tasks"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Search projects and tasks...</span>
        <CommandShortcut className="hidden border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
          ⌘K
        </CommandShortcut>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Search workspace</DialogTitle>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search projects and tasks..."
          autoFocus
        />
        <CommandList>
          <CommandEmpty>
            {loadingTasks
              ? "Loading workspace..."
              : "No matching projects or tasks."}
          </CommandEmpty>

          {projectResults.length > 0 && (
            <CommandGroup heading="Projects">
              {projectResults.map((project) => (
                <CommandItem
                  key={`project-${project.id}`}
                  value={`project ${project.name} ${project.description ?? ""}`}
                  onSelect={() => closeAndNavigate(`/projects/${project.id}`)}
                >
                  <FolderKanban className="text-primary" />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {project.status.replace("_", " ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {tasks.map((task) => (
                <CommandItem
                  key={`task-${task.projectId}-${task.id}`}
                  value={`task ${task.title} ${task.description ?? ""} ${task.projectName}`}
                  onSelect={() =>
                    closeAndNavigate(
                      `/projects/${task.projectId}/tasks/${task.id}`,
                    )
                  }
                >
                  <CheckSquare className="text-accent" />
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="max-w-36 truncate text-xs text-muted-foreground">
                    {task.projectName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {loadingTasks && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tasks
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
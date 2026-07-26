import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { FolderKanban, CheckSquare, Files, Users, Activity, Loader2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity();

  if (loadingSummary || loadingActivity) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Dashboard</h1>
          <p className="text-muted-foreground font-mono">System overview and recent activity.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-card border-2 border-border p-5 rounded-lg flex flex-col justify-between hover-elevate">
            <div className="flex items-center justify-between mb-4 text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-xs">Projects</span>
              <FolderKanban className="w-5 h-5 text-primary" />
            </div>
            <div className="text-4xl font-bold text-foreground" data-testid="text-total-projects">
              {summary?.totalProjects || 0}
            </div>
          </div>
          
          <div className="bg-card border-2 border-border p-5 rounded-lg flex flex-col justify-between hover-elevate">
            <div className="flex items-center justify-between mb-4 text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-xs">Tasks</span>
              <CheckSquare className="w-5 h-5 text-accent" />
            </div>
            <div className="text-4xl font-bold text-foreground" data-testid="text-total-tasks">
              {summary?.totalTasks || 0}
            </div>
          </div>

          <div className="bg-card border-2 border-border p-5 rounded-lg flex flex-col justify-between hover-elevate">
            <div className="flex items-center justify-between mb-4 text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-xs">Files</span>
              <Files className="w-5 h-5 text-chart-3" />
            </div>
            <div className="text-4xl font-bold text-foreground" data-testid="text-total-files">
              {summary?.totalFiles || 0}
            </div>
          </div>

          <div className="bg-card border-2 border-border p-5 rounded-lg flex flex-col justify-between hover-elevate">
            <div className="flex items-center justify-between mb-4 text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-xs">Team</span>
              <Users className="w-5 h-5 text-chart-4" />
            </div>
            <div className="text-4xl font-bold text-foreground" data-testid="text-total-users">
              {summary?.totalUsers || 0}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Status Breakdowns */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border-2 border-border rounded-lg p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Task Status</h2>
              <div className="space-y-4">
                {[
                  { label: "To Do", count: summary?.tasksByStatus.todo || 0, color: "bg-muted" },
                  { label: "In Progress", count: summary?.tasksByStatus.in_progress || 0, color: "bg-primary" },
                  { label: "Review", count: summary?.tasksByStatus.review || 0, color: "bg-accent" },
                  { label: "Done", count: summary?.tasksByStatus.done || 0, color: "bg-green-500" },
                ].map(status => {
                  const total = summary?.totalTasks || 1;
                  const percentage = Math.round((status.count / total) * 100) || 0;
                  return (
                    <div key={status.label}>
                      <div className="flex justify-between text-sm font-bold mb-1">
                        <span>{status.label}</span>
                        <span>{status.count}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${status.color}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-card border-2 border-border rounded-lg p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Project Status</h2>
              <div className="space-y-4">
                {[
                  { label: "Active", count: summary?.projectsByStatus.active || 0 },
                  { label: "On Hold", count: summary?.projectsByStatus.on_hold || 0 },
                  { label: "Completed", count: summary?.projectsByStatus.completed || 0 },
                ].map(status => (
                  <div key={status.label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="font-medium text-sm">{status.label}</span>
                    <span className="font-mono bg-secondary px-2 py-1 rounded text-xs">{status.count}</span>
                  </div>
                ))}
              </div>
              <Link href="/projects" className="mt-6 flex items-center justify-center w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold py-3 rounded text-sm transition-colors" data-testid="link-view-all-projects">
                View All Projects
              </Link>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <div className="bg-card border-2 border-border rounded-lg p-6 h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Activity
                </h2>
              </div>
              
              <div className="space-y-6">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((log) => (
                    <div key={log.id} className="flex gap-4 relative">
                      {/* Timeline line */}
                      <div className="absolute top-8 left-4 bottom-[-24px] w-[2px] bg-border last:hidden" />
                      
                      <div className="w-8 h-8 rounded bg-secondary flex-shrink-0 flex items-center justify-center font-bold text-xs border border-border relative z-10">
                        {log.userName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-medium">
                          <span className="font-bold">{log.userName}</span>
                          {" "}
                          <span className="text-muted-foreground">{log.action.toLowerCase()}</span>
                          {" "}
                          {log.entityType}
                          {" "}
                          <span className="font-bold text-primary">{log.entityName}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </span>
                          {log.projectName && (
                            <Link href={`/projects/${log.projectId}`} className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                              in {log.projectName} <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="font-mono text-sm">No recent activity found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

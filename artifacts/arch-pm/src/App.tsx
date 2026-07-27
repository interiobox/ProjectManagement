import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/auth';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Projects from '@/pages/projects';
import ProjectDetail from '@/pages/project-detail';
import TaskDetail from '@/pages/task-detail';
import AdminUsers from '@/pages/admin-users';
import MyFeed from '@/pages/my-feed';
import Settings from '@/pages/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/projects">
        <ProtectedRoute component={Projects} />
      </Route>
      <Route path="/projects/:id">
        <ProtectedRoute component={ProjectDetail} />
      </Route>
      <Route path="/projects/:id/tasks/:taskId">
        <ProtectedRoute component={TaskDetail} />
      </Route>
      <Route path="/feed">
        <ProtectedRoute component={MyFeed} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} adminOnly />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} adminOnly />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

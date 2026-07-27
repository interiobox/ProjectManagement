import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, FolderKanban, Rss, Users, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/global-search";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/feed", label: "My Feed", icon: Rss },
  ];

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl tracking-tight text-white hover:text-sidebar-primary transition-colors">
            <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center">
              <span className="text-white text-lg leading-none">A</span>
            </div>
            ArchPM
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                data-testid={`nav-desktop-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center font-bold">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate" data-testid="text-user-name">{user?.name}</span>
              <span className="text-xs text-sidebar-foreground/60 capitalize truncate">{user?.role}</span>
            </div>
          </div>
          {user?.role === "admin" && (
            <Link
              href="/settings"
              className="flex w-full items-center gap-3 px-3 py-2 rounded-md font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors mb-1"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          )}
          <button 
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-[100dvh] pb-[72px] md:pb-0">
        <header className="flex min-h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur md:px-8">
          <GlobalSearch />
        </header>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-card border-t border-border flex items-center justify-around px-2 z-50 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`nav-mobile-${item.label.toLowerCase()}`}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "stroke-[2.5]" : "stroke-2")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

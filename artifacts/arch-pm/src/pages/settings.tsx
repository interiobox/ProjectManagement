import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  HardDrive,
  Loader2,
  LogOut,
  ExternalLink,
} from "lucide-react";

interface DriveStatus {
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const token = localStorage.getItem("arch_token");

  // ── Fetch Drive status ─────────────────────────────────────────────────────

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/drive/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      const data: DriveStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  // ── Handle OAuth redirect results ─────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const driveResult = params.get("drive");
    const driveError = params.get("drive_error");

    if (driveResult === "connected") {
      toast({ title: "Google Drive connected", description: "Files will now upload to your Drive." });
      fetchStatus();
      setLocation("/settings", { replace: true });
    } else if (driveError) {
      toast({
        title: "Google Drive connection failed",
        description: driveError,
        variant: "destructive",
      });
      setLocation("/settings", { replace: true });
    }
  }, [location]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Drive? Future uploads will be stored locally.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${base}/api/drive/disconnect`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast({ title: "Google Drive disconnected" });
      setStatus({ connected: false });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Connect ────────────────────────────────────────────────────────────────

  function handleConnect() {
    if (!token) return;
    window.location.href = `${base}/api/drive/auth?token=${encodeURIComponent(token)}`;
  }

  const isAdmin = user?.role === "admin";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage integrations and workspace configuration.
          </p>
        </div>

        {/* Google Drive Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-4">
            {/* Drive icon */}
            <div className="shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-foreground">Google Drive</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Upload files directly to your Google Drive, organised by{" "}
                <span className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">
                  ArchPM / Project / Task
                </span>
                .
              </p>
            </div>
          </div>

          {/* Status */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking connection…
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Connected
                {status.email && (
                  <span className="text-muted-foreground font-normal">
                    — {status.email}
                  </span>
                )}
              </div>

              {status.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  Connected{" "}
                  {new Date(status.connectedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Open Drive <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {isAdmin && (
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="w-4 h-4 shrink-0" />
                Not connected — files are stored locally on the server.
              </div>

              {isAdmin ? (
                <div className="space-y-3">
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <HardDrive className="w-4 h-4" />
                    Connect Google Drive
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Requires{" "}
                    <code className="bg-secondary px-1 py-0.5 rounded text-[11px]">
                      GOOGLE_CLIENT_ID
                    </code>{" "}
                    and{" "}
                    <code className="bg-secondary px-1 py-0.5 rounded text-[11px]">
                      GOOGLE_CLIENT_SECRET
                    </code>{" "}
                    to be configured on the server.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ask an admin to connect Google Drive.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Self-hosting note */}
        <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Self-hosting setup</p>
          <p>
            Create a Google Cloud project, enable the Drive API, and add an OAuth 2.0 credential.
            Set the authorised redirect URI to{" "}
            <code className="bg-background px-1 py-0.5 rounded">
              https://your-server.com/api/drive/callback
            </code>
            . Then set <code className="bg-background px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="bg-background px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code>, and{" "}
            <code className="bg-background px-1 py-0.5 rounded">GOOGLE_REDIRECT_URI</code> on your server.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

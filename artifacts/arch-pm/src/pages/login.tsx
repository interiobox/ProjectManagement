import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@archfirm.com",
      password: "admin123",
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({
            title: "Welcome back",
            description: "You have successfully signed in.",
          });
        },
        onError: (err) => {
          toast({
            title: "Login failed",
            description: err.data?.error || "Please check your credentials and try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left Branding Panel (Hidden on mobile) */}
      <div className="hidden md:flex flex-col flex-1 bg-primary text-primary-foreground p-12 justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <svg width="600" height="600" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0H600V600H0V0Z" fill="currentColor"/>
            <path d="M50 50H550V550H50V50Z" stroke="currentColor" strokeWidth="2" strokeDasharray="10 10"/>
            <path d="M100 100H500V500H100V100Z" stroke="currentColor" strokeWidth="2" strokeDasharray="10 10"/>
            <path d="M150 150H450V450H150V150Z" stroke="currentColor" strokeWidth="2"/>
            <line x1="0" y1="300" x2="600" y2="300" stroke="currentColor" strokeWidth="2"/>
            <line x1="300" y1="0" x2="300" y2="600" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        
        <div className="z-10 mt-12">
          <div className="flex items-center gap-3 font-bold text-3xl tracking-tight mb-8">
            <div className="w-10 h-10 bg-accent rounded flex items-center justify-center text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            ArchPM
          </div>
          <h1 className="text-5xl font-bold leading-tight max-w-lg mb-6">
            Command Center for Architecture
          </h1>
          <p className="text-primary-foreground/80 text-xl max-w-md font-mono">
            Track blueprints, RFIs, and site progress with precision.
          </p>
        </div>
        
        <div className="z-10 font-mono text-sm text-primary-foreground/60">
          VERSION 1.0.0 // INTERNAL SYSTEM
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="md:hidden flex items-center gap-3 font-bold text-3xl tracking-tight mb-12 text-primary">
            <div className="w-10 h-10 bg-accent rounded flex items-center justify-center text-primary-foreground">
              <Building2 className="w-6 h-6" />
            </div>
            ArchPM
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-foreground mb-2">Sign In</h2>
            <p className="text-muted-foreground font-mono text-sm">Access your secure workspace</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                {...form.register("email")}
                type="email"
                className="w-full bg-card border-2 border-border p-4 rounded-md focus:border-primary focus:ring-0 outline-none transition-colors"
                placeholder="admin@archfirm.com"
                data-testid="input-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1 font-medium">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <input
                {...form.register("password")}
                type="password"
                className="w-full bg-card border-2 border-border p-4 rounded-md focus:border-primary focus:ring-0 outline-none transition-colors"
                placeholder="••••••••"
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive mt-1 font-medium">{form.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold p-4 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
              data-testid="button-submit"
            >
              {loginMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Enter Workspace
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Default credentials:</p>
            <code className="bg-secondary px-2 py-1 rounded text-secondary-foreground">admin@archfirm.com / admin123</code>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Name is required.");
      return;
    }

    setIsSubmitting(true);
    const supabase = getSupabaseClient();

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Sign in immediately after signup (no email verification required for now)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setInfo("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }

        // Set session cookie then redirect to setup
        await fetch("/api/mock-auth/login", { method: "POST" });
        router.replace("/setup");
        router.refresh();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes("invalid")) {
            setError("Invalid email or password. Don't have an account? Switch to Sign Up above.");
          } else {
            setError(signInError.message);
          }
          return;
        }

        // Set session cookie
        await fetch("/api/mock-auth/login", { method: "POST" });
        router.replace("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Logo / brand */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-amber-950/60 border border-amber-800/40">
            <span className="text-2xl">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Octane Core</h1>
          <p className="text-sm text-zinc-500">Your portfolio operating system</p>
        </div>

        <Card className="border border-zinc-800 bg-zinc-900/70 text-zinc-100">
          <CardHeader className="pb-3">
            {/* Tab switcher */}
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-950/50 p-1 gap-1">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === "signin"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === "signup"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Create account
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400" role="status">
                  {info}
                </p>
              )}

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Logan"
                    disabled={isSubmitting}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@octane.dev"
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                />
                {mode === "signup" && (
                  <p className="text-[11px] text-zinc-600">Minimum 8 characters</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "signup" ? "Creating account…" : "Signing in…"
                  : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-zinc-600">
          Octane Core — private & secure. Your data is tied to your account.
        </p>
      </div>
    </main>
  );
}

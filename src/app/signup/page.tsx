"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase";
import { Brain, Lock, Mail, ShieldAlert, User, UserSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SignupPage() {
  const { signUp, isLoading } = useAuth();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("analyst");
  const [authError, setAuthError] = React.useState<string | null>(null);

  const isMockMode = !getSupabase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    const qName = fullName.trim();
    const qEmail = email.trim();
    const qPassword = password;

    if (!qName || !qEmail || !qPassword) {
      setAuthError("Please fill in all fields.");
      return;
    }

    try {
      await signUp(qEmail, qPassword, qName, role);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setAuthError(message);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 selection:bg-primary selection:text-primary-foreground sm:px-6 lg:px-8">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[35rem] w-[35rem] translate-x-1/2 rounded-full bg-violet-500/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-500 shadow-lg shadow-primary/20">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Join VC Brain
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Create an investor account to start tracking deals
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white">Create Account</CardTitle>
            <CardDescription className="text-slate-400">
              Register a new profile in your workspace
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isMockMode && (
              <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-300">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-semibold leading-none">Offline Development Mode</p>
                    <p className="mt-2 leading-relaxed">
                      Supabase variables are missing. Accounts created now will be simulated locally in-memory.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                <div className="relative">
                  <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Alex Rivera"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-800 bg-slate-950/50 pl-10 text-white placeholder-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@vcbrain.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-800 bg-slate-950/50 pl-10 text-white placeholder-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                    className="h-11 border-slate-800 bg-slate-950/50 pl-10 text-white placeholder-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300">Venture Role</Label>
                <div className="relative">
                  <UserSquare className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 z-10 text-slate-500" />
                  <Select value={role} onValueChange={(v) => v && setRole(v)} disabled={isLoading}>
                    <SelectTrigger className="h-11 border-slate-800 bg-slate-950/50 pl-10 text-white focus:border-primary focus:ring-1 focus:ring-primary">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="associate">Associate</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="ops">Operations</SelectItem>
                      <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {authError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                  {authError}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg shadow-primary/20 font-semibold"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col justify-center border-t border-slate-800/60 py-4 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

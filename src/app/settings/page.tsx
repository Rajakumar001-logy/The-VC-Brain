"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";

import { useAuth } from "@/components/auth-provider";

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const [emailAlerts, setEmailAlerts] = React.useState(true);
  const [weeklyDigest, setWeeklyDigest] = React.useState(true);
  const [aiSuggestions, setAiSuggestions] = React.useState(true);

  React.useEffect(() => {
    if (profile) {
      setName(profile.full_name || "");
      setTitle(profile.title || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        full_name: name,
        title,
        bio,
      });
    } catch {
      // Error notifications are handled inside updateProfile
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardShell
      title="Settings"
      description="Workspace preferences and integrations"
    >
      <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>How you appear across VC Brain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ""}
                disabled
                className="bg-muted/40 text-muted-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="title">Title / Role Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Associate, Venture Partner"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Security Role</Label>
              <Input
                id="role"
                value={profile?.role ? profile.role.toUpperCase() : ""}
                disabled
                className="bg-muted/40 text-muted-foreground font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Assigned role for authorization access control (Admin / Investor). Cannot be edited.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your investment focus..."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Theme and display preferences</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Color mode</p>
              <p className="text-xs text-muted-foreground">
                Toggle between light and dark
              </p>
            </div>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Control alerts from the research desk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Email alerts</p>
                <p className="text-xs text-muted-foreground">
                  Memo status changes and IC reminders
                </p>
              </div>
              <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Weekly digest</p>
                <p className="text-xs text-muted-foreground">
                  Pipeline summary every Monday
                </p>
              </div>
              <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">AI suggestions</p>
                <p className="text-xs text-muted-foreground">
                  Surface similar deals and risk flags
                </p>
              </div>
              <Switch checked={aiSuggestions} onCheckedChange={setAiSuggestions} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Integrations</CardTitle>
            <CardDescription>Connect data sources for ingestion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="openai">OpenAI API key</Label>
              <Input
                id="openai"
                type="password"
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supabase">Supabase project URL</Label>
              <Input
                id="supabase"
                placeholder="https://xxxx.supabase.co"
                defaultValue=""
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save settings"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-none border-red-200 dark:border-red-950 bg-red-500/5 dark:bg-red-950/10">
          <CardHeader>
            <CardTitle className="text-base text-red-600 dark:text-red-400">Danger Zone</CardTitle>
            <CardDescription>Session management and workspace exit</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign Out</p>
              <p className="text-xs text-muted-foreground">
                Log out of your current session on this device
              </p>
            </div>
            <Button type="button" variant="destructive" onClick={signOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </form>
    </DashboardShell>
  );
}

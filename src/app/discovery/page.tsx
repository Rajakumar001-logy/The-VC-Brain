"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  Play,
  Radar,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface DiscoveredFounder {
  id: string;
  full_name: string;
  email: string | null;
  source_platform: string;
  platform_profile_url: string | null;
  bio: string | null;
  skills: string[];
  calculated_score: number;
  outreach_email: string | null;
  outreach_status: string;
  created_at: string;
}

export default function DiscoveryPage() {
  // States
  const [candidates, setCandidates] = React.useState<DiscoveredFounder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scoreThreshold, setScoreThreshold] = React.useState("75");
  
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanText, setScanText] = React.useState("");
  
  const [selectedFounderId, setSelectedFounderId] = React.useState<string | null>(null);
  const [emailDraftText, setEmailDraftText] = React.useState("");
  const [sendingEmail, setSendingEmail] = React.useState(false);

  const scanSteps = [
    "Crawling GitHub trending repositories for high commits...",
    "Crawling Product Hunt for maker listings...",
    "Scanning Devpost for hackathon podium submissions...",
    "Filtering arXiv database for Transformer preprints...",
    "Retrieving accelerator cohort databases...",
    "Synthesizing ratings and drafting outreach..."
  ];

  const loadDiscovered = React.useCallback(async () => {
    try {
      const response = await api.get<DiscoveredFounder[]>("/api/v1/discovery");
      setCandidates(response);
      if (response.length > 0 && !selectedFounderId) {
        setSelectedFounderId(response[0].id);
        setEmailDraftText(response[0].outreach_email || "");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch discovery leads.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [selectedFounderId]);

  React.useEffect(() => {
    loadDiscovered();
  }, [loadDiscovered]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const thresholdNum = parseFloat(scoreThreshold) || 75.0;

    setIsScanning(true);
    setScanProgress(10);
    setScanText(scanSteps[0]);

    // Animate scanning progress steps sequentially
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= scanSteps.length) {
        clearInterval(interval);
        return;
      }
      setScanText(scanSteps[step]);
      setScanProgress((step / scanSteps.length) * 100);
    }, 1200);

    try {
      const response = await api.post<{ scanned_count: number; discovered: DiscoveredFounder[] }>(
        "/api/v1/discovery/scan",
        { threshold: thresholdNum }
      );
      clearInterval(interval);
      setScanProgress(100);
      toast.success(`Platform scan complete! Found ${response.discovered.length} candidates.`);
      
      // Reload lists
      await loadDiscovered();
      if (response.discovered.length > 0) {
        setSelectedFounderId(response.discovered[0].id);
        setEmailDraftText(response.discovered[0].outreach_email || "");
      }
    } catch (err) {
      clearInterval(interval);
      const message = err instanceof Error ? err.message : "Platform scan failed.";
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!selectedFounderId) return;
    setSendingEmail(true);

    try {
      await api.post(`/api/v1/discovery/${selectedFounderId}/outreach`, {
        status: "sent",
        email_body: emailDraftText,
      });
      toast.success("Outreach email logged as sent!");
      
      // Update local state status
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedFounderId
            ? { ...c, outreach_status: "sent", outreach_email: emailDraftText }
            : c
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email.";
      toast.error(message);
    } finally {
      setSendingEmail(false);
    }
  };

  const selectedFounder = candidates.find((c) => c.id === selectedFounderId);

  // Platform styling helper
  const getPlatformBadge = (platform: string) => {
    const p = platform.toLowerCase();
    if (p === "github") {
      return { label: "GitHub", style: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" };
    } else if (p === "arxiv") {
      return { label: "arXiv Research", style: "border-blue-500/20 bg-blue-500/10 text-blue-400" };
    } else if (p === "product hunt") {
      return { label: "Product Hunt", style: "border-orange-500/20 bg-orange-500/10 text-orange-400" };
    } else if (p === "devpost") {
      return { label: "Devpost Hacker", style: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400" };
    }
    return { label: platform, style: "border-slate-800 bg-slate-900 text-slate-400" };
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardShell
      title="Founder Discovery"
      description="Autonomous crawler scanning developer lists, research engines, and startups cohorts for potential leads"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Config and scan card */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl md:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Radar className="h-4 w-4 text-primary" /> Discovery Controller
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScan} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="threshold" className="text-xs">Rating Threshold (0-100)</Label>
                  <div className="flex gap-3 items-center">
                    <Input
                      id="threshold"
                      type="number"
                      min="50"
                      max="95"
                      value={scoreThreshold}
                      onChange={(e) => setScoreThreshold(e.target.value)}
                      className="h-9 text-xs border-slate-800 bg-slate-950/20 text-white w-20 shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Keep candidates scoring above this value.</span>
                  </div>
                </div>

                <Button type="submit" disabled={isScanning} className="w-full h-9 gap-2">
                  {isScanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Scan Venture Platforms
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Pulse scan loader */}
          {isScanning ? (
            <Card className="shadow-none border-slate-800 bg-slate-900/60 backdrop-blur-xl md:col-span-2 text-center py-6">
              <CardContent className="flex flex-col justify-center items-center h-full space-y-4">
                <div className="relative flex items-center justify-center size-14">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <Radar className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-xs font-semibold text-white">Platform Crawl in progress...</p>
                  <p className="text-[11px] italic text-primary animate-pulse">{scanText}</p>
                </div>
                <div className="w-full max-w-xs h-1 rounded-full bg-slate-850 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${scanProgress}%` }} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-white uppercase font-bold tracking-wider">Discovery Statistics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 pt-2 text-center">
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Leads</span>
                  <p className="text-xl font-extrabold text-white mt-1">{candidates.length}</p>
                </div>
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">High Scores (&gt;85)</span>
                  <p className="text-xl font-extrabold text-primary mt-1">
                    {candidates.filter(c => c.calculated_score >= 85).length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-3.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Contacted</span>
                  <p className="text-xl font-extrabold text-emerald-450 mt-1">
                    {candidates.filter(c => c.outreach_status === "sent").length}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lead pipelines list and email editor dashboard */}
        {candidates.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left Catalog list */}
            <div className="md:col-span-1 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Discovered Leads</span>
                <span className="text-[10px] text-muted-foreground">{candidates.length} profiles</span>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {candidates.map((c) => {
                  const pBadge = getPlatformBadge(c.source_platform);
                  const isSelected = c.id === selectedFounderId;
                  const isSent = c.outreach_status === "sent";

                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedFounderId(c.id);
                        setEmailDraftText(c.outreach_email || "");
                      }}
                      className={`w-full text-left rounded-xl border p-3.5 space-y-2.5 transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/[0.03] shadow"
                          : "border-slate-850 bg-slate-900/20 hover:bg-slate-900/30"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-white text-xs truncate">{c.full_name}</p>
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 border ${pBadge.style}`}>
                            {pBadge.label}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="bg-slate-800 text-primary font-bold text-[10px] shrink-0 border-none">
                          {c.calculated_score.toFixed(0)} Score
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center w-full pt-1.5 border-t border-slate-850/40 text-[9px] text-muted-foreground">
                        <span>Outreach status</span>
                        {isSent ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1 uppercase tracking-wider">
                            <CheckCircle2 className="h-3 w-3" /> SENT
                          </span>
                        ) : (
                          <span className="text-amber-500 font-bold uppercase tracking-wider">DRAFT</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Editor panel */}
            <div className="md:col-span-2">
              {selectedFounder ? (
                <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl h-full flex flex-col justify-between">
                  <CardHeader className="pb-4 border-b border-slate-850/60">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" /> {selectedFounder.full_name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Discovered on {selectedFounder.source_platform} · Calculated Rating: <span className="text-primary font-semibold">{selectedFounder.calculated_score.toFixed(0)}</span>
                        </CardDescription>
                      </div>
                      {selectedFounder.platform_profile_url && (
                        <a
                          href={selectedFounder.platform_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-semibold"
                        >
                          <Globe className="h-3.5 w-3.5" /> View Profile
                        </a>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 flex-1">
                    {/* Bio details */}
                    <div className="space-y-1 text-xs leading-normal">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Lead bio</span>
                      <p className="text-slate-350">{selectedFounder.bio}</p>
                    </div>

                    {/* Skills */}
                    <div className="space-y-1 text-xs">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Key Skills</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedFounder.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="bg-slate-800 text-slate-350 text-[9px] border-none font-bold">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator className="border-slate-850/60" />

                    {/* Email Outreach editor */}
                    <div className="space-y-2 text-xs flex flex-col flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-primary" /> AI Outreach Draft
                        </span>
                        {selectedFounder.outreach_status === "sent" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold uppercase tracking-wider">
                            Sent Logged
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase tracking-wider">
                            Draft Mode
                          </Badge>
                        )}
                      </div>

                      <textarea
                        value={emailDraftText}
                        onChange={(e) => setEmailDraftText(e.target.value)}
                        disabled={selectedFounder.outreach_status === "sent"}
                        rows={8}
                        className="rounded-xl border border-slate-800 bg-slate-950/30 p-3.5 text-xs text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary w-full flex-1 disabled:opacity-80"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="py-4 border-t border-slate-850/60">
                    <Button
                      onClick={handleSendOutreach}
                      disabled={sendingEmail || selectedFounder.outreach_status === "sent"}
                      className="w-full h-9 gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/95 hover:to-emerald-600/95 font-semibold text-white shadow shadow-primary/10"
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Logging Send...
                        </>
                      ) : selectedFounder.outreach_status === "sent" ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Outreach Email Sent
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Send Outreach Email
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <div className="h-full flex items-center justify-center border border-slate-850 rounded-xl bg-slate-950/10 text-xs text-muted-foreground">
                  Select a lead from the list to review details and outreach.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

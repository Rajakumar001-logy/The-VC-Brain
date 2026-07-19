"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Activity,
  Brain,
  CheckCircle2,
  ChevronRight,
  Database,
  HelpCircle,
  Lightbulb,
  Loader2,
  Play,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import type { Startup } from "@/types";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PartnerEvaluationResponse {
  recommendation_status: "invest" | "watch" | "pass";
  confidence_score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  funding_recommendation: string;
  founder_analysis: string;
  market_analysis: string;
  product_analysis: string;
  competition_analysis: string;
}

export default function PartnerPage() {
  const router = useRouter();

  // States
  const [startups, setStartups] = React.useState<Startup[]>([]);
  const [selectedStartupId, setSelectedStartupId] = React.useState("");
  const [loadingStartups, setLoadingStartups] = React.useState(true);
  
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [evalProgress, setEvalProgress] = React.useState(0);
  const [progressText, setProgressText] = React.useState("");
  
  const [result, setResult] = React.useState<PartnerEvaluationResponse | null>(null);
  const [savingMemo, setSavingMemo] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("summary");

  const progressSteps = [
    "Harvesting linked founder profiles...",
    "Querying GitHub contribution indicators...",
    "Extracting pitch deck slide texts...",
    "Auditing 8-point trust verification checklist...",
    "Recalculating 11-dimension scorecard ratings...",
    "Simulating Venture Capital Partner thesis...",
    "Synthesizing SAFEs terms and SWOT breakdowns..."
  ];

  React.useEffect(() => {
    async function getStartups() {
      try {
        const response = await api.get<Startup[]>("/api/v1/startups");
        setStartups(response);
        if (response.length > 0) {
          setSelectedStartupId(response[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load startups list.";
        toast.error(message);
      } finally {
        setLoadingStartups(false);
      }
    }
    getStartups();
  }, []);

  const triggerEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStartupId) {
      toast.error("Please select a startup company to evaluate.");
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setEvalProgress(5);
    setProgressText(progressSteps[0]);

    // Animate loading stages sequentially
    let step = 0;
    const progressInterval = setInterval(() => {
      step++;
      if (step >= progressSteps.length) {
        clearInterval(progressInterval);
        return;
      }
      setProgressText(progressSteps[step]);
      setEvalProgress((step / progressSteps.length) * 100);
    }, 1500);

    try {
      const response = await api.post<PartnerEvaluationResponse>("/api/v1/memos/partner-evaluate", {
        startup_id: selectedStartupId,
      });
      clearInterval(progressInterval);
      setEvalProgress(100);
      setResult(response);
      toast.success("AI Partner evaluation reports ready!");
    } catch (err) {
      clearInterval(progressInterval);
      setEvalProgress(0);
      const message = err instanceof Error ? err.message : "Consultation failed.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!selectedStartupId || !result) return;
    setSavingMemo(true);

    try {
      await api.post("/api/v1/memos/partner-save-memo", {
        startup_id: selectedStartupId,
        evaluation: result,
      });
      toast.success("Saved as Investment Memo successfully!");
      router.push("/memos");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to convert report to memo.";
      toast.error(message);
    } finally {
      setSavingMemo(false);
    }
  };

  const selectedStartup = startups.find(s => s.id === selectedStartupId);

  return (
    <DashboardShell
      title="AI Partner"
      description="Consult our autonomous AI General Partner to draft checks and run venture SWOT audits"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {!result && !isProcessing && (
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl max-w-xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-emerald-500 shadow-md shadow-primary/10">
                <Brain className="h-6 w-6 text-white animate-pulse" />
              </div>
              <CardTitle className="text-lg mt-4 font-bold text-white">Consult AI Partner</CardTitle>
              <CardDescription>
                Select a company in your pipelines. The AI Partner consolidates slides, profiles, verification checklists, and scores to execute GP investment checks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStartups ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : startups.length === 0 ? (
                <div className="text-center py-6 border border-slate-850 rounded-xl bg-slate-950/20 text-xs text-muted-foreground space-y-3">
                  <p>No startup companies available to evaluate.</p>
                  <Link href="/ingest" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Play className="h-3.5 w-3.5" /> Ingest a deal first
                  </Link>
                </div>
              ) : (
                <form onSubmit={triggerEvaluation} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startupSelect" className="text-xs">Target Pipeline Startup</Label>
                    <select
                      id="startupSelect"
                      value={selectedStartupId}
                      onChange={(e) => setSelectedStartupId(e.target.value)}
                      className="h-10 rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    >
                      {startups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.sector} ({s.stage})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" className="w-full h-10 gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/95 hover:to-emerald-600/95 font-semibold text-white">
                    <Brain className="h-4 w-4" /> Run GP Consultation
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pulsing Brain loader in progress */}
        {isProcessing && (
          <Card className="shadow-none border-slate-800 bg-slate-900/60 backdrop-blur-xl max-w-xl mx-auto text-center py-10">
            <CardContent className="space-y-6">
              {/* Pulsing SVG brain */}
              <div className="relative flex items-center justify-center size-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <Brain className="h-10 w-10 text-primary animate-pulse" />
              </div>

              <div className="space-y-2">
                <CardTitle className="text-base text-white">GP Consultation In Progress</CardTitle>
                <CardDescription className="text-xs italic text-primary animate-pulse">
                  {progressText}
                </CardDescription>
              </div>

              <div className="space-y-2 max-w-xs mx-auto text-xs">
                <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                  <span>Venture diligence crawling</span>
                  <span>{evalProgress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${evalProgress}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consultation Diligence Dashboard Result */}
        {result && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left sidebar card */}
            <div className="space-y-6 md:col-span-1">
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    {selectedStartup?.name || "Startup"} Diligence
                  </CardTitle>
                  <div className="flex flex-col gap-3 mt-2">
                    {/* Recommendation Status badge */}
                    <div className="flex">
                      {result.recommendation_status === "invest" ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs px-2.5 py-0.5 uppercase font-extrabold tracking-wider gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> INVEST THESIS
                        </Badge>
                      ) : result.recommendation_status === "watch" ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs px-2.5 py-0.5 uppercase font-extrabold tracking-wider gap-1">
                          <Activity className="h-3.5 w-3.5" /> WATCH LIST
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs px-2.5 py-0.5 uppercase font-extrabold tracking-wider gap-1">
                          <ShieldAlert className="h-3.5 w-3.5" /> PASS THESIS
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/20 rounded-xl p-3 border border-slate-850">
                      <div className="space-y-0.5 text-xs">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Suggested Check</span>
                        <p className="text-white font-extrabold text-sm">{result.funding_recommendation.split(" on ")[0]}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 py-2 text-xs">
                  {/* Confidence circular gauge */}
                  <div className="flex items-center gap-4 border-b border-slate-850/60 pb-4">
                    <div className="relative flex items-center justify-center size-20 shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          className="stroke-slate-800"
                          strokeWidth="6"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          className="stroke-primary"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={201}
                          strokeDashoffset={201 - (201 * result.confidence_score) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-base font-extrabold text-white">
                          {result.confidence_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="leading-tight">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Thesis Confidence</span>
                      <p className="text-slate-300 mt-1">AI partner confidence in investment fit vectors.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 leading-relaxed text-xs">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">GP Executive Thesis</span>
                    <p className="text-slate-300">{result.reasoning}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 py-4 border-t border-slate-850/60">
                  <Button
                    onClick={handleSaveMemo}
                    disabled={savingMemo}
                    className="w-full h-9 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/95 text-xs gap-1.5 shadow shadow-primary/15"
                  >
                    {savingMemo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Database className="h-3.5 w-3.5" />
                    )}
                    Save as Platform Memo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                    }}
                    className="w-full h-9 border-slate-850 text-xs"
                  >
                    Evaluate Another Deal
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right main sections & SWOT tabs */}
            <div className="md:col-span-2 space-y-6">
              {/* Diligence tabs selector */}
              <div className="flex gap-1 rounded-xl bg-slate-900/60 p-1 border border-slate-800/60">
                <button
                  onClick={() => setActiveTab("summary")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    activeTab === "summary"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  SWOT Audit
                </button>
                <button
                  onClick={() => setActiveTab("diligence")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    activeTab === "diligence"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  Venture Analyses
                </button>
              </div>

              {activeTab === "summary" ? (
                /* SWOT Cards */
                <div className="space-y-4">
                  {/* Strengths card */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-emerald-450 uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Key Diligence Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-350">
                      {result.strengths.map((str, idx) => (
                        <div key={idx} className="flex gap-2 p-2 bg-slate-950/10 rounded-lg border border-slate-850/40">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{str}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Weaknesses card */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-amber-450 uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <HelpCircle className="h-4 w-4 text-amber-500" /> Key Weaknesses / Uncertainties
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-350">
                      {result.weaknesses.map((wk, idx) => (
                        <div key={idx} className="flex gap-2 p-2 bg-slate-950/10 rounded-lg border border-slate-850/40">
                          <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{wk}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Risks card */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-red-450 uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-red-500" /> Key Diligence Risks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-350">
                      {result.risks.map((rk, idx) => (
                        <div key={idx} className="flex gap-2 p-2 bg-slate-950/10 rounded-lg border border-slate-850/40">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{rk}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                /* Diligence text analysis panels */
                <div className="space-y-4">
                  {/* Founder evaluation */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Founder & Team Audit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 rounded-xl p-4 border border-slate-850">
                        {result.founder_analysis}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Market analysis */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-400" /> Market Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 rounded-xl p-4 border border-slate-850">
                        {result.market_analysis}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Product & Tech fit */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-emerald-400" /> Product & Technology Fit
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 rounded-xl p-4 border border-slate-850">
                        {result.product_analysis}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Competitive positioning */}
                  <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-white uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-indigo-400" /> Competitive Moat Review
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/20 rounded-xl p-4 border border-slate-850">
                        {result.competition_analysis}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

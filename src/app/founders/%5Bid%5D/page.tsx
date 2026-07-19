"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  HelpCircle,
  History,
  Info,
  Lightbulb,
  Loader2,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import type { Founder } from "@/types";
import Link from "next/link";

interface FounderTimelineEvent {
  type: "memory" | "score";
  timestamp: string;
  title: string;
  description: string;
  metadata: {
    source?: string;
    confidence?: number;
    score_components?: Record<string, unknown>;
  };
}

interface MemoryResponse {
  id: string;
  title: string;
  body: string;
  observed_at: string;
  source_kind: string;
  similarity?: number;
}

interface ScoreDimensionDetail {
  score: number;
  explanation: string;
}

interface FounderScoreBreakdown {
  technical: ScoreDimensionDetail;
  business: ScoreDimensionDetail;
  execution: ScoreDimensionDetail;
  innovation: ScoreDimensionDetail;
  risk: ScoreDimensionDetail;
  dimensions_breakdown: Record<string, string>;
}

interface ScoreEvaluationResponse {
  overall_score: number;
  overall_explanation: string;
  breakdown: FounderScoreBreakdown;
  scored_at: string;
}

interface TrustClaimDetail {
  claim_type: string;
  claim_value: string;
  evidence_text: string;
  source: string;
  confidence: number;
  status: string;
}

interface TrustEvaluationResponse {
  trust_score: number;
  rationale: string;
  claims: TrustClaimDetail[];
  evaluated_at: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FounderDetailPage({ params }: PageProps) {
  const { id } = React.use(params);

  // States
  const [founder, setFounder] = React.useState<Founder | null>(null);
  const [timeline, setTimeline] = React.useState<FounderTimelineEvent[]>([]);
  const [scoreDetails, setScoreDetails] = React.useState<ScoreEvaluationResponse | null>(null);
  const [trustDetails, setTrustDetails] = React.useState<TrustEvaluationResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [evaluatingScore, setEvaluatingScore] = React.useState(false);
  const [evaluatingTrust, setEvaluatingTrust] = React.useState(false);
  
  // Tabs
  const [activeRightTab, setActiveRightTab] = React.useState<"timeline" | "dimensions" | "trust">("timeline");

  // Accordion active subscores
  const [expandedSubscores, setExpandedSubscores] = React.useState<Record<string, boolean>>({
    technical: false,
    business: false,
    execution: false,
    innovation: false,
    risk: false,
  });

  // Search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchMatches, setSearchMatches] = React.useState<MemoryResponse[]>([]);
  const [searching, setSearching] = React.useState(false);

  // Add Fact Form states
  const [factTitle, setFactTitle] = React.useState("");
  const [factBody, setFactBody] = React.useState("");
  const [factSource, setFactSource] = React.useState("manual");
  const [factConfidence, setFactConfidence] = React.useState("1.0");
  const [submittingFact, setSubmittingFact] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const [fData, tData, sData, trData] = await Promise.all([
        api.get<Founder>(`/api/v1/founders/${id}`),
        api.get<FounderTimelineEvent[]>(`/api/v1/founders/${id}/timeline`),
        api.get<ScoreEvaluationResponse>(`/api/v1/founders/${id}/score/latest`),
        api.get<TrustEvaluationResponse>(`/api/v1/founders/${id}/trust/latest`),
      ]);
      setFounder(fData);
      setTimeline(tData);
      setScoreDetails(sData);
      setTrustDetails(trData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load founder details.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.post<MemoryResponse[]>(`/api/v1/founders/${id}/query`, {
        query: searchQuery,
        limit: 5,
      });
      setSearchMatches(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Semantic query failed.";
      toast.error(message);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factTitle.trim() || !factBody.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    setSubmittingFact(true);
    try {
      await api.post(`/api/v1/founders/${id}/memory`, {
        title: factTitle,
        body: factBody,
        source_kind: factSource,
        confidence: parseFloat(factConfidence) || 1.0,
      });
      toast.success("Fact registered successfully!");
      setFactTitle("");
      setFactBody("");
      // Refresh page data
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit fact.";
      toast.error(message);
    } finally {
      setSubmittingFact(false);
    }
  };

  const triggerScoreEvaluation = async () => {
    setEvaluatingScore(true);
    try {
      const response = await api.post<ScoreEvaluationResponse>(`/api/v1/founders/${id}/score/evaluate`, {});
      setScoreDetails(response);
      toast.success("Founder scorecard successfully recalculated!");
      
      // Reload timeline and founder
      const [fData, tData] = await Promise.all([
        api.get<Founder>(`/api/v1/founders/${id}`),
        api.get<FounderTimelineEvent[]>(`/api/v1/founders/${id}/timeline`),
      ]);
      setFounder(fData);
      setTimeline(tData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scorecard evaluation failed.";
      toast.error(message);
    } finally {
      setEvaluatingScore(false);
    }
  };

  const triggerTrustEvaluation = async () => {
    setEvaluatingTrust(true);
    try {
      const response = await api.post<TrustEvaluationResponse>(`/api/v1/founders/${id}/trust/evaluate`, {});
      setTrustDetails(response);
      toast.success("Trust Verification completed successfully!");
      
      // Reload founder
      const fData = await api.get<Founder>(`/api/v1/founders/${id}`);
      setFounder(fData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trust evaluation failed.";
      toast.error(message);
    } finally {
      setEvaluatingTrust(false);
    }
  };

  const handleOverrideClaim = async (claimType: string, status: string) => {
    try {
      const response = await api.post<TrustEvaluationResponse>(`/api/v1/founders/${id}/trust/verify-claim`, {
        claim_type: claimType,
        status: status
      });
      setTrustDetails(response);
      toast.success(`Claim '${claimType}' status overridden to '${status}' successfully!`);
      
      // Reload founder
      const fData = await api.get<Founder>(`/api/v1/founders/${id}`);
      setFounder(fData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Claim status override failed.";
      toast.error(message);
    }
  };

  const toggleSubscore = (key: string) => {
    setExpandedSubscores((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!founder) {
    return (
      <DashboardShell title="Founder Details" description="Memory logs">
        <div className="text-center py-10">
          <p className="text-slate-400">Founder profile not found.</p>
          <Link href="/founders" className="mt-4 inline-flex items-center gap-1.5 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </Link>
        </div>
      </DashboardShell>
    );
  }

  // Calculate score tiers
  const currentScore = founder.currentFounderScore ?? 70.0;
  const scoreTier =
    currentScore >= 90
      ? { label: "Elite Tier", color: "from-emerald-500 to-teal-600", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
      : currentScore >= 75
      ? { label: "Strong Tier", color: "from-blue-500 to-indigo-600", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" }
      : currentScore >= 50
      ? { label: "Promising Tier", color: "from-amber-500 to-orange-600", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" }
      : { label: "High Risk", color: "from-rose-500 to-red-600", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" };

  const currentTrustScore = founder.currentTrustScore ?? 50.0;
  const trustTier =
    currentTrustScore >= 80
      ? { label: "Verified Trust", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
      : currentTrustScore >= 60
      ? { label: "Vetted Trust", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" }
      : { label: "Awaiting Verification", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" };

  return (
    <DashboardShell
      title={`${founder.name} — Profile Memory`}
      description={`Evolving venture record linked with ${founder.company}`}
      actions={
        <Link href="/founders" className="inline-flex items-center gap-1.5 h-10 px-4 py-2 border border-slate-800 rounded-md hover:bg-slate-900 transition-colors text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Founders
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left scoring & metadata column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Circular Score Gauge */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm text-white font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-primary" /> Overall Rating
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={triggerScoreEvaluation}
                  disabled={evaluatingScore}
                  className="size-7 hover:bg-slate-850"
                  title="Run Rating Re-Evaluation"
                >
                  {evaluatingScore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-6 text-center">
              {/* Radial SVG Gauge */}
              <div className="relative flex items-center justify-center size-36">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-slate-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    className="stroke-primary"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * currentScore) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold text-white">
                    {currentScore.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    VC Score
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <Badge variant="outline" className={`text-xs capitalize py-0.5 border ${scoreTier.badge}`}>
                  {scoreTier.label}
                </Badge>
                <p className="text-xs text-slate-300 leading-normal max-w-[200px] mt-1.5 mx-auto">
                  {scoreDetails?.overall_explanation || "Baseline profile calculated."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Scorecard sub-scores breakdown */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-white uppercase font-bold tracking-wider">AI Scorecard Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 text-xs">
              {scoreDetails?.breakdown && (
                <>
                  {/* Technical Sub-Score */}
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubscore("technical")}
                      className="w-full flex justify-between font-semibold items-center hover:text-primary transition-colors text-left"
                    >
                      <span className="flex items-center gap-1">
                        <Brain className="h-3.5 w-3.5 text-primary" /> Technical Score
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        {scoreDetails.breakdown.technical.score}%
                        {expandedSubscores.technical ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${scoreDetails.breakdown.technical.score}%` }} />
                    </div>
                    {expandedSubscores.technical && (
                      <p className="text-[10px] text-slate-400 mt-1 bg-slate-950/20 rounded-lg p-2 leading-relaxed border border-slate-850">
                        {scoreDetails.breakdown.technical.explanation}
                      </p>
                    )}
                  </div>

                  {/* Business Sub-Score */}
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubscore("business")}
                      className="w-full flex justify-between font-semibold items-center hover:text-blue-400 transition-colors text-left"
                    >
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-400" /> Business Score
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        {scoreDetails.breakdown.business.score}%
                        {expandedSubscores.business ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${scoreDetails.breakdown.business.score}%` }} />
                    </div>
                    {expandedSubscores.business && (
                      <p className="text-[10px] text-slate-400 mt-1 bg-slate-950/20 rounded-lg p-2 leading-relaxed border border-slate-850">
                        {scoreDetails.breakdown.business.explanation}
                      </p>
                    )}
                  </div>

                  {/* Execution Sub-Score */}
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubscore("execution")}
                      className="w-full flex justify-between font-semibold items-center hover:text-indigo-400 transition-colors text-left"
                    >
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-indigo-400" /> Execution Score
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        {scoreDetails.breakdown.execution.score}%
                        {expandedSubscores.execution ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${scoreDetails.breakdown.execution.score}%` }} />
                    </div>
                    {expandedSubscores.execution && (
                      <p className="text-[10px] text-slate-400 mt-1 bg-slate-950/20 rounded-lg p-2 leading-relaxed border border-slate-850">
                        {scoreDetails.breakdown.execution.explanation}
                      </p>
                    )}
                  </div>

                  {/* Innovation Sub-Score */}
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubscore("innovation")}
                      className="w-full flex justify-between font-semibold items-center hover:text-emerald-400 transition-colors text-left"
                    >
                      <span className="flex items-center gap-1">
                        <Lightbulb className="h-3.5 w-3.5 text-emerald-400" /> Innovation Score
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        {scoreDetails.breakdown.innovation.score}%
                        {expandedSubscores.innovation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${scoreDetails.breakdown.innovation.score}%` }} />
                    </div>
                    {expandedSubscores.innovation && (
                      <p className="text-[10px] text-slate-400 mt-1 bg-slate-950/20 rounded-lg p-2 leading-relaxed border border-slate-850">
                        {scoreDetails.breakdown.innovation.explanation}
                      </p>
                    )}
                  </div>

                  {/* Risk Sub-Score */}
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleSubscore("risk")}
                      className="w-full flex justify-between font-semibold items-center hover:text-rose-450 transition-colors text-left"
                    >
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> Risk Score (Lower is better)
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        {scoreDetails.breakdown.risk.score}%
                        {expandedSubscores.risk ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    </button>
                    <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${scoreDetails.breakdown.risk.score}%` }} />
                    </div>
                    {expandedSubscores.risk && (
                      <p className="text-[10px] text-slate-400 mt-1 bg-slate-950/20 rounded-lg p-2 leading-relaxed border border-slate-850">
                        {scoreDetails.breakdown.risk.explanation}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Semantic Querying Widget */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5">
                <Search className="h-4 w-4 text-primary" /> Query Memory
              </CardTitle>
              <CardDescription>
                Ask questions semantically over vector-stored observations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Stanford grid project..."
                  className="h-9 text-xs border-slate-800 bg-slate-950/20"
                />
                <Button type="submit" size="sm" className="h-9 px-3 shrink-0">
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Query"}
                </Button>
              </form>

              {searchMatches.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-850">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Semantic Matches</p>
                  {searchMatches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-slate-850 bg-slate-950/30 p-2.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-white">
                        <span>{match.title}</span>
                        {match.similarity && (
                          <Badge variant="outline" className="text-[9px] px-1 border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
                            {(match.similarity * 100).toFixed(0)}% Match
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">{match.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right timeline, ratings matrix & trust agent column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Main workspace navigation tabs */}
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-900/60 p-1 border border-slate-800/60">
            <button
              onClick={() => setActiveRightTab("timeline")}
              className={`flex-1 min-w-[100px] rounded-lg py-2 text-xs font-semibold transition-all ${
                activeRightTab === "timeline"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveRightTab("dimensions")}
              className={`flex-1 min-w-[100px] rounded-lg py-2 text-xs font-semibold transition-all ${
                activeRightTab === "dimensions"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Dimension Ratings
            </button>
            <button
              onClick={() => setActiveRightTab("trust")}
              className={`flex-1 min-w-[100px] rounded-lg py-2 text-xs font-semibold transition-all ${
                activeRightTab === "trust"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Trust Checklist
            </button>
          </div>

          {activeRightTab === "timeline" && (
            <div className="space-y-6">
              {/* Add fact widget */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-primary" /> Add Fact Assertion
                  </CardTitle>
                  <CardDescription>
                    Record new observations. AI merges duplicates and scores updates dynamically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddFact} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="factTitle" className="text-xs">Fact Title *</Label>
                      <Input
                        id="factTitle"
                        value={factTitle}
                        onChange={(e) => setFactTitle(e.target.value)}
                        placeholder="e.g. Added advisors from Nvidia"
                        required
                        className="h-9 text-xs border-slate-800 bg-slate-950/20"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="factBody" className="text-xs">Factual Detail / Assertion *</Label>
                      <textarea
                        id="factBody"
                        value={factBody}
                        onChange={(e) => setFactBody(e.target.value)}
                        placeholder="Provide specific metrics, dates, or qualitative credentials..."
                        required
                        rows={3}
                        className="rounded-lg border border-slate-800 bg-slate-950/20 p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="factSource" className="text-xs">Source</Label>
                        <select
                          id="factSource"
                          value={factSource}
                          onChange={(e) => setFactSource(e.target.value)}
                          className="h-9 rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary w-full"
                        >
                          <option value="manual">Manual log</option>
                          <option value="interview">Founder interview</option>
                          <option value="company">Startup files</option>
                          <option value="github">GitHub scraper</option>
                          <option value="reference">Reference check</option>
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="factConfidence" className="text-xs">Confidence weight</Label>
                        <select
                          id="factConfidence"
                          value={factConfidence}
                          onChange={(e) => setFactConfidence(e.target.value)}
                          className="h-9 rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary w-full"
                        >
                          <option value="1.0">High (1.0)</option>
                          <option value="0.8">Medium (0.8)</option>
                          <option value="0.5">Low / Unverified (0.5)</option>
                        </select>
                      </div>
                    </div>

                    <Button type="submit" disabled={submittingFact} className="w-full h-9 gap-2">
                      {submittingFact ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Fact...
                        </>
                      ) : (
                        <>
                          <Database className="h-3.5 w-3.5" /> Append Memory Fact
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Chronological timeline */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="pb-3 border-b border-slate-800/40">
                  <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5">
                    <History className="h-4 w-4 text-primary" /> Memory Timeline
                  </CardTitle>
                  <CardDescription>
                    Log of historic factual assertions and score updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 relative">
                  {timeline.length > 0 ? (
                    <div className="relative border-l border-slate-800 ml-4 space-y-6">
                      {timeline.map((event, idx) => {
                        const isScore = event.type === "score";
                        return (
                          <div key={idx} className="relative pl-6">
                            {/* Timeline dot */}
                            <span className={`absolute top-1 -left-3 flex size-6 items-center justify-center rounded-full border border-slate-900 text-white ${
                              isScore ? "bg-primary shadow shadow-primary/20" : "bg-slate-800"
                            }`}>
                              {isScore ? (
                                <Scale className="h-3 w-3" />
                              ) : (
                                <Info className="h-3 w-3" />
                              )}
                            </span>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(event.timestamp).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${
                                  isScore ? "border-primary/20 text-primary bg-primary/5" : "border-slate-800 text-slate-400 bg-slate-900"
                                }`}>
                                  {event.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-white font-bold mt-1">{event.title}</p>
                              <p className="text-xs text-slate-300 leading-relaxed mt-0.5">{event.description}</p>
                              
                              {/* Metadata pill details */}
                              {!isScore && event.metadata.source && (
                                <div className="flex gap-2 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    Source: <span className="font-semibold text-slate-400 capitalize">{event.metadata.source}</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Confidence: <span className="font-semibold text-slate-400">{event.metadata.confidence ?? 1.0}</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No memory assertions recorded yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeRightTab === "dimensions" && (
            /* AI Dimensions matrix grid */
            <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm text-white font-bold">11-Dimension Rating Matrix</CardTitle>
                <CardDescription>
                  Ratings calculated over specialized signals harvested by VC Brain
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scoreDetails?.breakdown?.dimensions_breakdown ? (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {Object.entries(scoreDetails.breakdown.dimensions_breakdown).map(([key, rating]) => {
                      const formattedKey = key.replace("_", " ");
                      const ratingColors =
                        rating === "Outstanding"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : rating === "Strong"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : rating === "Moderate"
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-slate-800 text-slate-400 border-none";
                      
                      return (
                        <div key={key} className="rounded-xl border border-slate-850 bg-slate-950/20 p-3 flex flex-col justify-between gap-2.5">
                          <span className="text-xs text-slate-300 font-bold capitalize truncate">
                            {formattedKey}
                          </span>
                          <div className="flex">
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border ${ratingColors}`}>
                              {rating}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    Please trigger a scorecard re-evaluation to load the rating matrix.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeRightTab === "trust" && (
            /* Trust checklist tab view */
            <div className="space-y-6">
              {/* Trust Score circular gauge card */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm text-white font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" /> Trust Verification Audit
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={triggerTrustEvaluation}
                      disabled={evaluatingTrust}
                      className="h-8 gap-1.5 hover:bg-slate-850"
                    >
                      {evaluatingTrust ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running Audit...
                        </>
                      ) : (
                        <>
                          <Activity className="h-3.5 w-3.5" /> Run Trust Check
                        </>
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-6 py-2">
                  <div className="relative flex items-center justify-center size-28 shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        className="stroke-emerald-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={289}
                        strokeDashoffset={289 - (289 * currentTrustScore) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-extrabold text-white">
                        {currentTrustScore.toFixed(0)}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">
                        Trust Score
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 leading-relaxed text-xs">
                    <Badge variant="outline" className={`capitalize border ${trustTier.badge}`}>
                      {trustTier.label}
                    </Badge>
                    <p className="text-slate-300 font-medium">{trustDetails?.rationale || "Trust verification audits pending."}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Claims checklist list */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-sm text-white font-bold">8-Point Verification Checklist</CardTitle>
                  <CardDescription>
                    Review database-verified founder claims and toggle manual confirmations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {trustDetails?.claims && trustDetails.claims.length > 0 ? (
                    trustDetails.claims.map((claim) => {
                      const isVerified = claim.status === "verified";
                      const isContradicted = claim.status === "contradicted";
                      
                      return (
                        <div
                          key={claim.claim_type}
                          className={`rounded-xl border p-4 space-y-3 transition-all ${
                            isVerified
                              ? "border-emerald-500/20 bg-emerald-500/5"
                              : isContradicted
                              ? "border-red-500/20 bg-red-500/5"
                              : "border-slate-850 bg-slate-950/20"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              {isVerified ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                              ) : isContradicted ? (
                                <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                              ) : (
                                <HelpCircle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                              )}
                              <span className="text-xs font-bold text-white uppercase tracking-wider">
                                {claim.claim_type}
                              </span>
                              <Badge variant="outline" className="text-[9px] text-muted-foreground border-slate-800 capitalize">
                                {claim.source.replace("_", " ")}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                              <span>Confidence weight</span>
                              <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-bold border-none text-[9px]">
                                {(claim.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          </div>

                          <div className="text-xs leading-normal space-y-1 pl-6">
                            <p className="text-slate-300"><span className="font-semibold text-white">Assertion:</span> {claim.claim_value}</p>
                            <p className="text-slate-400"><span className="font-semibold text-white">Evidence:</span> {claim.evidence_text}</p>
                          </div>

                          {/* Override actions */}
                          <div className="flex justify-end gap-2 pt-1.5 pl-6 border-t border-slate-850/40">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOverrideClaim(claim.claim_type, "verified")}
                              disabled={isVerified}
                              className="h-7 text-[10px] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                            >
                              Verify Fact
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOverrideClaim(claim.claim_type, "contradicted")}
                              disabled={isContradicted}
                              className="h-7 text-[10px] border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            >
                              Contradict Fact
                            </Button>
                            {(isVerified || isContradicted) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOverrideClaim(claim.claim_type, "unverified")}
                                className="h-7 text-[10px] text-slate-400 hover:bg-slate-850 hover:text-white"
                              >
                                Reset Status
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Please click &quot;Run Trust Check&quot; above to start the claim verification agent.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import {
  BrainCircuit,
  CheckCircle2,
  FileCheck,
  FileSearch,
  Loader2,
  Sparkles,
  Upload,
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
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface PitchDeckAnalysis {
  founder: string;
  market: string;
  problem: string;
  solution: string;
  business_model: string;
  competition: string;
  revenue: string;
  traction: string;
  go_to_market: string;
  team: string;
  financials: string;
  risks: string;
}

interface PitchDeckResponse {
  id: string;
  company_id: string | null;
  title: string;
  ai_summary: string;
  analysis: PitchDeckAnalysis;
}

interface AnalysisTab {
  id: string;
  label: string;
  fields: { key: keyof PitchDeckAnalysis; label: string; desc: string }[];
}

export default function AnalyzePage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progressValue, setProgressValue] = React.useState(0);
  const [result, setResult] = React.useState<PitchDeckResponse | null>(null);
  
  // Drag and drop file states
  const [isDragging, setIsDragging] = React.useState(false);
  
  // Tabs configuration
  const [activeTab, setActiveTab] = React.useState("opportunity");
  const tabs: AnalysisTab[] = [
    {
      id: "opportunity",
      label: "Core Opportunity",
      fields: [
        { key: "problem", label: "Problem Statement", desc: "The core customer pain point or market friction identified." },
        { key: "solution", label: "Product Solution", desc: "The company's product, tech, and value proposition." },
        { key: "market", label: "Market Opportunity", desc: "Market size, TAM/SAM, growth, and targeted segments." },
        { key: "competition", label: "Competitive Landscape", desc: "Key competitors, competitive advantages, and moat." },
      ],
    },
    {
      id: "strategy",
      label: "Business Strategy",
      fields: [
        { key: "business_model", label: "Business Model", desc: "Pricing structures, sales channels, and unit economics." },
        { key: "go_to_market", label: "Go To Market", desc: "Customer acquisition plan, marketing channels, and growth strategies." },
        { key: "risks", label: "Key Risks", desc: "Execution hurdles, technology limitations, and market challenges." },
      ],
    },
    {
      id: "traction",
      label: "Traction & Finance",
      fields: [
        { key: "revenue", label: "Revenue & ARR", desc: "ARR/MRR metrics, history, and revenue progression details." },
        { key: "traction", label: "Traction Metrics", desc: "Pilot projects, active user cohorts, churn, and LOIs." },
        { key: "financials", label: "Financials & Burn", desc: "Burn rate, target raise amount, and runway estimates." },
      ],
    },
    {
      id: "team",
      label: "Founders & Team",
      fields: [
        { key: "founder", label: "Primary Founders", desc: "Backgrounds of the primary drivers behind the project." },
        { key: "team", label: "Key Team Members", desc: "Advisors, core developers, and organizational strength." },
      ],
    },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        toast.success(`Loaded file: ${droppedFile.name}`);
      } else {
        toast.error("Only PDF format files are supported.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please load a PDF pitch deck to analyze.");
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setProgressValue(5);

    // Animate progress bar during long AI processing
    const progressInterval = setInterval(() => {
      setProgressValue(curr => {
        if (curr >= 90) {
          clearInterval(progressInterval);
          return curr;
        }
        return curr + (curr < 50 ? 8 : curr < 75 ? 4 : 1.5);
      });
    }, 900);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.postForm<PitchDeckResponse>("/api/v1/pitch-decks/analyze", formData);
      clearInterval(progressInterval);
      setProgressValue(100);
      setResult(response);
      toast.success("Pitch deck analysis successfully generated!");
    } catch (err) {
      clearInterval(progressInterval);
      setProgressValue(0);
      const message = err instanceof Error ? err.message : "Pitch deck analysis failed.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setProgressValue(0);
  };

  return (
    <DashboardShell
      title="Deck Analyzer"
      description="Extract and review 12 venture dimensions from startup pitch decks using AI"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {!result && !isProcessing && (
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="text-center max-w-xl mx-auto">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-500 shadow-md shadow-primary/10">
                <BrainCircuit className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-lg mt-4 font-bold text-white">AI Pitch Deck Analyzer</CardTitle>
              <CardDescription>
                Upload a startup pitch deck in PDF format. OpenAI extracts product, market size, business models, financial burn, team structures, and risks instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={triggerAnalysis} className="space-y-6 max-w-xl mx-auto">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center border border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : file
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/40"
                  }`}
                >
                  <input
                    type="file"
                    id="analyzeUpload"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="analyzeUpload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileCheck className="h-10 w-10 text-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-400 truncate max-w-xs">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB · Click to load a different PDF
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <span className="text-sm font-semibold">
                          Drag & drop pitch deck here, or <span className="text-primary hover:underline">browse files</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PDF files up to 10MB supported
                        </span>
                      </div>
                    )}
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={!file}
                  className="w-full h-11 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 font-semibold text-white shadow-lg shadow-primary/10"
                >
                  Analyze Pitch Deck
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* In-progress analysis status */}
        {isProcessing && (
          <Card className="shadow-none border-slate-800 bg-slate-900/60 backdrop-blur-xl max-w-xl mx-auto text-center py-10">
            <CardContent className="space-y-6">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div className="space-y-2">
                <CardTitle className="text-base text-white">Analyzing Pitch Slides</CardTitle>
                <CardDescription>
                  Reading text layers and synthesizing diligence categories with AI...
                </CardDescription>
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Diligence extraction</span>
                  <span>{progressValue.toFixed(0)}%</span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Structuring results panel */}
        {result && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left sidebar info column */}
            <div className="space-y-6">
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileSearch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base text-white font-bold truncate">
                      {result.title}
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      Diligence Completed
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-semibold">AI Executive Summary</Label>
                    <p className="text-slate-300 mt-1">{result.ai_summary}</p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/20 p-3 text-[11px] space-y-2 text-muted-foreground">
                    <p className="flex items-center gap-1.5 text-white font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Database Indexed
                    </p>
                    <p>
                      Analysis stored under <span className="font-semibold text-slate-300">pitch_decks.metadata</span> in PostgreSQL.
                    </p>
                    <p>
                      Text contents indexed for semantic search matches.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 py-4 border-t border-slate-800/40">
                  {result.company_id && (
                    <Link
                      href={`/search?q=${encodeURIComponent(result.title)}`}
                      className="w-full h-9 px-3 bg-secondary text-secondary-foreground font-semibold rounded-md hover:bg-secondary/90 flex items-center justify-center text-xs"
                    >
                      Semantic Search Profile
                    </Link>
                  )}
                  <Button variant="outline" onClick={handleReset} className="w-full h-9 border-slate-800 text-xs">
                    Analyze Another Deck
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right main analysis categories tabs */}
            <div className="md:col-span-2 space-y-4">
              {/* Category tabs navigator */}
              <div className="flex flex-wrap gap-1 rounded-xl bg-slate-900/60 p-1 border border-slate-800/60">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[120px] rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:bg-slate-850 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Categorized data fields list */}
              <div className="space-y-4">
                {tabs
                  .find((t) => t.id === activeTab)
                  ?.fields.map((field) => {
                    const value = result.analysis[field.key] || "No data extracted from pitch slides.";
                    return (
                      <Card key={field.key} className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm text-white font-bold flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-primary" /> {field.label}
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase border-slate-800">
                              {field.key.replace("_", " ")}
                            </Badge>
                          </div>
                          <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                            {field.desc}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/20 rounded-xl p-4 border border-slate-850">
                            {value}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

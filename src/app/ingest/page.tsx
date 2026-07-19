"use client";

import * as React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import {
  Building2,
  CheckCircle2,
  GitBranch,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { Founder, Startup } from "@/types";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

interface PipelineStep {
  label: string;
  description: string;
  status: "pending" | "active" | "completed" | "error";
}

export default function IngestPage() {
  // Form states
  const [companyName, setCompanyName] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [githubUsername, setGithubUsername] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  
  // Pipeline processing states
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progressValue, setProgressValue] = React.useState(0);
  const [pipelineSteps, setPipelineSteps] = React.useState<PipelineStep[]>([
    { label: "Pipeline Init", description: "Parsing inputs and setting up threads", status: "pending" },
    { label: "Scrape Website", description: "Reading homepage text content & tags", status: "pending" },
    { label: "Parse Pitch Deck", description: "Extracting slides and text pages from PDF", status: "pending" },
    { label: "Query GitHub API", description: "Retrieving developer profile details", status: "pending" },
    { label: "Deduplication check", description: "Matching existing database profiles", status: "pending" },
    { label: "AI structuring", description: "Reconciling skills, exits, and education with GPT", status: "pending" },
    { label: "Semantic Indexing", description: "Storing embeddings for vector search", status: "pending" },
  ]);

  // Results
  const [result, setResult] = React.useState<{ founder: Founder; startup: Startup } | null>(null);

  // File drag & drop states
  const [isDragging, setIsDragging] = React.useState(false);

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
        toast.error("Only PDF pitch decks are supported.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerIngestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Company Name is required.");
      return;
    }

    setIsProcessing(true);
    setResult(null);
    setProgressValue(5);
    
    // Reset steps
    setPipelineSteps(prev => prev.map(s => ({ ...s, status: "pending" })));
    
    // Trigger step-by-step UI animation loop
    setPipelineSteps(prev => {
      const copy = [...prev];
      copy[0].status = "active";
      return copy;
    });

    let curr = 0;
    const stepInterval = setInterval(() => {
      if (curr >= pipelineSteps.length - 2) {
        clearInterval(stepInterval);
        return;
      }
      
      const next = curr + 1;
      setPipelineSteps(prevSteps => {
        const updated = [...prevSteps];
        updated[curr].status = "completed";
        updated[next].status = "active";
        return updated;
      });
      setProgressValue((next / pipelineSteps.length) * 100);
      curr = next;
    }, 1800);

    // Call Ingestion API
    const formData = new FormData();
    formData.append("company_name", companyName);
    if (websiteUrl) formData.append("website_url", websiteUrl);
    if (githubUsername) formData.append("github_username", githubUsername);
    if (file) formData.append("pitch_deck", file);

    try {
      const response = await api.postForm<{ founder: Founder; startup: Startup }>("/api/v1/ingest", formData);
      
      // Fast-forward animation to success
      clearInterval(stepInterval);
      setProgressValue(100);
      setPipelineSteps(prev => prev.map(s => ({ ...s, status: "completed" })));
      setResult(response);
      toast.success("Deal successfully ingested and indexed!");
    } catch (err) {
      clearInterval(stepInterval);
      setProgressValue(100);
      setPipelineSteps(prev => {
        const copy = [...prev];
        const activeIdx = copy.findIndex(s => s.status === "active" || s.status === "pending");
        if (activeIdx !== -1) {
          copy[activeIdx].status = "error";
        }
        return copy;
      });
      const message = err instanceof Error ? err.message : "Ingestion pipeline failed.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCompanyName("");
    setWebsiteUrl("");
    setGithubUsername("");
    setFile(null);
    setResult(null);
    setProgressValue(0);
    setPipelineSteps(prev => prev.map(s => ({ ...s, status: "pending" })));
  };

  return (
    <DashboardShell
      title="Ingest Deal"
      description="Collect and ingest founder data using AI extraction pipelines"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {!result && !isProcessing && (
          <form onSubmit={triggerIngestion} className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-base">Deal Sources</CardTitle>
                <CardDescription>
                  Enter company specifics and links to begin raw data gathering
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. NovaGrid"
                      required
                      className="pl-9 h-10 border-slate-800 bg-slate-950/20"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <div className="relative">
                      <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="websiteUrl"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="e.g. novagrid.io"
                        className="pl-9 h-10 border-slate-800 bg-slate-950/20"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="githubUsername">Primary GitHub</Label>
                    <div className="relative">
                      <GitBranch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="githubUsername"
                        value={githubUsername}
                        onChange={(e) => setGithubUsername(e.target.value)}
                        placeholder="e.g. priyashah"
                        className="pl-9 h-10 border-slate-800 bg-slate-950/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>PDF Pitch Deck</Label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : file
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800 bg-slate-950/10 hover:border-slate-700 hover:bg-slate-950/25"
                    }`}
                  >
                    <input
                      type="file"
                      id="fileUpload"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="fileUpload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                      {file ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-400 truncate max-w-xs">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB · PDF deck loaded
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Drag & drop PDF here, or <span className="text-primary hover:underline">browse files</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF pitch deck documents up to 10MB supported
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-800/40 py-4 justify-between">
                <p className="text-xs text-muted-foreground">
                  * Indicates required fields. Ingestion requires an active auth token.
                </p>
                <Button type="submit" className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-600/95 shadow-md shadow-primary/10">
                  <Play className="h-4 w-4" /> Run Ingest
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-base">Ingestion Pipeline</CardTitle>
                <CardDescription>
                  Reconciled facts processed concurrently by VC Brain AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-slate-950/30 p-4 border border-slate-800/60 text-xs leading-relaxed space-y-2">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Async AI Pipeline
                  </p>
                  <p className="text-muted-foreground">
                    Our system reads the startup homepage, queries GitHub, and parses PDF deck slides simultaneously to synthesize founder details.
                  </p>
                  <p className="text-muted-foreground">
                    OpenAI structures the data, normalizes educational entries, merges skills, and deduplicates records against current database values.
                  </p>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Processing/Loading pipeline view */}
        {isProcessing && (
          <Card className="shadow-none border-slate-800 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-lg flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Processing Deal Ingestion
              </CardTitle>
              <CardDescription>
                Running pipeline threads concurrently — please wait
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                  <span>Ingestion progress</span>
                  <span>{progressValue.toFixed(0)}%</span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>

              <div className="grid gap-3 pt-2">
                {pipelineSteps.map((step, idx) => (
                  <div
                    key={step.label}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      step.status === "active"
                        ? "border-primary bg-primary/5"
                        : step.status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/5 opacity-80"
                        : step.status === "error"
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-slate-800 bg-slate-950/10 opacity-40"
                    }`}
                  >
                    <span className="mt-0.5">
                      {step.status === "completed" ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      ) : step.status === "active" ? (
                        <RefreshCw className="h-4.5 w-4.5 text-primary animate-spin" />
                      ) : step.status === "error" ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-red-500 rotate-45" />
                      ) : (
                        <div className="h-4.5 w-4.5 rounded-full border border-slate-700 bg-slate-950/20 flex items-center justify-center text-[10px] font-semibold text-slate-500">
                          {idx + 1}
                        </div>
                      )}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className={`text-sm font-semibold ${step.status === "active" ? "text-primary" : "text-white"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingestion Results Display */}
        {result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Ingestion Completed
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="border-slate-800">
                  Ingest Another
                </Button>
                <Link href="/founders" className="h-10 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 flex items-center justify-center">
                  View Founders
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Founder Profile Result */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-800/40 pb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">{result.founder.name}</CardTitle>
                    <CardDescription>{result.founder.role} · {result.founder.company}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm leading-relaxed">
                  <div>
                    <Label className="text-xs text-muted-foreground">Founder Bio</Label>
                    <p className="text-slate-300 mt-1">{result.founder.bio || "No bio parsed."}</p>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Skills</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {result.founder.skills && result.founder.skills.length > 0 ? (
                        result.founder.skills.map(s => (
                          <Badge key={s} variant="secondary" className="bg-slate-800 text-slate-300 border-none">
                            {s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">No skills identified.</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-950/20 p-3 text-xs border border-slate-800/40">
                    <div>
                      <span className="text-muted-foreground">Years Experience</span>
                      <p className="text-white font-medium mt-0.5">{result.founder.yearsExperience} Years</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Previous Exits</span>
                      <p className="text-white font-medium mt-0.5">{result.founder.previousExits}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Education</span>
                      <p className="text-white font-medium mt-0.5">
                        {result.founder.education && result.founder.education.length > 0
                          ? result.founder.education.join(" · ")
                          : "Self-taught / None specified"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Email Contact</Label>
                    <p className="text-slate-300 mt-0.5 font-medium">{result.founder.email}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Startup Profile Result */}
              <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-800/40 pb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/10">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base text-white truncate">{result.startup.name}</CardTitle>
                    <CardDescription className="truncate">{result.startup.tagline}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm leading-relaxed">
                  <div>
                    <Label className="text-xs text-muted-foreground">Startup Description</Label>
                    <p className="text-slate-300 mt-1">{result.startup.description || "No description parsed."}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize">
                      {result.startup.sector}
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20 capitalize">
                      {result.startup.stage}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-950/20 p-3 text-xs border border-slate-800/40">
                    <div>
                      <span className="text-muted-foreground">Traction</span>
                      <p className="text-white font-medium mt-0.5">{result.startup.traction || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location</span>
                      <p className="text-white font-medium mt-0.5">{result.startup.location || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Founded Year</span>
                      <p className="text-white font-medium mt-0.5">{result.startup.foundedYear}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Employee Count</span>
                      <p className="text-white font-medium mt-0.5">{result.startup.employeeCount} Employees</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Funding Raised</span>
                      <p className="text-white font-medium mt-0.5">
                        {result.startup.fundingRaised ? formatCurrency(result.startup.fundingRaised, true) : "$0"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valuation</span>
                      <p className="text-white font-medium mt-0.5">
                        {result.startup.valuation ? formatCurrency(result.startup.valuation, true) : "$0"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

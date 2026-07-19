"use client";

import * as React from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Brain,
  FileText,
  Layers,
  Loader2,
  Play,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AgentLog {
  timestamp: string;
  agent_name: string;
  message: string;
  status: string;
}

interface AgentRunResponse {
  status: string;
  logs: AgentLog[];
  final_memo_id: string | null;
  output_payload: Record<string, unknown>;
}

const AGENT_LIST = [
  { key: "CollectorAgent", label: "Collector Agent", desc: "Website & GitHub Scraper" },
  { key: "ExtractorAgent", label: "Extractor Agent", desc: "Entity Schema Parser" },
  { key: "MemoryAgent", label: "Memory Agent", desc: "Vector Facts Sync" },
  { key: "ScoringAgent", label: "Scoring Agent", desc: "11-Signal Heuristics" },
  { key: "ValidatorAgent", label: "Validator Agent", desc: "Trust Auditor" },
  { key: "MarketResearchAgent", label: "Research Agent", desc: "TAM Competitor Scanner" },
  { key: "InvestmentAgent", label: "Investment Agent", desc: "SAFE Sizing Thesis" },
  { key: "MemoAgent", label: "Memo Agent", desc: "Institutional Drafter" },
];

export default function AgentConsolePage() {
  // Inputs
  const [companyName, setCompanyName] = React.useState("NovaGrid");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [githubUser, setGithubUser] = React.useState("");
  const [sourcingNotes, setSourcingNotes] = React.useState("");
  const [retriesLimit, setRetriesLimit] = React.useState("3");

  // Run States
  const [running, setRunning] = React.useState(false);
  const [agentStates, setAgentStates] = React.useState<Record<string, "idle" | "processing" | "success" | "warning" | "error">>({});
  
  const [logs, setLogs] = React.useState<AgentLog[]>([]);
  const [finalMemoId, setFinalMemoId] = React.useState<string | null>(null);
  const [memoText, setMemoText] = React.useState<string | null>(null);

  // Auto scroll terminal logs
  const terminalEndRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Please specify a company name.");
      return;
    }

    setRunning(true);
    setLogs([]);
    setFinalMemoId(null);
    setMemoText(null);
    
    // Reset agent nodes
    const initialNodes: Record<string, "idle"> = {};
    AGENT_LIST.forEach((a) => { initialNodes[a.key] = "idle"; });
    setAgentStates(initialNodes);

    // Dynamic state stepping animation matching actual execution progression
    const simulateVisualProgression = () => {
      let stepIndex = 0;
      const interval = setInterval(() => {
        if (stepIndex >= AGENT_LIST.length) {
          clearInterval(interval);
          return;
        }
        const agent = AGENT_LIST[stepIndex];
        setAgentStates((prev) => ({ ...prev, [agent.key]: "processing" }));
        
        // Simulating transition success slightly after
        setTimeout(() => {
          setAgentStates((prev) => {
            // Check if we hit an error on CollectorAgent for retry-test
            if (agent.key === "CollectorAgent" && companyName.toLowerCase() === "retry-test") {
              return { ...prev, [agent.key]: "warning" };
            }
            return { ...prev, [agent.key]: "success" };
          });
        }, 1100);

        stepIndex++;
      }, 1800);
      return interval;
    };

    const visualInterval = simulateVisualProgression();

    try {
      const response = await api.post<AgentRunResponse>("/api/v1/agents/run", {
        company_name: companyName,
        website: websiteUrl || null,
        github: githubUser || null,
        notes: sourcingNotes || null,
        retries_limit: parseInt(retriesLimit) || 3,
      });

      clearInterval(visualInterval);
      setLogs(response.logs);

      // Force nodes success/error based on final status
      if (response.status === "success") {
        const finalSuccess: Record<string, "success"> = {};
        AGENT_LIST.forEach((a) => { finalSuccess[a.key] = "success"; });
        setAgentStates(finalSuccess);
        
        setFinalMemoId(response.final_memo_id);
        if (response.output_payload?.memo_markdown) {
          setMemoText(String(response.output_payload.memo_markdown));
        }
        toast.success("Multi-Agent pipeline completed successfully!");
      } else {
        toast.error("Pipeline aborted due to agent failure.");
      }
    } catch (err) {
      clearInterval(visualInterval);
      const message = err instanceof Error ? err.message : "Pipeline execution failed.";
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  // Helper colors for terminal
  const getLogStatusClass = (status: string) => {
    switch (status) {
      case "success": return "text-emerald-400 font-semibold";
      case "warning": return "text-amber-500 font-semibold";
      case "error": return "text-red-400 font-extrabold";
      case "retry": return "text-indigo-400 animate-pulse";
      default: return "text-slate-300";
    }
  };

  const getAgentNodeClass = (key: string) => {
    const state = agentStates[key] || "idle";
    
    if (state === "processing") {
      return "border-primary bg-primary/10 text-primary shadow shadow-primary/20 animate-pulse";
    } else if (state === "success") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    } else if (state === "warning") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-400 animate-bounce";
    } else if (state === "error") {
      return "border-red-500/30 bg-red-500/10 text-red-400";
    }
    
    return "border-slate-850 bg-slate-950/20 text-slate-500";
  };

  return (
    <DashboardShell
      title="Multi-Agent Console"
      description="Orchestrate cooperative specialized agents communicating via structured JSON logs"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Settings Panel */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl md:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" /> pipeline Controller
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunPipeline} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="company" className="text-xs">Startup Name</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={running}
                    placeholder="e.g. NovaGrid"
                    className="h-9 text-xs border-slate-800 bg-slate-950/20 text-white"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Type &quot;retry-test&quot; to trigger collector exceptions.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="website" className="text-xs">Website URL (Optional)</Label>
                  <Input
                    id="website"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    disabled={running}
                    placeholder="https://novagrid.io"
                    className="h-9 text-xs border-slate-800 bg-slate-950/20 text-white"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="github" className="text-xs">GitHub Handle (Optional)</Label>
                  <Input
                    id="github"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    disabled={running}
                    placeholder="novagrid-cache"
                    className="h-9 text-xs border-slate-800 bg-slate-950/20 text-white"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="notes" className="text-xs">Additional Context</Label>
                  <textarea
                    id="notes"
                    value={sourcingNotes}
                    onChange={(e) => setSourcingNotes(e.target.value)}
                    disabled={running}
                    placeholder="Rust cache libraries. Won EthGlobal 2025."
                    rows={3}
                    className="rounded-xl border border-slate-800 bg-slate-950/30 p-2.5 text-xs text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retries" className="text-xs">Retry Limit: {retriesLimit}</Label>
                  <input
                    id="retries"
                    type="range"
                    min="1"
                    max="5"
                    value={retriesLimit}
                    onChange={(e) => setRetriesLimit(e.target.value)}
                    disabled={running}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                <Button type="submit" disabled={running} className="w-full h-9 gap-2">
                  {running ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Orchestrating...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Run Coordinated Pipeline
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Pipeline Graph visualization */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-primary" /> Orchestrator Network
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6 flex flex-col justify-center items-center">
              {/* Supervisor node */}
              <div className={cn(
                "rounded-xl border px-5 py-3 text-center mb-10 transition-all flex flex-col justify-center z-10",
                running
                  ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20 animate-pulse"
                  : "border-slate-800 bg-slate-950/40 text-slate-350"
              )}>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-primary">Supervisor orchestrator</span>
                <p className="text-xs font-bold text-white">Dynamic Coordinator</p>
              </div>

              {/* Connections network grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full relative">
                {AGENT_LIST.map((agent) => (
                  <div
                    key={agent.key}
                    className={cn(
                      "rounded-xl border p-3 text-center transition-all flex flex-col justify-center",
                      getAgentNodeClass(agent.key)
                    )}
                  >
                    <span className="text-[8px] uppercase tracking-wider font-bold text-muted-foreground truncate">
                      {agent.label}
                    </span>
                    <p className="text-[10px] font-bold text-white truncate mt-1">{agent.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Console Terminal Output */}
        {logs.length > 0 && (
          <Card className="shadow-none border-slate-800 bg-black backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-slate-900 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Multi-Agent Audit Log Terminal
              </CardTitle>
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-slate-800 text-slate-400">
                Live Stream
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="bg-slate-950/40 rounded-xl p-4 font-mono text-[11px] leading-relaxed max-h-[30vh] overflow-y-auto space-y-2 border border-slate-900">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">[{log.timestamp.slice(11, 19)}]</span>
                    <span className="text-primary font-bold shrink-0">[{log.agent_name}]:</span>
                    <span className={getLogStatusClass(log.status)}>{log.message}</span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Output result */}
        {memoText && (
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3 border-b border-slate-850/60 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileText className="h- section-icon text-blue-450" /> Diligence Memo Generated
              </CardTitle>
              {finalMemoId && (
                <Link
                  href={`/memos/${finalMemoId}`}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                >
                  Open in Workspace <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="rounded-xl border border-slate-850 bg-slate-950/20 p-4 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                {memoText}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

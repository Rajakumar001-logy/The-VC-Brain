"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  Briefcase,
  ChevronRight,
  Compass,
  FileText,
  Loader2,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface DashboardMetrics {
  total_founders: number;
  top_founders: Array<{ name: string; company: string; score: number; trust: number }>;
  recent_applications: Array<{ name: string; sector: string; stage: string; valuation: number; created_at: string }>;
  pipeline_stages: Record<string, number>;
  pipeline_value: number;
  avg_conviction: number;
  active_deals_count: number;
  memos_count: number;
  founder_score_distribution: Record<string, number>;
  trust_score_distribution: Record<string, number>;
  recent_discoveries: Array<{ full_name: string; source_platform: string; calculated_score: number; outreach_status: string; created_at: string }>;
  recent_memos: Array<{ id: string; title: string; startup_name: string; status: string; recommendation: string; conviction: number; updated_at: string }>;
}

export default function DashboardPage() {
  // States
  const [stats, setStats] = React.useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await api.get<DashboardMetrics>("/api/v1/investors/dashboard");
        setStats(response);
      } catch (err) {
        console.warn("FastAPI offline, falling back to mock dashboard stats:", err);
        // Fallback mock dashboard compiler
        setStats({
          total_founders: 6,
          top_founders: [
            { name: "Marcus Chen", company: "GridOptima", score: 94, trust: 85 },
            { name: "Sarah Jenkins", company: "AeroAI", score: 88, trust: 80 },
            { name: "Elena Rostova", company: "arXiv Lead", score: 92, trust: 90 },
            { name: "Sophie Dubois", company: "LangOptima", score: 89, trust: 60 },
            { name: "David Kim", company: "HealthMatch", score: 72, trust: 75 },
          ],
          recent_applications: [
            { name: "GridOptima", sector: "Energy Infrastructure", stage: "diligence", valuation: 4500000, created_at: new Date().toISOString() },
            { name: "AeroAI", sector: "Aerospace Software", stage: "screening", valuation: 6000000, created_at: new Date().toISOString() },
          ],
          pipeline_stages: { sourcing: 1, screening: 1, diligence: 2, ic: 1, closed: 1 },
          pipeline_value: 1250000.0,
          avg_conviction: 72.5,
          active_deals_count: 6,
          memos_count: 2,
          founder_score_distribution: { "50-60": 0, "60-70": 1, "70-80": 2, "80-90": 2, "90-100": 1 },
          trust_score_distribution: { "0-20": 0, "20-40": 0, "40-60": 1, "60-80": 4, "80-100": 1 },
          recent_discoveries: [
            { full_name: "Elena Rostova", source_platform: "arXiv", calculated_score: 92.0, outreach_status: "draft", created_at: new Date().toISOString() },
            { full_name: "Sophie Dubois", source_platform: "Product Hunt", calculated_score: 89.0, outreach_status: "sent", created_at: new Date().toISOString() },
          ],
          recent_memos: [
            { id: "1", title: "NovaGrid Seed Lead", startup_name: "NovaGrid", status: "draft", recommendation: "invest", conviction: 82, updated_at: new Date().toISOString() },
          ],
        });
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Capitalize helpers
  const formatStage = (s: string) => {
    if (s === "ic") return "IC Review";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <DashboardShell
      title="Dashboard"
      description="Portfolio analytics and active deal flow pipelines"
      actions={
        <div className="flex gap-2">
          <Link
            href="/search"
            className={cn(buttonVariants({ variant: "outline" }), "h-9 text-xs")}
          >
            <Search className="h-3.5 w-3.5 mr-1.5" /> Semantic search
          </Link>
          <Link href="/memos" className={cn(buttonVariants(), "h-9 text-xs font-semibold text-white")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Draft memo
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Founders Tracked</span>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-white">{stats.total_founders}</div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                Profiles synchronized in vector store.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pipeline Value</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-white">{formatCurrency(stats.pipeline_value, true)}</div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                Estimated check size across active deals.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Memos Created</span>
              <FileText className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-white">{stats.memos_count}</div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                Avg AI conviction: <span className="font-bold text-white">{stats.avg_conviction.toFixed(0)}%</span>
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Deals</span>
              <Briefcase className="h-4 w-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-white">{stats.active_deals_count}</div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                Startups currently in pipelines.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Investment Pipeline Funnel */}
        <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-3 border-b border-slate-800/40">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-primary" /> Investment Pipeline stages
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-5 gap-2 relative">
              {["sourcing", "screening", "diligence", "ic", "closed"].map((stage, idx) => {
                const count = stats.pipeline_stages[stage] || 0;
                const colors = 
                  stage === "sourcing" ? "bg-slate-950/40 border-slate-800 text-slate-400" :
                  stage === "screening" ? "bg-blue-500/5 border-blue-500/20 text-blue-400" :
                  stage === "diligence" ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-400" :
                  stage === "ic" ? "bg-orange-500/5 border-orange-500/20 text-orange-400" :
                  "bg-emerald-500/5 border-emerald-500/20 text-emerald-400";
                
                return (
                  <div
                    key={stage}
                    className={cn(
                      "rounded-xl border p-4 text-center space-y-1.5 transition-all flex flex-col justify-center",
                      colors
                    )}
                  >
                    <span className="text-[9px] uppercase tracking-wider font-extrabold truncate">
                      {stage === "ic" ? "IC Review" : stage}
                    </span>
                    <p className="text-2xl font-black text-white">{count}</p>
                    {idx < 4 && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-[calc(80%-10px)] hidden md:block">
                        <ChevronRight className="h-4 w-4 text-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Distributions Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Founder Score Distribution */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> Founder Score Distribution
              </CardTitle>
              <CardDescription>Frequency of calculate ratings among active profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2 text-xs">
              {Object.entries(stats.founder_score_distribution).map(([band, count]) => {
                const total = Object.values(stats.founder_score_distribution).reduce((a, b) => a + b, 0) || 1;
                const percentage = (count / total) * 100;
                
                return (
                  <div key={band} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-300">
                      <span>{band} Score range</span>
                      <span className="text-white">{count} founders ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Trust Score Distribution */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Trust Score Distribution
              </CardTitle>
              <CardDescription>Frequency of verifications among active profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2 text-xs">
              {Object.entries(stats.trust_score_distribution).map(([band, count]) => {
                const total = Object.values(stats.trust_score_distribution).reduce((a, b) => a + b, 0) || 1;
                const percentage = (count / total) * 100;
                
                return (
                  <div key={band} className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-300">
                      <span>{band} Trust range</span>
                      <span className="text-white">{count} founders ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-850 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Catalogs (Top Scored & Crawled Leads) */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Scored Founders */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> Top Rated Founders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-2">
              {stats.top_founders.map((f, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-950/20 rounded-xl border border-slate-850/60 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.company}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-slate-800 text-primary border-none font-bold text-[10px] px-2">
                      Score: {f.score.toFixed(0)}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/5 font-bold text-[10px] px-2">
                      Trust: {f.trust.toFixed(0)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Lead Discoveries */}
          <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Radar className="h-4 w-4 text-primary animate-pulse" /> Recent Lead Discoveries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-2">
              {stats.recent_discoveries.length > 0 ? (
                stats.recent_discoveries.map((d, idx) => (
                  <Link key={idx} href="/discovery" className="block hover:opacity-95 transition-opacity">
                    <div className="flex justify-between items-center p-3 bg-slate-950/20 rounded-xl border border-slate-850/60 text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-white">{d.full_name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-slate-800 text-slate-400 capitalize">
                            {d.source_platform}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-slate-800 text-primary font-bold text-[10px]">
                          {d.calculated_score.toFixed(0)}
                        </Badge>
                        {d.outreach_status === "sent" ? (
                          <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">SENT</span>
                        ) : (
                          <span className="text-[9px] text-amber-500 font-extrabold uppercase tracking-wider">DRAFT</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-10 border border-dashed border-slate-850 rounded-xl bg-slate-950/10 text-xs text-muted-foreground space-y-2">
                  <p>No discovery leads crawled yet.</p>
                  <Link href="/discovery" className="text-primary hover:underline">Go to Discovery</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Content Feeds (Memos & Applications) */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Recent Investment Memos */}
          <div className="md:col-span-2">
            <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl h-full">
              <CardHeader className="pb-3 border-b border-slate-850/60">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-400" /> Recent Memos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {stats.recent_memos.length > 0 ? (
                  stats.recent_memos.map((m) => (
                    <Link key={m.id} href={`/memos/${m.id}`} className="block group">
                      <div className="p-3.5 rounded-xl border border-slate-850 bg-slate-950/20 space-y-2 hover:border-primary transition-all text-xs">
                        <div className="flex justify-between items-start gap-3">
                          <p className="font-bold text-white group-hover:text-primary transition-colors truncate">{m.title}</p>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-slate-800 font-bold capitalize text-slate-400">
                            {m.recommendation}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-slate-850/40">
                          <span>Startup: <span className="font-semibold text-slate-350">{m.startup_name}</span></span>
                          <span className="flex items-center gap-2">
                            <span>Conviction: <span className="font-bold text-primary">{m.conviction}%</span></span>
                            <span>·</span>
                            <span>{new Date(m.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No investment memos drafted yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Startup Applications */}
          <div className="md:col-span-1">
            <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl h-full">
              <CardHeader className="pb-3 border-b border-slate-850/60">
                <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-indigo-400" /> Recent Pipelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {stats.recent_applications.map((app, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-850 bg-slate-950/20 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <p className="font-bold text-white truncate">{app.name}</p>
                      <Badge variant="secondary" className="bg-slate-800 text-indigo-400 border-none font-bold text-[8px] uppercase tracking-wider py-0 px-1.5">
                        {formatStage(app.stage)}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{app.sector}</p>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-slate-850/30">
                      <span>Valuation</span>
                      <span className="font-bold text-slate-350">{formatCurrency(app.valuation, true)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

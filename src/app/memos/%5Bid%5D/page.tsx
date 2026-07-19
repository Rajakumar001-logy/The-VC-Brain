"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, riskLabel } from "@/lib/format";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { memos as mockMemos } from "@/lib/mock-data";

interface MemoPageProps {
  params: Promise<{ id: string }>;
}

interface MemoMetadata {
  ai_partner_generated?: boolean;
  confidence_score?: number;
  strengths?: string[];
  weaknesses?: string[];
  institutional_memo?: string;
}

interface MemoRecord {
  id: string;
  startupId: string;
  startupName: string;
  title: string;
  author: string;
  status: string;
  recommendation: string;
  conviction: number;
  riskLevel: string;
  summary: string;
  thesis: string;
  market: string;
  team: string;
  product: string;
  risks: string[];
  askAmount: number;
  proposedOwnership: number;
  metadata?: MemoMetadata;
}

export default function MemoDetailPage({ params }: MemoPageProps) {
  // Safe param unwrapping for client component params prop
  const paramsResolved = React.use(params);
  const id = paramsResolved.id;

  // States
  const [memo, setMemo] = React.useState<MemoRecord | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadMemo() {
      try {
        // Try fetching live memo from FastAPI DB
        const liveMemo = await api.get<MemoRecord>(`/api/v1/memos/${id}`);
        setMemo(liveMemo);
      } catch (err) {
        console.warn("Live memo fetch failed, falling back to mock data:", err);
        // Fallback to mock data
        const mockMemo = mockMemos.find((m) => m.id === id);
        if (mockMemo) {
          setMemo(mockMemo as unknown as MemoRecord);
        } else {
          toast.error("Investment memo not found.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadMemo();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!memo) {
    return (
      <DashboardShell title="Memo Not Found">
        <div className="text-center py-10">
          <p className="text-slate-400">The requested investment memo could not be located.</p>
          <Link href="/memos" className="mt-4 inline-flex items-center gap-1.5 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const isAIPartnerMemo = memo.metadata?.ai_partner_generated || false;
  const institutionalMemoMarkdown = memo.metadata?.institutional_memo || "";

  const sections = [
    { title: "Investment thesis", body: memo.thesis },
    { title: "Market", body: memo.market },
    { title: "Team", body: memo.team },
    { title: "Product", body: memo.product },
  ];

  const statusVariant: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
  > = {
    approved: "default",
    review: "secondary",
    draft: "outline",
    archived: "destructive",
  };

  return (
    <DashboardShell
      title="Investment Memo"
      description={memo.startupName}
      actions={
        <Link
          href="/memos"
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <ArrowLeft className="size-4" />
          All memos
        </Link>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant={statusVariant[memo.status] || "default"}>
                {memo.status}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {memo.recommendation}
              </Badge>
              {memo.riskLevel && (
                <Badge variant="outline">Risk: {riskLabel(memo.riskLevel)}</Badge>
              )}
              {isAIPartnerMemo && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold uppercase tracking-wider">
                  AI Partner Certified
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl font-extrabold text-white tracking-tight">
              {memo.title}
            </CardTitle>
            <CardDescription className="text-slate-350">
              Authored by {memo.author} · Ask {formatCurrency(memo.ask_amount || memo.askAmount || 500000)} for{" "}
              {memo.proposed_ownership || memo.proposedOwnership || 8.0}% ownership
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conviction rating</p>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={memo.conviction} className="h-2 flex-1 bg-slate-850" />
                <span className="text-sm font-bold text-white tabular-nums">
                  {memo.conviction}%
                </span>
              </div>
            </div>

            <Separator className="border-slate-850" />

            {isAIPartnerMemo && institutionalMemoMarkdown ? (
              /* Premium Institutional Memo Markdown renderer */
              <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-6">
                <div className="bg-slate-950/20 rounded-xl p-6 border border-slate-850 space-y-6 whitespace-pre-wrap font-sans">
                  {institutionalMemoMarkdown}
                </div>
              </div>
            ) : (
              /* Regular structured sections */
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Executive summary
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{memo.summary}</p>
                </div>

                {sections.map((section) => (
                  <div key={section.title}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{section.body}</p>
                  </div>
                ))}

                {memo.risks && memo.risks.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Key risks
                    </h2>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                      {memo.risks.map((risk: string) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

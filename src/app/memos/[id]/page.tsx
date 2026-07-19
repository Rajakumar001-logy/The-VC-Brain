import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { memos } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface MemoPageProps {
  params: Promise<{ id: string }>;
}

export default async function MemoDetailPage({ params }: MemoPageProps) {
  const { id } = await params;
  const memo = memos.find((m) => m.id === id);

  if (!memo) {
    notFound();
  }

  const sections = [
    { title: "Investment thesis", body: memo.thesis },
    { title: "Market", body: memo.market },
    { title: "Team", body: memo.team },
    { title: "Product", body: memo.product },
  ];

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
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge>{memo.status}</Badge>
              <Badge variant="secondary">{memo.recommendation}</Badge>
              <Badge variant="outline">Risk: {riskLabel(memo.riskLevel)}</Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">{memo.title}</CardTitle>
            <CardDescription>
              Authored by {memo.author} · Ask {formatCurrency(memo.askAmount)} for{" "}
              {memo.proposedOwnership}% ownership
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium">Conviction</p>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={memo.conviction} className="h-2.5 flex-1" />
                <span className="text-sm font-semibold tabular-nums">
                  {memo.conviction}%
                </span>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Executive summary
              </h2>
              <p className="mt-2 text-sm leading-relaxed">{memo.summary}</p>
            </div>

            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed">{section.body}</p>
              </div>
            ))}

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Key risks
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {memo.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, riskLabel } from "@/lib/format";
import { memos } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  approved: "default",
  review: "secondary",
  draft: "outline",
  archived: "destructive",
};

const recommendationLabel = {
  invest: "Invest",
  pass: "Pass",
  watch: "Watch",
};

export default function MemosPage() {
  return (
    <DashboardShell
      title="Investment Memos"
      description="IC-ready writeups and screening notes"
      actions={
        <Button>
          <Plus className="size-4" />
          Draft memo
        </Button>
      }
    >
      <div className="grid gap-4">
        {memos.map((memo) => (
          <Card key={memo.id} className="shadow-none">
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant[memo.status]}>{memo.status}</Badge>
                  <Badge variant="outline">{recommendationLabel[memo.recommendation]}</Badge>
                  <Badge variant="outline">Risk: {riskLabel(memo.riskLevel)}</Badge>
                </div>
                <CardTitle className="text-lg">
                  <Link href={`/memos/${memo.id}`} className="hover:underline">
                    {memo.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {memo.startupName} · by {memo.author} · updated{" "}
                  {formatDistanceToNow(new Date(memo.updatedAt), { addSuffix: true })}
                </CardDescription>
              </div>
              <Link
                href={`/memos/${memo.id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Open memo
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {memo.summary}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Conviction</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={memo.conviction} className="h-2 flex-1" />
                    <span className="text-sm font-medium tabular-nums">
                      {memo.conviction}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ask</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatCurrency(memo.askAmount, true)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proposed ownership</p>
                  <p className="mt-1 text-sm font-medium">{memo.proposedOwnership}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}

import { FileText, MessageSquare, NotebookPen, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { recentActivity } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";

const icons = {
  memo: FileText,
  meeting: MessageSquare,
  score: Sparkles,
  note: NotebookPen,
};

export function ActivityFeed() {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Latest updates across the desk</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentActivity.map((item) => {
          const Icon = icons[item.type];
          return (
            <div key={item.id} className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

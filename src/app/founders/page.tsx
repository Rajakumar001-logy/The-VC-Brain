import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { founders, startups } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function FoundersPage() {
  return (
    <DashboardShell
      title="Founders"
      description="People behind the companies in your pipeline"
      actions={
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Find similar founders
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {founders.map((founder) => {
          const company = startups.find((s) => s.name === founder.company);
          return (
            <Card key={founder.id} className="shadow-none">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <Avatar className="size-11">
                  <AvatarFallback>{initials(founder.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">
                    <Link href={`/founders/${founder.id}`} className="hover:text-primary hover:underline transition-all">
                      {founder.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {founder.role} · {founder.company}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {founder.bio}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {founder.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Experience</p>
                    <p className="mt-0.5 font-medium">{founder.yearsExperience} yrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prior exits</p>
                    <p className="mt-0.5 font-medium">{founder.previousExits}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Education</p>
                    <p className="mt-0.5 font-medium">{founder.education.join(" · ")}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="size-3.5 shrink-0" />
                    {founder.email}
                  </span>
                  {company && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <MapPin className="size-3.5" />
                      {company.location.split(",")[0]}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </DashboardShell>
  );
}

"use client";

import { Bell, Menu, Search } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  description?: string;
  onMenuClick?: () => void;
}

export function AppHeader({ title, description, onMenuClick }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Open sidebar"
        >
          <Menu className="size-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold md:text-base">{title}</h1>
          {description && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {description}
            </p>
          )}
        </div>

        <Link
          href="/search"
          className="hidden h-9 max-w-xs flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex lg:max-w-sm"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">Search deals, founders, memos...</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/memos"
            aria-label="Notifications"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <Bell className="size-4" />
          </Link>
          <ThemeToggle />
          <Avatar className="ml-1 size-8">
            <AvatarFallback className="text-xs">AR</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

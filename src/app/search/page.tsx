"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, FileText, Search, User, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchResults } from "@/lib/mock-data";
import { api } from "@/lib/api";
import type { SearchResult } from "@/types";

const typeIcon = {
  startup: Building2,
  founder: User,
  memo: FileText,
  document: FileText,
};

export default function SearchPage() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>(searchResults);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sampleQueries = [
    "Find AI founders in Europe.",
    "Show technical founders without VC funding.",
    "Find founders with strong GitHub activity.",
    "Find enterprise SaaS startups with revenue.",
  ];

  async function executeSearch(qString: string) {
    const q = qString.trim();
    if (!q) {
      setResults(searchResults);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.post<{ results: SearchResult[] }>("/api/v1/search", {
        query: q,
        limit: 10,
      });
      setResults(data.results);
    } catch {
      // Fallback filter
      const filtered = searchResults.filter(
        (r) =>
          r.title.toLowerCase().includes(q.toLowerCase()) ||
          r.snippet.toLowerCase().includes(q.toLowerCase()) ||
          r.subtitle.toLowerCase().includes(q.toLowerCase())
      );
      setResults(filtered.length ? filtered : searchResults);
      setError("FastAPI server offline — showing simulated semantic matches.");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch(query);
  }

  function handleQuerySuggestionClick(suggestion: string) {
    setQuery(suggestion);
    executeSearch(suggestion);
  }

  return (
    <DashboardShell
      title="Search"
      description="Vector search across startups, founders, and memos"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Glassmorphic Search Input Box */}
        <Card className="shadow-none border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> AI Semantic Search
            </CardTitle>
            <CardDescription>
              Query the platform databases in natural language using vector embeddings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question or enter keywords..."
                  className="h-10 pl-9 border-slate-800 bg-slate-950/20 text-white"
                />
              </div>
              <Button type="submit" disabled={loading} className="h-10 px-6 shrink-0 bg-primary text-primary-foreground font-semibold">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </form>

            {/* Suggestions Chips List */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Example queries</span>
              <div className="flex flex-wrap gap-1.5">
                {sampleQueries.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleQuerySuggestionClick(suggestion)}
                    className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-1.5 text-xs text-slate-350 hover:bg-slate-850 hover:text-white transition-all text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-2 text-xs text-amber-500 font-medium">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Results List */}
        <div className="space-y-3">
          {results.length > 0 ? (
            results.map((result) => {
              const Icon = typeIcon[result.type] || FileText;
              
              // Similarity border styling
              const matchScore = result.score * 100;
              const cardBorder =
                matchScore >= 80
                  ? "border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04]"
                  : matchScore >= 60
                  ? "border-blue-500/20 bg-blue-500/[0.02] hover:bg-blue-500/[0.04]"
                  : "border-slate-850 bg-slate-950/10 hover:bg-slate-950/20";

              return (
                <Link key={result.id} href={result.href} className="block group">
                  <Card className={`shadow-none transition-all duration-300 border ${cardBorder}`}>
                    <CardContent className="flex gap-4 p-4">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800">
                        <Icon className="size-4.5 text-slate-400 group-hover:text-primary transition-colors" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white text-sm group-hover:text-primary transition-colors">
                            {result.title}
                          </p>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-slate-800">
                            {result.type}
                          </Badge>
                          {result.score > 0 && (
                            <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0 border-none bg-slate-800 text-emerald-400">
                              {matchScore.toFixed(0)}% match
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          {result.subtitle}
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed pt-1.5">
                          {result.snippet}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950/10 text-xs text-muted-foreground">
              No matching records found. Try adjusting your search query.
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

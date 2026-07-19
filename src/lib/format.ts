import type { DealStage } from "@/types";

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function stageLabel(stage: DealStage): string {
  const labels: Record<DealStage, string> = {
    sourcing: "Sourcing",
    screening: "Screening",
    due_diligence: "Due Diligence",
    term_sheet: "Term Sheet",
    closed: "Closed",
    passed: "Passed",
  };
  return labels[stage];
}

export function riskLabel(risk: string): string {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

export function stageBadgeVariant(
  stage: DealStage,
): "default" | "secondary" | "outline" | "destructive" {
  switch (stage) {
    case "term_sheet":
    case "closed":
      return "default";
    case "due_diligence":
      return "secondary";
    case "passed":
      return "destructive";
    default:
      return "outline";
  }
}

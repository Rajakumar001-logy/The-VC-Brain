export type DealStage =
  | "sourcing"
  | "screening"
  | "due_diligence"
  | "term_sheet"
  | "closed"
  | "passed";

export type RiskLevel = "low" | "medium" | "high";

export interface Founder {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  avatarUrl?: string;
  linkedinUrl?: string;
  bio: string;
  previousExits: number;
  yearsExperience: number;
  education: string[];
  skills: string[];
  currentFounderScore?: number;
  currentTrustScore?: number;
  createdAt: string;
}

export interface Startup {
  id: string;
  name: string;
  tagline: string;
  sector: string;
  stage: DealStage;
  location: string;
  foundedYear: number;
  website?: string;
  fundingRaised: number;
  valuation: number;
  employeeCount: number;
  founderIds: string[];
  description: string;
  traction: string;
  createdAt: string;
}

export interface InvestmentMemo {
  id: string;
  startupId: string;
  startupName: string;
  title: string;
  author: string;
  status: "draft" | "review" | "approved" | "archived";
  recommendation: "invest" | "pass" | "watch";
  conviction: number;
  riskLevel: RiskLevel;
  summary: string;
  thesis: string;
  market: string;
  team: string;
  product: string;
  risks: string[];
  askAmount: number;
  proposedOwnership: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  id: string;
  type: "startup" | "founder" | "memo" | "document";
  title: string;
  subtitle: string;
  snippet: string;
  score: number;
  href: string;
}

export interface DashboardStats {
  activeDeals: number;
  pipelineValue: number;
  memosThisMonth: number;
  foundersTracked: number;
  avgConviction: number;
  closedDealsYtd: number;
}

export interface PipelineItem {
  id: string;
  name: string;
  sector: string;
  stage: DealStage;
  amount: number;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  type: "memo" | "meeting" | "score" | "note";
  title: string;
  description: string;
  timestamp: string;
}

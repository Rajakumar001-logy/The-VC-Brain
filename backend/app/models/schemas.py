from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class DealStage(str, Enum):
    sourcing = "sourcing"
    screening = "screening"
    due_diligence = "due_diligence"
    term_sheet = "term_sheet"
    closed = "closed"
    passed = "passed"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Founder(BaseModel):
    id: str
    name: str
    email: str
    role: str
    company: str
    bio: str
    previous_exits: int = 0
    years_experience: int = 0
    education: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    created_at: datetime | None = None


class Startup(BaseModel):
    id: str
    name: str
    tagline: str
    sector: str
    stage: DealStage
    location: str
    founded_year: int
    funding_raised: float = 0
    valuation: float = 0
    employee_count: int = 0
    founder_ids: list[str] = Field(default_factory=list)
    description: str
    traction: str
    created_at: datetime | None = None


class InvestmentMemo(BaseModel):
    id: str
    startup_id: str
    startup_name: str
    title: str
    author: str
    status: Literal["draft", "review", "approved", "archived"]
    recommendation: Literal["invest", "pass", "watch"]
    conviction: int
    risk_level: RiskLevel
    summary: str
    thesis: str
    market: str
    team: str
    product: str
    risks: list[str]
    ask_amount: float
    proposed_ownership: float
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SearchResult(BaseModel):
    id: str
    type: Literal["startup", "founder", "memo", "document"]
    title: str
    subtitle: str
    snippet: str
    score: float
    href: str


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


class GenerateMemoRequest(BaseModel):
    startup_id: str
    notes: str | None = None


class MemoDraft(BaseModel):
    summary: str
    thesis: str
    market: str
    team: str
    product: str
    risks: list[str]
    recommendation: Literal["invest", "pass", "watch"]
    conviction: int


class MemoGenerateResponse(BaseModel):
    startup_id: str
    draft: MemoDraft


class DocumentChunk(BaseModel):
    id: str
    source_type: str
    source_id: str
    title: str
    content: str
    metadata: dict = Field(default_factory=dict)


class InvestorRole(str, Enum):
    admin = "admin"
    partner = "partner"
    principal = "principal"
    associate = "associate"
    analyst = "analyst"
    ops = "ops"
    viewer = "viewer"


class InvestorProfile(BaseModel):
    id: str
    auth_user_id: str | None = None
    email: str
    full_name: str
    role: InvestorRole
    firm_name: str | None = None
    title: str | None = None
    avatar_url: str | None = None
    is_active: bool = True
    bio: str | None = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class InvestorUpdate(BaseModel):
    full_name: str | None = None
    title: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


class InvestorRoleUpdate(BaseModel):
    role: InvestorRole


class PitchDeckAnalysis(BaseModel):
    founder: str
    market: str
    problem: str
    solution: str
    business_model: str
    competition: str
    revenue: str
    traction: str
    go_to_market: str
    team: str
    financials: str
    risks: str


class PitchDeckResponse(BaseModel):
    id: str
    company_id: str | None = None
    title: str
    extracted_text: str | None = None
    ai_summary: str | None = None
    analysis: PitchDeckAnalysis
    created_at: datetime | None = None


class AddMemoryRequest(BaseModel):
    title: str
    body: str
    observed_at: datetime | None = None
    source_kind: str = "manual"
    confidence: float = 1.0


class MemoryResponse(BaseModel):
    id: str
    title: str
    body: str
    observed_at: datetime | None = None
    source_kind: str
    similarity: float | None = None


class FounderTimelineEvent(BaseModel):
    type: Literal["memory", "score"]
    timestamp: datetime
    title: str
    description: str
    metadata: dict = Field(default_factory=dict)


class SemanticQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)


class ScoreDimensionDetail(BaseModel):
    score: float
    explanation: str


class FounderScoreBreakdown(BaseModel):
    technical: ScoreDimensionDetail
    business: ScoreDimensionDetail
    execution: ScoreDimensionDetail
    innovation: ScoreDimensionDetail
    risk: ScoreDimensionDetail
    dimensions_breakdown: dict[str, str]


class ScoreEvaluationResponse(BaseModel):
    overall_score: float
    overall_explanation: str
    breakdown: FounderScoreBreakdown
    scored_at: datetime


class TrustClaimDetail(BaseModel):
    claim_type: str
    claim_value: str
    evidence_text: str
    source: str
    confidence: float
    status: str


class TrustEvaluationResponse(BaseModel):
    trust_score: float
    rationale: str
    claims: list[TrustClaimDetail]
    evaluated_at: datetime


class VerifyClaimRequest(BaseModel):
    claim_type: str
    status: str


class PartnerEvaluationRequest(BaseModel):
    startup_id: str


class PartnerEvaluationResponse(BaseModel):
    recommendation_status: str
    confidence_score: float
    reasoning: str
    strengths: list[str]
    weaknesses: list[str]
    risks: list[str]
    funding_recommendation: str
    founder_analysis: str
    market_analysis: str
    product_analysis: str
    competition_analysis: str
    institutional_memo: str


class SaveMemoRequest(BaseModel):
    startup_id: str
    evaluation: PartnerEvaluationResponse


class DiscoveredFounder(BaseModel):
    id: str
    full_name: str
    email: str | None = None
    source_platform: str
    platform_profile_url: str | None = None
    bio: str | None = None
    skills: list[str]
    calculated_score: float
    outreach_email: str | None = None
    outreach_status: str
    created_at: datetime


class DiscoveryScanRequest(BaseModel):
    threshold: float


class DiscoveryScanResponse(BaseModel):
    scanned_count: int
    discovered: list[DiscoveredFounder]


class OutreachStatusRequest(BaseModel):
    status: str
    email_body: str








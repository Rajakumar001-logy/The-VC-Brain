"""In-memory seed data used when Supabase is not configured."""

from datetime import datetime, timezone

from app.models.schemas import (
    DealStage,
    Founder,
    InvestmentMemo,
    RiskLevel,
    Startup,
)


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


FOUNDERS: list[Founder] = [
    Founder(
        id="f1",
        name="Priya Shah",
        email="priya@novagrid.io",
        role="CTO & Co-founder",
        company="NovaGrid",
        bio="Former Tesla energy systems lead. Built grid optimization platforms at scale.",
        previous_exits=1,
        years_experience=14,
        education=["Stanford MS EE", "IIT Bombay BTech"],
        skills=["Energy systems", "ML ops", "Hardware"],
        created_at=_dt("2026-01-12T00:00:00Z"),
    ),
    Founder(
        id="f2",
        name="Marcus Chen",
        email="marcus@lattice.ai",
        role="CEO & Founder",
        company="Lattice AI",
        bio="Ex-Google Brain. Two-time founder with a prior $180M acquisition.",
        previous_exits=1,
        years_experience=12,
        education=["MIT PhD CS", "Berkeley BS"],
        skills=["LLMs", "Enterprise sales", "Product"],
        created_at=_dt("2026-02-03T00:00:00Z"),
    ),
    Founder(
        id="f3",
        name="Elena Vargas",
        email="elena@harbor.health",
        role="CEO",
        company="Harbor Health",
        bio="Physician-founder. Built clinical workflows used by 40+ health systems.",
        previous_exits=0,
        years_experience=16,
        education=["Harvard MD", "Yale BA"],
        skills=["Clinical ops", "FHIR", "Go-to-market"],
        created_at=_dt("2026-03-21T00:00:00Z"),
    ),
]

STARTUPS: list[Startup] = [
    Startup(
        id="s1",
        name="NovaGrid",
        tagline="AI-native grid optimization for utilities",
        sector="Climate Tech",
        stage=DealStage.due_diligence,
        location="San Francisco, CA",
        founded_year=2023,
        funding_raised=4_200_000,
        valuation=42_000_000,
        employee_count=28,
        founder_ids=["f1"],
        description=(
            "NovaGrid helps utilities reduce curtailment and peak load costs "
            "with real-time ML forecasting."
        ),
        traction="$2.1M ARR · 6 utility LOIs · 94% retention",
        created_at=_dt("2026-01-12T00:00:00Z"),
    ),
    Startup(
        id="s2",
        name="Lattice AI",
        tagline="Enterprise agents that ship production workflows",
        sector="Enterprise AI",
        stage=DealStage.term_sheet,
        location="New York, NY",
        founded_year=2022,
        funding_raised=18_000_000,
        valuation=120_000_000,
        employee_count=64,
        founder_ids=["f2"],
        description=(
            "Lattice builds secure agent infrastructure for Fortune 500 "
            "knowledge work automation."
        ),
        traction="$9.4M ARR · 22 enterprise logos · NDR 142%",
        created_at=_dt("2026-02-03T00:00:00Z"),
    ),
    Startup(
        id="s3",
        name="Harbor Health",
        tagline="Ambient clinical documentation for hospitals",
        sector="HealthTech",
        stage=DealStage.screening,
        location="Boston, MA",
        founded_year=2024,
        funding_raised=1_800_000,
        valuation=18_000_000,
        employee_count=19,
        founder_ids=["f3"],
        description=(
            "Harbor reduces physician documentation burden with specialty-tuned ambient AI."
        ),
        traction="3 health systems live · 40% time saved · SOC2 in progress",
        created_at=_dt("2026-03-21T00:00:00Z"),
    ),
]

MEMOS: list[InvestmentMemo] = [
    InvestmentMemo(
        id="m1",
        startup_id="s2",
        startup_name="Lattice AI",
        title="Series A Investment Memo — Lattice AI",
        author="Alex Rivera",
        status="approved",
        recommendation="invest",
        conviction=86,
        risk_level=RiskLevel.medium,
        summary="Lattice is emerging as a category leader in enterprise agent infrastructure.",
        thesis="Enterprises will consolidate on a secure agent runtime layer.",
        market="TAM ~$48B by 2030 across enterprise automation.",
        team="Repeat founder with prior exit and deep technical bench.",
        product="Differentiated eval harness and VPC deployment.",
        risks=["Hyperscaler platform risk", "Long sales cycles"],
        ask_amount=12_000_000,
        proposed_ownership=12.5,
        created_at=_dt("2026-06-01T00:00:00Z"),
        updated_at=_dt("2026-07-10T00:00:00Z"),
    ),
    InvestmentMemo(
        id="m2",
        startup_id="s1",
        startup_name="NovaGrid",
        title="Seed Extension Memo — NovaGrid",
        author="Sam Okada",
        status="review",
        recommendation="invest",
        conviction=74,
        risk_level=RiskLevel.medium,
        summary="NovaGrid shows clear product-market fit with utilities.",
        thesis="Grid volatility creates urgent demand for forecasting software.",
        market="US utility software spend growing mid-teens.",
        team="Strong domain expertise from Tesla Energy.",
        product="Real-time forecasting with measurable curtailment reduction.",
        risks=["Long utility procurement cycles", "Integration complexity"],
        ask_amount=8_000_000,
        proposed_ownership=15,
        created_at=_dt("2026-06-20T00:00:00Z"),
        updated_at=_dt("2026-07-16T00:00:00Z"),
    ),
]

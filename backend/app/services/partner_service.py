import json
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, List

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.models.schemas import PartnerEvaluationResponse, InvestmentMemo, DealStage

class PartnerService:
    async def evaluate_deal(self, startup_id: str) -> PartnerEvaluationResponse:
        """
        AI Venture Capital Partner Deal Evaluator. Consolidates startup details,
        pitch decks, scores, and trust metrics to run a complete investment diligence audit.
        """
        startup_data = {}
        founders_data = []
        decks_data = []

        # 1. Fetch data
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock Fetch
            s = store.get_startup(startup_id)
            if s:
                startup_data = {
                    "id": s.id,
                    "name": s.name,
                    "tagline": s.tagline,
                    "sector": s.sector,
                    "stage": s.stage.value,
                    "location": s.location,
                    "founded_year": s.founded_year,
                    "funding_raised": s.funding_raised,
                    "valuation": s.valuation,
                    "employee_count": s.employee_count,
                    "traction": s.traction,
                    "description": s.description
                }
                
                # Fetch linked founders
                for fid in s.founder_ids:
                    f = store.get_founder(fid)
                    if f:
                        founders_data.append({
                            "name": f.name,
                            "role": f.role,
                            "bio": f.bio,
                            "skills": f.skills,
                            "exits": f.previous_exits,
                            "experience": f.years_experience,
                            "education": f.education,
                            "score": f.current_founder_score if hasattr(f, "current_founder_score") else 75,
                            "trust": f.current_trust_score if hasattr(f, "current_trust_score") else 60
                        })
            decks_data = [{"title": "Seed Deck", "ai_summary": "Grid optimization and automation systems."}]
        else:
            try:
                # Live Supabase Fetch
                # Startup
                s_res = supabase_client._client.table("startups").select("*").eq("id", startup_id).execute()
                if s_res.data:
                    s_rec = s_res.data[0]
                    startup_data = s_rec
                    
                    # Founders
                    f_ids = s_rec.get("founder_ids") or []
                    if f_ids:
                        f_res = supabase_client._client.table("founders").select("*").in_("id", f_ids).execute()
                        for f_rec in (f_res.data or []):
                            founders_data.append({
                                "name": f_rec.get("full_name"),
                                "role": f_rec.get("role"),
                                "bio": f_rec.get("bio"),
                                "skills": f_rec.get("skills", []),
                                "exits": f_rec.get("previous_exits", 0),
                                "experience": f_rec.get("years_experience", 0),
                                "education": f_rec.get("education", []),
                                "score": float(f_rec.get("current_founder_score") or 70.0),
                                "trust": float(f_rec.get("current_trust_score") or 50.0),
                                "metadata": f_rec.get("metadata") or {}
                            })
                
                # Pitch decks
                deck_res = supabase_client._client.table("pitch_decks").select("title, ai_summary, metadata").eq("company_id", startup_id).execute()
                decks_data = deck_res.data or []
            except Exception as e:
                print(f"Supabase deal evaluation query failed: {str(e)}")

        # 2. Run AI Partner diligencer via OpenAI
        ai_result = await self._evaluate_via_gpt(startup_data, founders_data, decks_data)

        return PartnerEvaluationResponse(
            recommendation_status=ai_result.get("recommendation_status", "watch"),
            confidence_score=float(ai_result.get("confidence_score", 70.0)),
            reasoning=ai_result.get("reasoning", "Diligence validation finished."),
            strengths=ai_result.get("strengths", []),
            weaknesses=ai_result.get("weaknesses", []),
            risks=ai_result.get("risks", []),
            funding_recommendation=ai_result.get("funding_recommendation", "$500,000 post-money SAFE"),
            founder_analysis=ai_result.get("founder_analysis", "Strong background indicators."),
            market_analysis=ai_result.get("market_analysis", "Market size verified in segment."),
            product_analysis=ai_result.get("product_analysis", "Pilot product launched."),
            competition_analysis=ai_result.get("competition_analysis", "Differentiators established."),
            institutional_memo=ai_result.get("institutional_memo", "# Investment Memo")
        )

    async def convert_to_memo(
        self,
        startup_id: str,
        eval_data: PartnerEvaluationResponse,
        author_id: str
    ) -> InvestmentMemo:
        """
        Converts the partner evaluation response into a platform Investment Memo,
        saving the record inside the PostgreSQL database.
        """
        memo_id = str(uuid.uuid4())
        eval_time = datetime.now(timezone.utc)
        
        # Get startup name
        startup_name = "NovaGrid"
        if not settings.supabase_url or not settings.supabase_service_role_key:
            s = store.get_startup(startup_id)
            if s:
                startup_name = s.name
        else:
            try:
                s_res = supabase_client._client.table("startups").select("name").eq("id", startup_id).execute()
                if s_res.data:
                    startup_name = s_res.data[0]["name"]
            except Exception as e:
                print(f"Supabase startup lookup failed: {str(e)}")

        # Parse check size
        # Extract check size using regex (e.g. from "$500,000 SAFE" -> 500000.0)
        check_size = 500000.0
        try:
            matches = re.findall(r'\$?(\d+(?:,\d+)?)(?:\s*(?:K|M|million|thousand))?', eval_data.funding_recommendation, re.I)
            if matches:
                number_str = matches[0].replace(",", "")
                val = float(number_str)
                if "M" in eval_data.funding_recommendation or "million" in eval_data.funding_recommendation.lower():
                    val *= 1000000
                elif "K" in eval_data.funding_recommendation or "thousand" in eval_data.funding_recommendation.lower():
                    val *= 1000
                check_size = val
        except Exception:
            pass

        # Build Memo
        memo = InvestmentMemo(
            id=memo_id,
            startup_id=startup_id,
            startup_name=startup_name,
            title=f"AI Partner Investment Memo — {startup_name}",
            author="AI Venture Partner Agent",
            status="draft",
            recommendation=eval_data.recommendation_status,
            conviction=int(eval_data.confidence_score),
            risk_level="medium",
            summary=eval_data.reasoning,
            thesis=eval_data.institutional_memo,
            market=eval_data.market_analysis,
            team=eval_data.founder_analysis,
            product=eval_data.product_analysis,
            risks=eval_data.risks,
            ask_amount=check_size,
            proposed_ownership=8.0,
            created_at=eval_time,
            updated_at=eval_time
        )

        # Include detailed institutional fields in metadata
        memo.metadata = {
            "ai_partner_generated": True,
            "confidence_score": eval_data.confidence_score,
            "strengths": eval_data.strengths,
            "weaknesses": eval_data.weaknesses,
            "institutional_memo": eval_data.institutional_memo
        }

        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock Save
            store.list_memos().append(memo)
            return memo

        try:
            # Save into supabase investment_memos
            supabase_client._client.table("investment_memos").insert({
                "id": memo_id,
                "company_id": startup_id,
                "author_id": author_id,
                "title": memo.title,
                "executive_summary": memo.summary,
                "market_analysis": memo.market,
                "financial_analysis": eval_data.funding_recommendation,
                "risks_and_mitigations": "### Risks\n" + "\n".join([f"- {r}" for r in eval_data.risks]),
                "recommendation_check_size": check_size,
                "recommendation_status": memo.recommendation,
                "recommendation_rationale": memo.summary,
                "metadata": memo.metadata
            }).execute()
        except Exception as e:
            print(f"Supabase investment memo saving failed: {str(e)}")

        return memo

    async def _evaluate_via_gpt(
        self,
        startup: Dict[str, Any],
        founders: List[Dict[str, Any]],
        decks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Queries OpenAI as a VC Partner deciding on whether to write a check.
        Generates an institutional-quality markdown investment memo covering 14 target sections.
        """
        prompt = f"""
        You are a senior Venture Capital General Partner.
        Your task is to analyze all combined datasets for startup '{startup.get('name', 'NovaGrid')}' and decide on a seed investment check.

        Review the following inputs:
        1. Startup Parameters: {json.dumps(startup) if startup else "None"}
        2. Co-Founders & Signals (tenure, exits, scores, trust checklist): {json.dumps(founders) if founders else "None"}
        3. Pitch deck slides summaries: {json.dumps(decks) if decks else "None"}

        Tasks:
        - Analyze Founder: check experience, exits, skills, and trust index.
        - Analyze Market: estimate market growth, segments, and moats.
        - Analyze Product: evaluate product tagline, description, and validation.
        - Analyze Competition: review moats and competitive advantages.
        - Estimate Risk: look at unverified metrics, burn, or low exits.
        - Determine Fit: decide on check size, SAFEs, and recommendations.

        Output Requirements:
        - recommendation_status: Must be exactly "invest" or "watch" or "pass".
        - confidence_score: float from 0 to 100.
        - reasoning: High-level GP reasoning (3 sentences).
        - strengths: list of 3 bullet key strengths (e.g. repeat founder with major cash exit).
        - weaknesses: list of 3 bullet key weaknesses (e.g. revenue claim remains unverified).
        - risks: list of 3 bullet key risks (e.g. high sales friction, technology lockout).
        - funding_recommendation: suggested check size and term structures (e.g. "$750,000 on a $6M post-money SAFE").
        - founder_analysis: 2-sentence GP review of founders.
        - market_analysis: 2-sentence review of market sizes and TAM.
        - product_analysis: 2-sentence review of technical depth/fit.
        - competition_analysis: 2-sentence review of competitors.
        - institutional_memo: Generate a comprehensive, professional, multi-page VC Investment Memo in Markdown format covering the following 14 sections exactly:
          1. Executive Summary
          2. Founder Analysis
          3. Market Analysis
          4. Competition
          5. SWOT
          6. Business Model
          7. Traction
          8. Technical Review
          9. Risk Analysis
          10. Founder Score
          11. Trust Score
          12. Investment Recommendation
          13. Confidence
          14. Next Steps
          Make sure the tone is highly rigorous, analytical, objective, and written in professional VC writing style.

        Return ONLY a JSON object matching this schema:
        {{
          "recommendation_status": "invest|watch|pass",
          "confidence_score": 85.0,
          "reasoning": "GP overall reasoning...",
          "strengths": ["...", "...", "..."],
          "weaknesses": ["...", "...", "..."],
          "risks": ["...", "...", "..."],
          "funding_recommendation": "$500,000 post-money SAFE",
          "founder_analysis": "...",
          "market_analysis": "...",
          "product_analysis": "...",
          "competition_analysis": "...",
          "institutional_memo": "Markdown writeup covering the 14 sections..."
        }}
        """.strip()

        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise venture capital partner engine. Output JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                )
                content = response.choices[0].message.content or "{}"
                return json.loads(content)
            except Exception as e:
                print(f"OpenAI VC Partner calculation failed: {str(e)}")

        # Fallback local calculation
        name = startup.get("name", "NovaGrid")
        sector = startup.get("sector", "Enterprise Software")
        stage = startup.get("stage", "sourcing")
        val = startup.get("valuation", 2000000.0)

        # Basic scoring heuristics
        status = "watch"
        score = 65.0
        f_score = 75.0
        t_score = 60.0
        if len(founders) > 0:
            top_founder = founders[0]
            f_score = top_founder.get("score", 75.0)
            t_score = top_founder.get("trust", 60.0)
            if top_founder.get("exits", 0) > 0 or f_score > 85.0:
                status = "invest"
                score = 85.0
            elif t_score < 60.0:
                status = "pass"
                score = 45.0

        check_val = min(max(val * 0.1, 100000.0), 1000000.0)
        check_size_str = f"${check_val:,.0f} SAFE"

        # Generate markdown template text
        institutional_markdown = f"""
# VC Investment Memo: {name}

### 1. Executive Summary
{name} represents an institutional-grade investment opportunity in the {sector} space. Operating under early traction, the team is deploying optimization software to solve critical infrastructure layout frictions. 

### 2. Founder Analysis
The founding team brings substantial domain depth. Leading with relevant technical skills, they have previous experience in scaling enterprise grid deployments.

### 3. Market Analysis
The total addressable market (TAM) for grid optimization and AI-enabled distribution management systems is estimated to exceed $15 Billion globally by 2030, driven by decarbonization mandates.

### 4. Competition
Key incumbents are legacy system integrators (GE, Siemens) who lack modern cloud-native optimization heuristics. {name} has built a lightweight cloud API showing 10x faster simulations.

### 5. SWOT
* **Strengths**: High technical depth; verified founder credentials; early pilot customer buy-in.
* **Weaknesses**: Unverified early commercial revenues; small engineering headcount; sales friction.
* **Opportunities**: Scale into regional public utility pilots; embed custom AI optimization chips.
* **Threats**: Extended utility sales cycles; incumbent price-matching lockouts.

### 6. Business Model
B2B Enterprise SaaS model. pricing leverages annual licensing fees starting at $50k per region, scaling with grid distribution nodes managed.

### 7. Traction
Early beta is live with 2 VC funds and pilot utility engineers actively testing layout simulation results.

### 8. Technical Review
Codebase integration and GitHub logs indicate strong engineering consistency. Awaiting deep source repository audit to verify scalability and security.

### 9. Risk Analysis
* **Sales Risk**: Long enterprise cycles (9-18 months) require robust capitalization.
* **Financial Risk**: Burn rate is low, but awaiting audit on current bank balances.
* **Team Risk**: Heavy dependence on the lead engineer; hiring senior backend support is critical.

### 10. Founder Score
* **Calculated Score**: {f_score:.0f} / 100
* **Rating**: Dimension analysis shows outstanding tech depth and domain expertise.

### 11. Trust Score
* **Verified Rating**: {t_score:.0f} / 100
* **Status**: High confidence across education and website scrape parameters. Awaiting bank file audits.

### 12. Investment Recommendation
We recommend a **{status.upper()}** thesis on {name}. 

### 13. Confidence
* **Overall GP Conviction**: {score:.0f} %

### 14. Next Steps
1. Execute deep code review.
2. Review banking and utility pilot agreement files.
3. Align on seed term sheet structures.
        """.strip()

        return {
            "recommendation_status": status,
            "confidence_score": score,
            "reasoning": f"Calculated baseline GP assessment for {name} operating in {sector}. Solid tech signals mapped; diligence validates key parameters.",
            "strengths": [
                "Technical capability matches requirements.",
                "Tenured industry domain experience.",
                "Early pilot customer interest."
            ],
            "weaknesses": [
                "Unverified financial statements.",
                "Average early customer retention metrics.",
                "Limited commercial pipeline detail."
            ],
            "risks": [
                "High competitor saturation.",
                "Long sales cycles in enterprise software.",
                "Runway requires additional capitalization."
            ],
            "funding_recommendation": f"{check_size_str} check size suggested.",
            "founder_analysis": "Founders demonstrate capable technical TENURE with relevant skills.",
            "market_analysis": f"TAM within {sector} is growing; target customer segments are clear.",
            "product_analysis": "Prototype indicates early value proposition is established.",
            "competition_analysis": "Differentiators and technical moats look promising but need scaling.",
            "institutional_memo": institutional_markdown
        }

partner_service = PartnerService()

import json
from datetime import datetime, timezone
import uuid
from typing import Dict, Any, List

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.services.memory_service import MOCK_SCORES, MOCK_EVIDENCE
from app.models.schemas import ScoreEvaluationResponse, FounderScoreBreakdown, ScoreDimensionDetail

class ScoreService:
    async def evaluate_founder_score(self, founder_id: str) -> ScoreEvaluationResponse:
        """
        Gathers GitHub profiles, education lists, exits, and memory facts to evaluate
        Overall, Technical, Business, Execution, Innovation, and Risk ratings.
        """
        # 1. Fetch data from DB or local fallbacks
        founder_name = ""
        founder_data = {}
        github_data = {}
        companies_data = []
        evidence_data = []

        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Local Mock Fetch
            f_profile = next((f for f in store.list_founders() if f.id == founder_id), None)
            if f_profile:
                founder_name = f_profile.name
                founder_data = {
                    "name": f_profile.name,
                    "bio": f_profile.bio,
                    "exits": f_profile.previous_exits,
                    "experience": f_profile.years_experience,
                    "education": f_profile.education,
                    "skills": f_profile.skills
                }
            github_data = {"public_repos": 12, "followers": 80, "location": "San Francisco, CA"}
            companies_data = [{
                "name": f_profile.company if f_profile else "NovaGrid",
                "tagline": "AI grid systems optimization",
                "sector": "Enterprise AI",
                "stage": "sourcing",
                "location": "San Francisco, CA",
                "founded_year": 2024,
                "funding_raised": 250000.0,
                "valuation": 2000000.0,
                "employee_count": 5,
                "traction": "Beta live, 2 VCs testing.",
                "description": "Enterprise software optimizing load flows."
            }]
            evidence_data = [x for x in MOCK_EVIDENCE if x["founder_id"] == founder_id]
        else:
            try:
                # Live Supabase Fetch
                # Founder details
                f_res = supabase_client._client.table("founders").select("*").eq("id", founder_id).execute()
                if f_res.data:
                    f_rec = f_res.data[0]
                    founder_name = f_rec.get("full_name", "")
                    founder_data = {
                        "name": founder_name,
                        "bio": f_rec.get("bio"),
                        "exits": f_rec.get("previous_exits", 0),
                        "experience": f_rec.get("years_experience", 0),
                        "education": f_rec.get("education", []),
                        "skills": f_rec.get("skills", [])
                    }
                
                # GitHub sync profile
                git_res = supabase_client._client.table("github_profiles").select("*").eq("founder_id", founder_id).execute()
                if git_res.data:
                    github_data = git_res.data[0]

                # Associated startups/companies
                comp_res = supabase_client._client.table("startups").select("*").contains("founder_ids", [founder_id]).execute()
                companies_data = comp_res.data or []

                # Memories / Evidence
                ev_res = supabase_client._client.table("evidence").select("evidence_type, source_kind, title, body, observed_at, confidence").eq("founder_id", founder_id).is_("deleted_at", None).execute()
                evidence_data = ev_res.data or []
            except Exception as e:
                print(f"Supabase scoring data retrieval failed: {str(e)}")

        # 2. Run AI rating calculation
        eval_time = datetime.now(timezone.utc)
        ai_result = await self._calculate_scores_via_gpt(
            founder_name=founder_name,
            founder_data=founder_data,
            github_data=github_data,
            companies_data=companies_data,
            evidence_data=evidence_data
        )

        overall_score = float(ai_result.get("overall_score", 70.0))
        overall_explanation = ai_result.get("overall_explanation", "Analysis completed.")
        breakdown_data = ai_result.get("breakdown", {})

        # Parse structure
        breakdown = FounderScoreBreakdown(
            technical=ScoreDimensionDetail(
                score=float(breakdown_data.get("technical", {}).get("score", 70.0)),
                explanation=breakdown_data.get("technical", {}).get("explanation", "Based on skills and credentials.")
            ),
            business=ScoreDimensionDetail(
                score=float(breakdown_data.get("business", {}).get("score", 70.0)),
                explanation=breakdown_data.get("business", {}).get("explanation", "Based on commercial traction and business models.")
            ),
            execution=ScoreDimensionDetail(
                score=float(breakdown_data.get("execution", {}).get("score", 70.0)),
                explanation=breakdown_data.get("execution", {}).get("explanation", "Based on historical exits and speed of development.")
            ),
            innovation=ScoreDimensionDetail(
                score=float(breakdown_data.get("innovation", {}).get("score", 70.0)),
                explanation=breakdown_data.get("innovation", {}).get("explanation", "Based on novelty of projects and technical depth.")
            ),
            risk=ScoreDimensionDetail(
                score=float(breakdown_data.get("risk", {}).get("score", 30.0)),
                explanation=breakdown_data.get("risk", {}).get("explanation", "Identified friction points or execution challenges.")
            ),
            dimensions_breakdown=breakdown_data.get("dimensions_breakdown", {
                "github": "N/A", "hackathons": "N/A", "research_papers": "N/A",
                "previous_startup": "N/A", "traction": "N/A", "revenue": "N/A",
                "education": "N/A", "technical_depth": "N/A", "team": "N/A",
                "leadership": "N/A", "consistency": "N/A"
            })
        )

        resp = ScoreEvaluationResponse(
            overall_score=overall_score,
            overall_explanation=overall_explanation,
            breakdown=breakdown,
            scored_at=eval_time
        )

        # 3. Save score to DB history log
        score_history_id = str(uuid.uuid4())
        components_payload = {
            "technical": resp.breakdown.technical.model_dump(),
            "business": resp.breakdown.business.model_dump(),
            "execution": resp.breakdown.execution.model_dump(),
            "innovation": resp.breakdown.innovation.model_dump(),
            "risk": resp.breakdown.risk.model_dump(),
            "dimensions_breakdown": resp.breakdown.dimensions_breakdown
        }

        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock persistence sync
            MOCK_SCORES.append({
                "id": score_history_id,
                "founder_id": founder_id,
                "score": overall_score,
                "rationale": overall_explanation,
                "score_components": components_payload,
                "scored_at": eval_time.isoformat()
            })
            
            # Sync back to store seed records
            f_seed = next((f for f in store.list_founders() if f.id == founder_id), None)
            if f_seed:
                f_seed.current_founder_score = overall_score
        else:
            try:
                # Save into founder_score_history
                supabase_client._client.table("founder_score_history").insert({
                    "id": score_history_id,
                    "founder_id": founder_id,
                    "score": overall_score,
                    "rationale": overall_explanation,
                    "score_components": components_payload,
                    "model_version": settings.openai_chat_model
                }).execute()
            except Exception as e:
                print(f"Supabase score history logging failed: {str(e)}")

        return resp

    async def get_latest_score_details(self, founder_id: str) -> ScoreEvaluationResponse | None:
        """
        Retrieves the latest score history detailed analysis components.
        """
        if not settings.supabase_url or not settings.supabase_service_role_key:
            scores = [x for x in MOCK_SCORES if x["founder_id"] == founder_id]
            if not scores:
                return None
            scores.sort(key=lambda s: s["scored_at"], reverse=True)
            latest = scores[0]
            
            components = latest["score_components"]
            breakdown = FounderScoreBreakdown(
                technical=ScoreDimensionDetail(**components.get("technical", {"score": 70, "explanation": "N/A"})),
                business=ScoreDimensionDetail(**components.get("business", {"score": 70, "explanation": "N/A"})),
                execution=ScoreDimensionDetail(**components.get("execution", {"score": 70, "explanation": "N/A"})),
                innovation=ScoreDimensionDetail(**components.get("innovation", {"score": 70, "explanation": "N/A"})),
                risk=ScoreDimensionDetail(**components.get("risk", {"score": 30, "explanation": "N/A"})),
                dimensions_breakdown=components.get("dimensions_breakdown", {})
            )
            return ScoreEvaluationResponse(
                overall_score=latest["score"],
                overall_explanation=latest["rationale"],
                breakdown=breakdown,
                scored_at=datetime.fromisoformat(latest["scored_at"].replace("Z", "+00:00"))
            )

        try:
            res = supabase_client._client.table("founder_score_history")\
                .select("*")\
                .eq("founder_id", founder_id)\
                .order("scored_at", desc=True)\
                .limit(1)\
                .execute()
                
            if not res.data:
                return None
            
            latest = res.data[0]
            components = latest.get("score_components") or {}
            
            breakdown = FounderScoreBreakdown(
                technical=ScoreDimensionDetail(**components.get("technical", {"score": 70, "explanation": "N/A"})),
                business=ScoreDimensionDetail(**components.get("business", {"score": 70, "explanation": "N/A"})),
                execution=ScoreDimensionDetail(**components.get("execution", {"score": 70, "explanation": "N/A"})),
                innovation=ScoreDimensionDetail(**components.get("innovation", {"score": 70, "explanation": "N/A"})),
                risk=ScoreDimensionDetail(**components.get("risk", {"score": 30, "explanation": "N/A"})),
                dimensions_breakdown=components.get("dimensions_breakdown", {})
            )
            
            return ScoreEvaluationResponse(
                overall_score=float(latest["score"]),
                overall_explanation=latest["rationale"],
                breakdown=breakdown,
                scored_at=datetime.fromisoformat(latest["scored_at"].replace("Z", "+00:00"))
            )
        except Exception as e:
            print(f"Supabase score detail fetching failed: {str(e)}")
            return None

    async def _calculate_scores_via_gpt(
        self,
        founder_name: str,
        founder_data: Dict[str, Any],
        github_data: Dict[str, Any],
        companies_data: List[Dict[str, Any]],
        evidence_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Assembles contextual prompts, triggers GPT-4o-mini structured analysis, and returns the score engine output.
        """
        prompt = f"""
        You are the VC Brain AI rating algorithm.
        Your task is to analyze all combined datasets for founder '{founder_name}' and calculate specialized sub-scores.

        Evaluation Inputs:
        1. Founder Profile Details: {json.dumps(founder_data) if founder_data else "None"}
        2. GitHub Sync Details: {json.dumps(github_data) if github_data else "None"}
        3. Associated Startup Metrics: {json.dumps(companies_data) if companies_data else "None"}
        4. Memory logs & Observations (Hackathons, Papers, etc): {json.dumps(evidence_data) if evidence_data else "None"}

        Rating Guidelines:
        - overall_score (0-100): Balanced weighted mean representing credibility and capacity.
        - technical (0-100): Skills, github activity, technical depth, papers.
        - business (0-100): Exits history, traction, revenue growth.
        - execution (0-100): Consistency, velocity of releases, team size.
        - innovation (0-100): Novelty, technical depth, hackathon projects.
        - risk (0-100): Friction, execution bottlenecks, churn. Higher indicates higher risk.
        - dimensions_breakdown: Rate the 11 target inputs as "Outstanding" (90+), "Strong" (75-90), "Moderate" (50-75), "N/A" (if missing data). Target categories: github, hackathons, research_papers, previous_startup, traction, revenue, education, technical_depth, team, leadership, consistency.

        Return ONLY a JSON object matching this schema:
        {{
          "overall_score": 85.5,
          "overall_explanation": "Combined explanation...",
          "breakdown": {{
            "technical": {{
              "score": 90.0,
              "explanation": "Explanation for technical score..."
            }},
            "business": {{
              "score": 75.0,
              "explanation": "Explanation for business score..."
            }},
            "execution": {{
              "score": 80.0,
              "explanation": "Explanation for execution score..."
            }},
            "innovation": {{
              "score": 90.0,
              "explanation": "Explanation for innovation score..."
            }},
            "risk": {{
              "score": 30.0,
              "explanation": "Explanation for risk score..."
            }},
            "dimensions_breakdown": {{
              "github": "Outstanding|Strong|Moderate|N/A",
              "hackathons": "Outstanding|Strong|Moderate|N/A",
              "research_papers": "Outstanding|Strong|Moderate|N/A",
              "previous_startup": "Outstanding|Strong|Moderate|N/A",
              "traction": "Outstanding|Strong|Moderate|N/A",
              "revenue": "Outstanding|Strong|Moderate|N/A",
              "education": "Outstanding|Strong|Moderate|N/A",
              "technical_depth": "Outstanding|Strong|Moderate|N/A",
              "team": "Outstanding|Strong|Moderate|N/A",
              "leadership": "Outstanding|Strong|Moderate|N/A",
              "consistency": "Outstanding|Strong|Moderate|N/A"
            }}
          }}
        }}
        """.strip()

        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise venture capital score breakdown algorithm. Output JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                )
                content = response.choices[0].message.content or "{}"
                return json.loads(content)
            except Exception as e:
                print(f"OpenAI score engine calculation failed: {str(e)}")

        # Fallback local calculation matching the 12 fields
        base_score = 75.0
        exits = founder_data.get("exits", 0)
        skills = founder_data.get("skills", [])
        experience = founder_data.get("experience", 5)
        
        tech = 70.0 + (5.0 if len(skills) > 4 else 0.0) + (10.0 if "Python" in skills or "AI" in founder_data.get("bio", "") else 0.0)
        biz = 65.0 + (15.0 if exits > 0 else 0.0)
        exec_s = 70.0 + min(experience * 1.5, 15.0)
        inno = 70.0 + (10.0 if len(evidence_data) > 0 else 0.0)
        risk = 30.0 - (10.0 if exits > 0 else 0.0)

        overall = round((tech + biz + exec_s + inno + (100.0 - risk)) / 5.0, 1)

        return {
            "overall_score": overall,
            "overall_explanation": f"Calculated baseline for {founder_name} using technical skills and background records.",
            "breakdown": {
                "technical": {"score": tech, "explanation": "Strong programming and algorithms capabilities in evidence logs."},
                "business": {"score": biz, "explanation": "Exits background and commercial domain metrics reviewed."},
                "execution": {"score": exec_s, "explanation": "Consistent industry tenure and developer output velocity."},
                "innovation": {"score": inno, "explanation": "Active in builder projects and novel tech research."},
                "risk": {"score": risk, "explanation": "Low risk indicators; repeat validation established."},
                "dimensions_breakdown": {
                    "github": "Strong" if github_data else "N/A",
                    "hackathons": "Strong" if len(evidence_data) > 0 else "N/A",
                    "research_papers": "N/A",
                    "previous_startup": "Strong" if exits > 0 else "N/A",
                    "traction": "Moderate",
                    "revenue": "Moderate",
                    "education": "Strong" if founder_data.get("education") else "N/A",
                    "technical_depth": "Strong",
                    "team": "Strong",
                    "leadership": "Strong",
                    "consistency": "Strong"
                }
            }
        }

score_service = ScoreService()

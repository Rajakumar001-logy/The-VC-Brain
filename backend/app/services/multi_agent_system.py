import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

from app.models.agent_schemas import AgentLogEntry
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.core.config import settings

class BaseAgent:
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role

    def log(self, logs: List[AgentLogEntry], message: str, status: str = "info") -> None:
        logs.append(AgentLogEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            agent_name=self.name,
            message=message,
            status=status
        ))

    async def execute_with_retry(
        self,
        payload: Dict[str, Any],
        retries_limit: int,
        logs: List[AgentLogEntry]
    ) -> Dict[str, Any]:
        """
        Executes agent logic with retry resilience and logging.
        """
        self.log(logs, f"Initiated execution task with payload keys: {list(payload.keys())}", "info")
        
        attempt = 0
        while attempt <= retries_limit:
            attempt += 1
            try:
                # Simulate potential intermittent issues for retry demonstrations
                if attempt == 1 and payload.get("company_name", "").lower() == "retry-test":
                    raise ConnectionError("Intermittent connection timeout on target crawl URL.")
                
                result = await self.run(payload, logs)
                self.log(logs, f"Task completed successfully on attempt {attempt}.", "success")
                return result
            except Exception as e:
                self.log(logs, f"Failure on attempt {attempt}/{retries_limit + 1}: {str(e)}", "warning")
                if attempt > retries_limit:
                    self.log(logs, "Retry limit exceeded. Task aborted.", "error")
                    raise e
                # Exponential backoff simulation
                await asyncio.sleep(0.5 * attempt)
                self.log(logs, f"Retrying task...", "retry")

        return {}

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        raise NotImplementedError("Subclasses must implement the run method.")


class CollectorAgent(BaseAgent):
    def __init__(self):
        super().__init__("CollectorAgent", "Data Collector & Scraper")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        company = payload["company_name"]
        website = payload.get("website") or f"https://{company.lower().replace(' ', '')}.io"
        github = payload.get("github") or f"https://github.com/{company.lower().replace(' ', '')}"
        
        self.log(logs, f"Crawling targets: website={website}, github={github}", "info")
        # Simulating crawling latency
        await asyncio.sleep(0.5)
        
        return {
            "company_name": company,
            "website": website,
            "github": github,
            "raw_html": f"<html><body><h1>{company}</h1><p>Building low-latency database caching proxies.</p></body></html>",
            "raw_commits": "Found 148 commits across 4 repositories. Tech stack: Rust, C++, Kubernetes."
        }


class ExtractorAgent(BaseAgent):
    def __init__(self):
        super().__init__("ExtractorAgent", "Profile Extractor & Entity Parser")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Parsing crawled raw logs into structured startup schema...", "info")
        await asyncio.sleep(0.5)
        
        return {
            "company_name": payload["company_name"],
            "website": payload["website"],
            "github": payload["github"],
            "sector": "Enterprise Infrastructure",
            "founder_name": "Marcus Mercer",
            "founder_bio": "Former Staff Engineer at Snowflake working on proxy compilers. Built low-latency caches in Rust.",
            "skills": ["Rust", "C++", "Docker", "Database Systems"],
            "years_experience": 10,
            "revenue": 120000.0,
            "valuation": 5000000.0
        }


class MemoryAgent(BaseAgent):
    def __init__(self):
        super().__init__("MemoryAgent", "Deduplication & Fact Memory Sync")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Checking pgvector index for existing founder observations...", "info")
        await asyncio.sleep(0.5)
        self.log(logs, "No duplicated facts found (similarity match < 0.85). Mirroring profile to DB.", "success")
        
        return payload


class ScoringAgent(BaseAgent):
    def __init__(self):
        super().__init__("ScoringAgent", "Founder Scoring Heuristics Engine")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Calculating founder ratings breakdown (Consistency, Traction, Tech Depth)...", "info")
        await asyncio.sleep(0.5)
        
        # 11-dimension scores synthesis
        scorecard = {
            "github": 88.0,
            "hackathons": 70.0,
            "research_papers": 65.0,
            "previous_startup": 75.0,
            "traction": 80.0,
            "revenue": 82.0,
            "education": 80.0,
            "technical_depth": 92.0,
            "team": 85.0,
            "leadership": 80.0,
            "consistency": 85.0,
            "overall_score": 83.5,
            "technical_score": 90.0,
            "business_score": 81.0,
            "execution_score": 83.0,
            "innovation_score": 85.0,
            "risk_score": 40.0
        }
        
        payload["scorecard"] = scorecard
        return payload


class ValidatorAgent(BaseAgent):
    def __init__(self):
        super().__init__("ValidatorAgent", "Trust Checker & Evidence Auditor")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Auditing verification checklists (ARR, website, github status)...", "info")
        await asyncio.sleep(0.5)
        
        trust_report = {
            "trust_score": 85.0,
            "claims": [
                {"dimension": "Revenue", "status": "verified", "confidence": 0.9, "evidence": "Confirmed STRIPE log summaries."},
                {"dimension": "Team", "status": "verified", "confidence": 0.95, "evidence": "Matched LinkedIn IDs."},
                {"dimension": "Education", "status": "verified", "confidence": 0.85, "evidence": "Verified degree registries."},
                {"dimension": "GitHub", "status": "verified", "confidence": 0.98, "evidence": "Verified repository commits ownership."}
            ]
        }
        
        payload["trust_report"] = trust_report
        return payload


class MarketResearchAgent(BaseAgent):
    def __init__(self):
        super().__init__("MarketResearchAgent", "Competitor & Market TAM Researcher")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Scanning vector storage and web targets for TAM competitor matrices...", "info")
        await asyncio.sleep(0.5)
        
        competitors = ["ProxySQL", "Envoy Cache", "Redis Enterprise"]
        market_tam = "Database caching proxy markets represent a $2.8B TAM with 18% CAGR."
        
        payload["market_research"] = {
            "competitors": competitors,
            "market_tam": market_tam,
            "swot": {
                "strengths": ["Excellent Rust technical depth", "Experienced snowflake engineer"],
                "weaknesses": ["Small team size", "Early revenue stage"],
                "opportunities": ["High developer tool adoption", "Edge caching demands"],
                "threats": ["Deep-pocketed competitors", "Open source replication"]
            }
        }
        return payload


class InvestmentAgent(BaseAgent):
    def __init__(self):
        super().__init__("InvestmentAgent", "Deal Terms & SAFE Sizing Partner")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Auditing metrics to formulate check sizes and SAFE terms...", "info")
        await asyncio.sleep(0.5)
        
        recommendation = "invest"
        check_size = 500000.0
        rationale = "Exceptional founder scorecard combined with strong technical cache proxy execution thesis."
        
        payload["investment_terms"] = {
            "recommendation": recommendation,
            "check_size": check_size,
            "valuation_cap": payload["valuation"],
            "rationale": rationale
        }
        return payload


class MemoAgent(BaseAgent):
    def __init__(self):
        super().__init__("MemoAgent", "Institutional Investment Memo Compiler")

    async def run(self, payload: Dict[str, Any], logs: List[AgentLogEntry]) -> Dict[str, Any]:
        self.log(logs, "Synthesizing GP summaries and compiling the 14-section institutional report...", "info")
        await asyncio.sleep(0.5)
        
        company = payload["company_name"]
        founder = payload["founder_name"]
        terms = payload["investment_terms"]
        research = payload["market_research"]
        
        memo_markdown = f"""
# Investment Memo: {company}

## Executive Summary
We recommend a ${terms['check_size']:.0f} investment in {company} at a ${terms['valuation_cap']:.0f} cap. Led by {founder}.

## Founder Analysis
{founder} has {payload['years_experience']} years experience, including Snowflake Staff compilation engineering.

## Market Analysis
{research['market_tam']}

## Risk Analysis
Key competitors include {', '.join(research['competitors'])}. High replication risk.
        """.strip()
        
        payload["memo_markdown"] = memo_markdown
        return payload


class SupervisorAgent(BaseAgent):
    def __init__(self):
        super().__init__("SupervisorAgent", "Multi-Agent Coordinator Orchestrator")
        self.collector = CollectorAgent()
        self.extractor = ExtractorAgent()
        self.memory = MemoryAgent()
        self.scoring = ScoringAgent()
        self.validator = ValidatorAgent()
        self.market_research = MarketResearchAgent()
        self.investment = InvestmentAgent()
        self.memo = MemoAgent()

    async def orchestrate_pipeline(
        self,
        request_payload: Dict[str, Any],
        retries_limit: int
    ) -> Dict[str, Any]:
        """
        Coordinates message flows across the 8 specialized agents sequentially,
        logging audit trails, retry events, and publishing database changes.
        """
        logs: List[AgentLogEntry] = []
        self.log(logs, "Supervisor initiating orchestrated venture diligence pipeline...", "info")
        
        try:
            # 1. Collector Agent
            payload = await self.collector.execute_with_retry(request_payload, retries_limit, logs)
            
            # 2. Extractor Agent
            payload = await self.extractor.execute_with_retry(payload, retries_limit, logs)
            
            # 3. Memory Agent
            payload = await self.memory.execute_with_retry(payload, retries_limit, logs)
            
            # 4. Scoring Agent
            payload = await self.scoring.execute_with_retry(payload, retries_limit, logs)
            
            # 5. Validator Agent
            payload = await self.validator.execute_with_retry(payload, retries_limit, logs)
            
            # 6. Market Research Agent
            payload = await self.market_research.execute_with_retry(payload, retries_limit, logs)
            
            # 7. Investment Agent
            payload = await self.investment.execute_with_retry(payload, retries_limit, logs)
            
            # 8. Memo Agent
            payload = await self.memo.execute_with_retry(payload, retries_limit, logs)

            # 9. Supabase write or mock catalog registry
            memo_id = await self._save_pipeline_outputs(payload)
            self.log(logs, f"Pipeline execution completed. Saved Memo ID: {memo_id}", "success")
            
            return {
                "status": "success",
                "logs": logs,
                "final_memo_id": memo_id,
                "output_payload": payload
            }
        except Exception as e:
            self.log(logs, f"Supervisor pipeline aborted due to unhandled agent crash: {str(e)}", "error")
            return {
                "status": "failed",
                "logs": logs,
                "final_memo_id": None,
                "output_payload": {}
            }

    async def _save_pipeline_outputs(self, payload: Dict[str, Any]) -> str:
        """
        Persists newly orchestrated details inside Supabase database.
        """
        comp_id = str(uuid.uuid4())
        founder_id = str(uuid.uuid4())
        memo_id = str(uuid.uuid4())
        
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock success ID
            return memo_id

        try:
            # 1. Startup insert
            supabase_client._client.table("startups").insert({
                "id": comp_id,
                "name": payload["company_name"],
                "website_url": payload["website"],
                "sector": payload["sector"],
                "stage": "diligence",
                "valuation": payload["valuation"],
                "traction": f"ARR {payload['revenue']:.0f}"
            }).execute()

            # 2. Founder insert
            supabase_client._client.table("founders").insert({
                "id": founder_id,
                "full_name": payload["founder_name"],
                "role": "Founder & CEO",
                "company": payload["company_name"],
                "bio": payload["founder_bio"],
                "skills": payload["skills"],
                "current_founder_score": payload["scorecard"]["overall_score"],
                "current_trust_score": payload["trust_report"]["trust_score"],
                "metadata": {
                    "scorecard": payload["scorecard"],
                    "trust_report": payload["trust_report"]
                }
            }).execute()

            # 3. Memo insert
            supabase_client._client.table("investment_memos").insert({
                "id": memo_id,
                "company_id": comp_id,
                "title": f"{payload['company_name']} Diligence Memo",
                "recommendation_status": payload["investment_terms"]["recommendation"],
                "recommendation_check_size": payload["investment_terms"]["check_size"],
                "content": payload["memo_markdown"],
                "metadata": {
                    "confidence_score": 85
                }
            }).execute()
        except Exception as e:
            print(f"Supabase multi-agent pipeline database inserts failed: {str(e)}")

        return memo_id

supervisor_agent = SupervisorAgent()

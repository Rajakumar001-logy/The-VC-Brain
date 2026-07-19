import io
import json
import uuid
from typing import Dict, Any, Tuple
from pypdf import PdfReader

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.models.schemas import PitchDeckResponse, PitchDeckAnalysis

# Local in-memory fallback list to persist uploads in development offline mode
MOCK_PITCH_DECKS = []

class PitchDeckService:
    def extract_pdf_text(self, file_bytes: bytes) -> str:
        """
        Extracts raw text pages from a PDF byte stream using pypdf.
        """
        if not file_bytes:
            return ""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_pages = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_pages.append(f"--- Slide {i+1} ---\n{page_text}")
            return "\n".join(text_pages)
        except Exception as e:
            print(f"PDF text extraction failed: {str(e)}")
            return ""

    async def analyze_deck(
        self,
        file_bytes: bytes,
        filename: str,
        company_id: str | None = None
    ) -> PitchDeckResponse:
        """
        Parses PDF, queries OpenAI to extract the 12 business dimensions, resolves/creates 
        the associated company profile, and stores the pitch deck metadata in PostgreSQL.
        """
        # 1. Parse text from PDF
        extracted_text = self.extract_pdf_text(file_bytes)
        if not extracted_text:
            extracted_text = f"Parsed pitch deck binary content for {filename}. Raw text extraction was empty."

        # 2. Extract structured analysis using OpenAI
        ai_data = await self._extract_analysis_via_gpt(extracted_text, filename)
        analysis_data = ai_data.get("analysis", {})
        ai_summary = ai_data.get("ai_summary", "Analysis completed.")
        extracted_company_name = ai_data.get("company_name", filename.split(".")[0])
        extracted_tagline = ai_data.get("tagline", "Ingested via Pitch Deck Analyzer.")

        # 3. Resolve Company ID (Supabase has a NOT NULL constraint on company_id in pitch_decks)
        resolved_company_id = await self._resolve_company_id(
            company_id=company_id,
            company_name=extracted_company_name,
            tagline=extracted_tagline
        )

        deck_id = str(uuid.uuid4())
        title = f"Pitch Deck — {extracted_company_name}"

        # 4. Persistence
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Dev Fallback
            analysis_obj = PitchDeckAnalysis(**analysis_data)
            resp = PitchDeckResponse(
                id=deck_id,
                company_id=resolved_company_id,
                title=title,
                extracted_text=extracted_text,
                ai_summary=ai_summary,
                analysis=analysis_obj
            )
            MOCK_PITCH_DECKS.append(resp)
            return resp

        try:
            # Save into supabase pitch_decks table
            deck_insert = supabase_client._client.table("pitch_decks").insert({
                "id": deck_id,
                "company_id": resolved_company_id,
                "title": title,
                "extracted_text": extracted_text,
                "ai_summary": ai_summary,
                "metadata": analysis_data,
                "mime_type": "application/pdf",
                "file_size_bytes": len(file_bytes)
            }).execute()

            if not deck_insert.data:
                raise Exception("Database write returned no data")

            db_record = deck_insert.data[0]
            
            # Index document semantically for search
            await self._index_document(
                deck_id=deck_id,
                company_id=resolved_company_id,
                title=title,
                content=extracted_text,
                summary=ai_summary
            )

            return PitchDeckResponse(
                id=db_record["id"],
                company_id=db_record["company_id"],
                title=db_record["title"],
                extracted_text=db_record["extracted_text"],
                ai_summary=db_record["ai_summary"],
                analysis=PitchDeckAnalysis(**db_record["metadata"])
            )
        except Exception as e:
            print(f"Supabase pitch deck persistence failed: {str(e)}")
            # Return parsed response as a fallback to avoid failing requests
            analysis_obj = PitchDeckAnalysis(**analysis_data)
            return PitchDeckResponse(
                id=deck_id,
                company_id=resolved_company_id,
                title=title,
                extracted_text=extracted_text,
                ai_summary=ai_summary,
                analysis=analysis_obj
            )

    async def _extract_analysis_via_gpt(self, text: str, filename: str) -> Dict[str, Any]:
        """
        Helper method calling GPT to extract 12 startup categories from raw text.
        """
        prompt = f"""
        You are a venture capital investment analyst.
        Your task is to analyze a pitch deck text and extract structured information.

        Sections to extract:
        - founder: Name of primary founder(s)
        - market: Size, growth, target customer segments, TAM/SAM
        - problem: Pain point being solved
        - solution: Product / value proposition
        - business_model: Pricing, sales channels, unit economics
        - competition: Competitors, moat, differentiators
        - revenue: Current ARR, MRR or historical sales metrics
        - traction: Customer growth, retention, case studies, LOIs
        - go_to_market: Channels, acquisition strategy
        - team: Advisors, co-founders, previous exits
        - financials: Burn rate, raise amount, capital requirements
        - risks: Competitors, technical risk, go-to-market execution risks

        Output Format:
        Return ONLY valid JSON with keys:
        - company_name: Name of the startup (guess from text or fallback to {filename.split(".")[0]})
        - tagline: Concise company tagline (1 sentence)
        - ai_summary: High-level summary of the investment opportunity (2-3 sentences)
        - analysis: JSON object with keys: founder, market, problem, solution, business_model, competition, revenue, traction, go_to_market, team, financials, risks.

        Input Pitch Deck Text:
        {text[:8000]}
        """.strip()

        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise venture capital research assistant. Output valid JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                )
                content = response.choices[0].message.content or "{}"
                return json.loads(content)
            except Exception as e:
                print(f"OpenAI analysis call failed: {str(e)}")

        # Local Fallback Mock if OpenAI is offline
        company_name = filename.split(".")[0].capitalize()
        return {
            "company_name": company_name,
            "tagline": "Innovative software transforming data flows.",
            "ai_summary": f"Mock analysis completed for {company_name}. Strong potential in data processing software markets.",
            "analysis": {
                "founder": "Alex Rivers",
                "market": "Venture market for data ingestion growing at 18% CAGR globally.",
                "problem": "Manual document analysis is slow, error-prone, and doesn't scale for VC deal flows.",
                "solution": "An automated AI pipeline extracting structured metadata instantly.",
                "business_model": "SaaS subscription tiers starting at $500/month per seat.",
                "competition": "Traditional CRM platforms and legacy database managers.",
                "revenue": "$120,000 ARR within 3 months of private beta launch.",
                "traction": "12 signed LOIs and 4 pilot projects running.",
                "go_to_market": "Direct outbound enterprise sales combined with tech integration partnerships.",
                "team": "Founder with 8 years engineering at Tesla Energy; deep AI expertise.",
                "financials": "Burning $20k/month; looking to raise $1M seed extension.",
                "risks": "Hyperscaler competitor lockouts and longer sales cycles."
            }
        }

    async def _resolve_company_id(self, company_id: str | None, company_name: str, tagline: str) -> str:
        """
        Ensures a company profile exists to satisfy PostgreSQL foreign key constraints.
        """
        if company_id:
            return company_id

        # Offline Mock mode company resolution
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Check mock list
            existing = next((s for s in store.list_startups() if s.name.lower() == company_name.lower()), None)
            if existing:
                return existing.id
            new_id = str(uuid.uuid4())
            # Insert a startup placeholder
            from app.models.schemas import Startup, DealStage
            from datetime import datetime
            store.list_startups().append(Startup(
                id=new_id,
                name=company_name,
                tagline=tagline,
                sector="Enterprise AI",
                stage=DealStage.sourcing,
                location="San Francisco, CA",
                founded_year=2024,
                funding_raised=0,
                valuation=0,
                employee_count=5,
                founder_ids=[],
                description="Automatically created via Pitch Deck Analyzer.",
                traction="N/A",
                created_at=datetime.utcnow()
            ))
            return new_id

        # Live Supabase Mode
        try:
            # Query existing startup
            res = supabase_client._client.table("startups").select("id").ilike("name", company_name).execute()
            if res.data:
                return res.data[0]["id"]
            
            # Create a placeholder startup
            new_id = str(uuid.uuid4())
            company_insert = supabase_client._client.table("startups").insert({
                "id": new_id,
                "name": company_name,
                "tagline": tagline,
                "sector": "Enterprise Software",
                "stage": "sourcing",
                "location": "San Francisco, CA",
                "founded_year": 2024,
                "description": "Automatically generated placeholder company for pitch deck analysis.",
                "traction": "N/A"
            }).execute()

            if not company_insert.data:
                raise Exception("Placeholder company insertion failed")
            return company_insert.data[0]["id"]
        except Exception as e:
            print(f"Supabase company resolution failed: {str(e)}")
            return str(uuid.uuid4()) # Return random UUID as a safety net

    async def _index_document(self, deck_id: str, company_id: str, title: str, content: str, summary: str):
        """
        Uploads the analyzed deck contents to the Supabase vector table.
        """
        if not supabase_client.enabled or not openai_service.enabled:
            return
        try:
            doc_content = f"{title}. Overview: {summary}. Text contents: {content}"
            embeddings = await openai_service.embed([doc_content])
            await supabase_client.upsert_document(
                id=str(uuid.uuid4()),
                source_type="startup",
                source_id=company_id,
                title=title,
                content=doc_content[:1500],
                embedding=embeddings[0],
                metadata={"pitch_deck_id": deck_id, "diligence_parsing": True}
            )
        except Exception as e:
            print(f"Diligence semantic indexing failed: {str(e)}")

pitch_deck_service = PitchDeckService()

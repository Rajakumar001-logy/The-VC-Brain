import asyncio
import io
import re
import json
import uuid
from typing import Dict, Any, Tuple
import httpx
from pypdf import PdfReader

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.models.schemas import Founder, Startup, DealStage

class IngestionService:
    async def fetch_github_profile(self, username: str) -> Dict[str, Any]:
        """
        Fetches public profile data for a GitHub username.
        """
        username = username.strip()
        if not username:
            return {}
        
        url = f"https://api.github.com/users/{username}"
        headers = {"User-Agent": "VC-Brain-Ingestion-Pipeline"}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    # Return normalized fields of interest
                    return {
                        "github_username": username,
                        "name": data.get("name"),
                        "bio": data.get("bio"),
                        "public_repos": data.get("public_repos"),
                        "followers": data.get("followers"),
                        "location": data.get("location"),
                        "blog": data.get("blog")
                    }
                else:
                    return {"github_username": username, "error": f"GitHub returned status {response.status_code}"}
            except Exception as e:
                return {"github_username": username, "error": str(e)}

    async def scrape_website(self, url: str) -> str:
        """
        Fetches raw HTML and extracts stripped text content from the startup's website.
        """
        url = url.strip()
        if not url:
            return ""
        
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        async with httpx.AsyncClient(follow_redirects=True) as client:
            try:
                response = await client.get(url, timeout=12.0)
                if response.status_code == 200:
                    html = response.text
                    # Simple regex to strip <script>, <style> and comments
                    html = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html, flags=re.I)
                    html = re.sub(r'<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>', '', html, flags=re.I)
                    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
                    # Strip all remaining tags
                    text = re.sub(r'<[^>]+>', ' ', html)
                    # Clean whitespace
                    text = re.sub(r'\s+', ' ', text).strip()
                    # Cap text length to avoid pushing token limits
                    return text[:4000]
                return f"Website scrape failed with status code {response.status_code}"
            except Exception as e:
                return f"Website scrape failed: {str(e)}"

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
                    text_pages.append(f"--- Page {i+1} ---\n{page_text}")
            return "\n".join(text_pages)[:8000] # Cap text length to prevent blowing context windows
        except Exception as e:
            return f"PDF text extraction failed: {str(e)}"

    async def run_pipeline(
        self,
        company_name: str,
        github_username: str | None = None,
        website_url: str | None = None,
        pitch_deck_bytes: bytes | None = None,
        pitch_deck_filename: str | None = None
    ) -> Tuple[Founder, Startup]:
        """
        Main async pipeline execution: fetches web, GitHub, and PDF data in parallel,
        normalizes/structures it using OpenAI, checks for duplicates, and persists to DB.
        """
        # Execute scraping and GitHub querying concurrently
        github_task = self.fetch_github_profile(github_username) if github_username else None
        website_task = self.scrape_website(website_url) if website_url else None
        
        github_data, website_text = await asyncio.gather(
            github_task or asyncio.sleep(0, {}),
            website_task or asyncio.sleep(0, "")
        )
        
        # Extract text from pitch deck PDF
        pdf_text = ""
        if pitch_deck_bytes:
            # CPU-bound PDF parse is ran in an executor to maintain FastAPI event-loop concurrency
            loop = asyncio.get_running_loop()
            pdf_text = await loop.run_in_executor(
                None,
                self.extract_pdf_text,
                pitch_deck_bytes
            )

        # Structure raw data with OpenAI Chat Completions
        ai_data = await self._structure_data_with_ai(
            company_name=company_name,
            github_data=github_data,
            website_text=website_text,
            pdf_text=pdf_text
        )

        founder_data = ai_data.get("founder", {})
        startup_data = ai_data.get("startup", {})

        # Reconcile & Deduplicate
        reconciled_founder, reconciled_startup = await self._reconcile_and_persist(
            founder_data=founder_data,
            startup_data=startup_data,
            website_url=website_url,
            github_username=github_username
        )

        # Semantic indexing (optional): Save website & pitch deck text into Supabase vector table
        await self._index_ingested_documents(
            founder=reconciled_founder,
            startup=reconciled_startup,
            website_text=website_text,
            pdf_text=pdf_text,
            pdf_filename=pitch_deck_filename
        )

        return reconciled_founder, reconciled_startup

    async def _structure_data_with_ai(
        self,
        company_name: str,
        github_data: Dict[str, Any],
        website_text: str,
        pdf_text: str
    ) -> Dict[str, Any]:
        """
        Calls OpenAI to consolidate information and extract a structured founder & startup profile.
        """
        prompt = f"""
        You are an AI pipeline processor for venture capital intelligence.
        Your task is to analyze consolidated input data and extract a structured profile for a founder and their startup.

        Instructions:
        1. Fill in all fields as accurately as possible.
        2. Normalize data: format founder name (Title Case), clean list values (e.g. skills, education), clean traction text.
        3. Estimate years_experience or previous_exits from bio and history if not explicitly stated.
        4. Reconcile contradictions: pitch deck info is higher priority than website text, which is higher priority than GitHub data.
        5. Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown quotes.

        Output JSON Schema:
        {{
          "founder": {{
            "name": "Full Name of primary founder (mandatory, guess from data if not explicitly stated)",
            "email": "Founder email (guess or use placeholder if missing)",
            "role": "Founder role title (e.g. CEO, CTO, Founder)",
            "bio": "Concise profile bio (1-2 sentences)",
            "previous_exits": 0,
            "years_experience": 0,
            "education": ["University Degrees"],
            "skills": ["Key technical/business skills"]
          }},
          "startup": {{
            "name": "Startup Company Name (defaults to {company_name})",
            "tagline": "Short tagline/description (1 sentence)",
            "sector": "Primary industry sector (e.g. Climate Tech, Enterprise AI, FinTech, HealthTech)",
            "stage": "sourcing|screening|due_diligence|term_sheet|closed|passed",
            "location": "City, State or Country (e.g. San Francisco, CA)",
            "founded_year": 2024,
            "funding_raised": 0.0,
            "valuation": 0.0,
            "employee_count": 0,
            "description": "Longer paragraph describing product, market, and business model",
            "traction": "Summary of current traction (e.g. MRR, customers, LOIs)"
          }}
        }}

        Raw Ingested Inputs:
        - Target Company Name: {company_name}
        - GitHub Query Data: {json.dumps(github_data) if github_data else "None"}
        - Homepage Scrape Text: {website_text[:3000] if website_text else "None"}
        - Pitch Deck Extract Text: {pdf_text[:5000] if pdf_text else "None"}
        """.strip()

        # Call OpenAI Chat Completions
        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise data extraction agent. Output valid JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                )
                content = response.choices[0].message.content or "{}"
                return json.loads(content)
            except Exception as e:
                print(f"OpenAI structuring failed: {str(e)}")
        
        # Fallback Mock Extraction if OpenAI is not active
        return {
            "founder": {
              "name": github_data.get("name") or "Alex Rivers",
              "email": f"{github_username or 'alex'}@novagrid.io" if github_username else "alex@vcbrain.ai",
              "role": "CEO & Founder",
              "bio": github_data.get("bio") or f"Experienced builder working on grid tech at {company_name}.",
              "previous_exits": 1,
              "years_experience": 10,
              "education": ["Stanford University BS CS"],
              "skills": ["Python", "VC Ingestion", "AI Pipelines"]
            },
            "startup": {
              "name": company_name,
              "tagline": "AI optimization systems for deal screening",
              "sector": "Enterprise AI",
              "stage": "sourcing",
              "location": github_data.get("location") or "San Francisco, CA",
              "founded_year": 2024,
              "funding_raised": 250000.0,
              "valuation": 2000000.0,
              "employee_count": 5,
              "description": f"Scrape contents and PDF info parsed to seed a mock profile for {company_name}.",
              "traction": "Beta product live with 2 VC funds testing."
            }
        }

    async def _reconcile_and_persist(
        self,
        founder_data: Dict[str, Any],
        startup_data: Dict[str, Any],
        website_url: str | None,
        github_username: str | None
    ) -> Tuple[Founder, Startup]:
        """
        Performs deduplication against existing DB rows and inserts/updates postgres tables.
        """
        founder_email = founder_data.get("email", "").lower().strip()
        founder_name = founder_data.get("name", "").strip()
        startup_name = startup_data.get("name", "").strip()
        
        # Unique IDs
        founder_id = str(uuid.uuid4())
        startup_id = str(uuid.uuid4())
        
        # Offline mock persistence
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Local store update
            # Check if founder exists
            existing_founder = next((f for f in store.list_founders() if f.email.lower() == founder_email or f.name.lower() == founder_name.lower()), None)
            if existing_founder:
                # Merge fields
                existing_founder.bio = founder_data.get("bio") or existing_founder.bio
                existing_founder.skills = list(set(existing_founder.skills + founder_data.get("skills", [])))
                f_profile = existing_founder
            else:
                f_profile = Founder(
                    id=founder_id,
                    name=founder_name,
                    email=founder_email,
                    role=founder_data.get("role", "Founder"),
                    company=startup_name,
                    bio=founder_data.get("bio", ""),
                    previous_exits=founder_data.get("previous_exits", 0),
                    years_experience=founder_data.get("years_experience", 0),
                    education=founder_data.get("education", []),
                    skills=founder_data.get("skills", [])
                )
                store.list_founders().append(f_profile)
            
            # Check if startup exists
            existing_startup = next((s for s in store.list_startups() if s.name.lower() == startup_name.lower()), None)
            if existing_startup:
                # Reconcile founder_ids
                if f_profile.id not in existing_startup.founder_ids:
                    existing_startup.founder_ids.append(f_profile.id)
                s_profile = existing_startup
            else:
                s_profile = Startup(
                    id=startup_id,
                    name=startup_name,
                    tagline=startup_data.get("tagline", ""),
                    sector=startup_data.get("sector", "Other"),
                    stage=DealStage(startup_data.get("stage", "sourcing")),
                    location=startup_data.get("location", ""),
                    founded_year=startup_data.get("founded_year", 2024),
                    funding_raised=startup_data.get("funding_raised", 0),
                    valuation=startup_data.get("valuation", 0),
                    employee_count=startup_data.get("employee_count", 0),
                    founder_ids=[f_profile.id],
                    description=startup_data.get("description", ""),
                    traction=startup_data.get("traction", "")
                )
                store.list_startups().append(s_profile)
                
            return f_profile, s_profile

        # Real Supabase Persistence
        try:
            # 1. Deduplicate/Retrieve Founder
            f_res = supabase_client._client.table("founders")\
                .select("*")\
                .or_(f"email.ilike.{founder_email},full_name.ilike.{founder_name}")\
                .execute()
                
            if f_res.data:
                # Merge profile details
                f_record = f_res.data[0]
                founder_id = f_record["id"]
                merged_skills = list(set((f_record.get("skills") or []) + founder_data.get("skills", [])))
                
                f_update = supabase_client._client.table("founders").update({
                    "bio": founder_data.get("bio") or f_record.get("bio"),
                    "skills": merged_skills,
                    "company": startup_name
                }).eq("id", founder_id).execute()
                
                f_db = f_update.data[0]
            else:
                # Insert new founder
                f_insert = supabase_client._client.table("founders").insert({
                    "id": founder_id,
                    "full_name": founder_name,
                    "email": founder_email,
                    "role": founder_data.get("role", "Founder"),
                    "company": startup_name,
                    "bio": founder_data.get("bio", ""),
                    "previous_exits": founder_data.get("previous_exits", 0),
                    "years_experience": founder_data.get("years_experience", 0),
                    "education": founder_data.get("education", []),
                    "skills": founder_data.get("skills", []),
                    "linkedin_url": f"https://linkedin.com/in/{founder_name.lower().replace(' ', '')}"
                }).execute()
                f_db = f_insert.data[0]

            # Parse to Pydantic Model
            founder_profile = Founder(
                id=f_db["id"],
                name=f_db["full_name"],
                email=f_db["email"],
                role=f_db["role"],
                company=f_db["company"],
                bio=f_db["bio"],
                previous_exits=f_db["previous_exits"],
                years_experience=f_db["years_experience"],
                education=f_db["education"],
                skills=f_db["skills"]
            )

            # 2. Deduplicate/Retrieve Company
            c_res = supabase_client._client.table("startups")\
                .select("*")\
                .ilike("name", startup_name)\
                .execute()

            if c_res.data:
                c_record = c_res.data[0]
                startup_id = c_record["id"]
                merged_founders = list(set((c_record.get("founder_ids") or []) + [founder_id]))
                
                c_update = supabase_client._client.table("startups").update({
                    "founder_ids": merged_founders,
                    "description": startup_data.get("description") or c_record.get("description"),
                    "traction": startup_data.get("traction") or c_record.get("traction")
                }).eq("id", startup_id).execute()
                
                c_db = c_update.data[0]
            else:
                c_insert = supabase_client._client.table("startups").insert({
                    "id": startup_id,
                    "name": startup_name,
                    "tagline": startup_data.get("tagline", ""),
                    "sector": startup_data.get("sector", "Other"),
                    "stage": startup_data.get("stage", "sourcing"),
                    "location": startup_data.get("location", ""),
                    "founded_year": startup_data.get("founded_year", 2024),
                    "funding_raised": startup_data.get("funding_raised", 0),
                    "valuation": startup_data.get("valuation", 0),
                    "employee_count": startup_data.get("employee_count", 0),
                    "founder_ids": [founder_id],
                    "description": startup_data.get("description", ""),
                    "traction": startup_data.get("traction", "")
                }).execute()
                c_db = c_insert.data[0]

            startup_profile = Startup(
                id=c_db["id"],
                name=c_db["name"],
                tagline=c_db["tagline"],
                sector=c_db["sector"],
                stage=DealStage(c_db["stage"]),
                location=c_db["location"],
                founded_year=c_db["founded_year"],
                funding_raised=float(c_db["funding_raised"]),
                valuation=float(c_db["valuation"]),
                employee_count=c_db["employee_count"],
                founder_ids=c_db["founder_ids"],
                description=c_db["description"],
                traction=c_db["traction"]
            )

            # 3. Create company link if missing
            supabase_client._client.table("company_founders").upsert({
                "company_id": startup_id,
                "founder_id": founder_id,
                "role": founder_data.get("role", "founder"),
                "is_primary": True
            }, on_conflict="company_id, founder_id").execute()

            # 4. Optional: Save GitHub details into github_profiles
            if github_username:
                supabase_client._client.table("github_profiles").upsert({
                    "founder_id": founder_id,
                    "company_id": startup_id,
                    "github_username": github_username,
                    "last_synced_at": "now()"
                }, on_conflict="lower(github_username)").execute()

            return founder_profile, startup_profile

        except Exception as e:
            print(f"Supabase persistence error: {str(e)}")
            # Graceful fallback to return profiles even if DB write fails
            fallback_founder = Founder(
                id=founder_id,
                name=founder_name,
                email=founder_email,
                role=founder_data.get("role", "Founder"),
                company=startup_name,
                bio=founder_data.get("bio", ""),
                previous_exits=founder_data.get("previous_exits", 0),
                years_experience=founder_data.get("years_experience", 0),
                education=founder_data.get("education", []),
                skills=founder_data.get("skills", [])
            )
            fallback_startup = Startup(
                id=startup_id,
                name=startup_name,
                tagline=startup_data.get("tagline", ""),
                sector=startup_data.get("sector", "Other"),
                stage=DealStage(startup_data.get("stage", "sourcing")),
                location=startup_data.get("location", ""),
                founded_year=startup_data.get("founded_year", 2024),
                funding_raised=startup_data.get("funding_raised", 0),
                valuation=startup_data.get("valuation", 0),
                employee_count=startup_data.get("employee_count", 0),
                founder_ids=[founder_id],
                description=startup_data.get("description", ""),
                traction=startup_data.get("traction", "")
            )
            return fallback_founder, fallback_startup

    async def _index_ingested_documents(
        self,
        founder: Founder,
        startup: Startup,
        website_text: str,
        pdf_text: str,
        pdf_filename: str | None
    ):
        """
        Embeds the scraped website content and extracted PDF content and pushes them 
        to the Supabase vector table for semantic matching.
        """
        if not supabase_client.enabled or not openai_service.enabled:
            return
        
        try:
            # 1. Scraped Homepage Ingestion
            if website_text and len(website_text.strip()) > 100:
                web_doc_id = str(uuid.uuid4())
                web_title = f"Website homepage — {startup.name}"
                web_content = f"Company website text for {startup.name}. Traction: {startup.traction}. Tagline: {startup.tagline}. Description: {website_text}"
                
                embeddings = await openai_service.embed([web_content])
                await supabase_client.upsert_document(
                    id=web_doc_id,
                    source_type="startup",
                    source_id=startup.id,
                    title=web_title,
                    content=web_content[:1500],
                    embedding=embeddings[0],
                    metadata={"founder_id": founder.id, "website_scrape": True}
                )

            # 2. PDF Pitch Deck Ingestion
            if pdf_text and len(pdf_text.strip()) > 100:
                pdf_doc_id = str(uuid.uuid4())
                pdf_title = pdf_filename or f"Pitch Deck — {startup.name}"
                
                embeddings = await openai_service.embed([pdf_text])
                await supabase_client.upsert_document(
                    id=pdf_doc_id,
                    source_type="startup",
                    source_id=startup.id,
                    title=pdf_title,
                    content=pdf_text[:1500],
                    embedding=embeddings[0],
                    metadata={"founder_id": founder.id, "pitch_deck": True}
                )
        except Exception as e:
            print(f"Failed to embed and index documents semantically: {str(e)}")

ingestion_service = IngestionService()

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.models.schemas import DiscoveredFounder

MOCK_CANDIDATES = [
    {
        "full_name": "Elena Rostova",
        "email": "elena.rostova@tum.de",
        "source_platform": "arXiv",
        "platform_profile_url": "https://arxiv.org/search?query=Elena+Rostova",
        "bio": "Research Fellow at Munich, publishing 'Transformer Pruning Heuristics for Mobile Devices'. Specialist in compact LLM architectures.",
        "skills": ["Python", "PyTorch", "C++", "Model Compression"],
        "calculated_score": 92.0
    },
    {
        "full_name": "Sophie Dubois",
        "email": "sophie@langoptima.io",
        "source_platform": "Product Hunt",
        "platform_profile_url": "https://www.producthunt.com/posts/langoptima",
        "bio": "Founder of LangOptima. Launched low-latency parser APIs; reached #2 product of the day with 1,200 upvotes.",
        "skills": ["JavaScript", "Node.js", "Rust", "LLM APIs"],
        "calculated_score": 89.0
    },
    {
        "full_name": "Luca Bianchi",
        "email": "luca.bianchi@gmail.com",
        "source_platform": "GitHub",
        "platform_profile_url": "https://github.com/lucabianchi",
        "bio": "Active developer in Milan working on AI-driven load optimization libraries. Main author of 'GridFlow' (1.8k stars).",
        "skills": ["Go", "Python", "Docker", "Grid Systems"],
        "calculated_score": 84.0
    },
    {
        "full_name": "Raj Patel",
        "email": "raj.patel@blockchain.builders",
        "source_platform": "Devpost",
        "platform_profile_url": "https://devpost.com/rajpatel",
        "bio": "Won EthGlobal 2025 podium. Designed zero-knowledge transaction verifiers for credit checking.",
        "skills": ["Solidity", "Rust", "TypeScript", "Cryptography"],
        "calculated_score": 81.0
    },
    {
        "full_name": "Alex Mercer",
        "email": "alex@cacheprox.io",
        "source_platform": "Accelerators",
        "platform_profile_url": "https://www.ycombinator.com/companies/cacheprox",
        "bio": "YC W25 cohort founder. Built proxy servers reducing database read latencies by 80%. Formerly staff engineer at Snowflake.",
        "skills": ["C++", "Rust", "Kubernetes", "Databases"],
        "calculated_score": 78.0
    },
    {
        "full_name": "Clara Schmidt",
        "email": "clara@schmidt-labs.de",
        "source_platform": "arXiv",
        "platform_profile_url": "https://arxiv.org/search?query=Clara+Schmidt",
        "bio": "Postdoc working on multi-agent collaboration frameworks.",
        "skills": ["Python", "Reinforcement Learning"],
        "calculated_score": 72.0
    }
]

MOCK_STORE: List[DiscoveredFounder] = []

class DiscoveryService:
    async def scan_platforms(self, threshold: float) -> List[DiscoveredFounder] :
        """
        Scans developer profiles, preprint indices, and accelerator lists,
        scoring each candidate and drafting personalized outreach emails for those
        exceeding the score threshold.
        """
        discovered: List[DiscoveredFounder] = []
        scan_time = datetime.now(timezone.utc)

        # 1. Filter candidates exceeding threshold
        matching_candidates = [c for c in MOCK_CANDIDATES if c["calculated_score"] >= threshold]

        # 2. Process and generate AI email drafts for each matching candidate
        for c in matching_candidates:
            email_draft = await self._generate_personalized_email(c)
            df = DiscoveredFounder(
                id=str(uuid.uuid4()),
                full_name=c["full_name"],
                email=c["email"],
                source_platform=c["source_platform"],
                platform_profile_url=c["platform_profile_url"],
                bio=c["bio"],
                skills=c["skills"],
                calculated_score=c["calculated_score"],
                outreach_email=email_draft,
                outreach_status="draft",
                created_at=scan_time
            )
            
            # Save to PostgreSQL or local mock
            await self._save_discovered_founder(df)
            discovered.append(df)

        return discovered

    async def list_discovered(self) -> List[DiscoveredFounder]:
        """
        Retrieves all discovered lead entries sorted by rating.
        """
        if not settings.supabase_url or not settings.supabase_service_role_key:
            return sorted(MOCK_STORE, key=lambda f: f.calculated_score, reverse=True)

        try:
            res = supabase_client._client.table("discovered_founders").select("*").order("calculated_score", desc=True).execute()
            return [
                DiscoveredFounder(
                    id=row["id"],
                    full_name=row["full_name"],
                    email=row["email"],
                    source_platform=row["source_platform"],
                    platform_profile_url=row["platform_profile_url"],
                    bio=row["bio"],
                    skills=row["skills"],
                    calculated_score=float(row["calculated_score"]),
                    outreach_email=row["outreach_email"],
                    outreach_status=row["outreach_status"],
                    created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                )
                for row in (res.data or [])
            ]
        except Exception as e:
            print(f"Supabase list discovered founders failed: {str(e)}")
            return sorted(MOCK_STORE, key=lambda f: f.calculated_score, reverse=True)

    async def update_outreach(
        self,
        founder_id: str,
        status: str,
        email_body: str
    ) -> None:
        """
        Updates outreach status state and logs text updates.
        """
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock update
            f = next((x for x in MOCK_STORE if x.id == founder_id), None)
            if f:
                f.outreach_status = status
                f.outreach_email = email_body
            return

        try:
            supabase_client._client.table("discovered_founders").update({
                "outreach_status": status,
                "outreach_email": email_body
            }).eq("id", founder_id).execute()
        except Exception as e:
            print(f"Supabase update outreach status failed: {str(e)}")

    async def _save_discovered_founder(self, df: DiscoveredFounder) -> None:
        """
        Upserts candidate record inside PostgreSQL or local mock.
        """
        # Always update local list for consistency
        existing = next((x for x in MOCK_STORE if x.full_name == df.full_name), None)
        if existing:
            MOCK_STORE.remove(existing)
        MOCK_STORE.append(df)

        if not settings.supabase_url or not settings.supabase_service_role_key:
            return

        try:
            supabase_client._client.table("discovered_founders").upsert({
                "id": df.id,
                "full_name": df.full_name,
                "email": df.email,
                "source_platform": df.source_platform,
                "platform_profile_url": df.platform_profile_url,
                "bio": df.bio,
                "skills": df.skills,
                "calculated_score": df.calculated_score,
                "outreach_email": df.outreach_email,
                "outreach_status": df.outreach_status
            }).execute()
        except Exception as e:
            print(f"Supabase upsert discovered founder failed: {str(e)}")

    async def _generate_personalized_email(self, candidate: Dict[str, Any]) -> str:
        """
        Drafts a highly customized partner pitch email using OpenAI.
        """
        prompt = f"""
        You are a senior partner at VC Brain, an early-stage venture capital firm.
        Your task is to write a highly personalized, compelling, and warm outreach email to a promising candidate founder.

        Candidate Information:
        - Name: {candidate['full_name']}
        - Source: {candidate['source_platform']} (e.g. arXiv, Product Hunt, YC, GitHub)
        - Biography / Work description: {candidate['bio']}
        - Technical Skills: {', '.join(candidate['skills'])}
        - Calculated Rating Score: {candidate['calculated_score']:.0f}/100 (outstanding)

        Instructions:
        - Write a subject line that is engaging and highlights why you are reaching out.
        - Tweak the pitch based on the platform where we found them (e.g. congratulate them on their recent arXiv paper, compliment their Product Hunt launch, or praise their popular GitHub repository).
        - Keep the tone professional yet inviting and concise (2 paragraphs maximum).
        - Propose a brief virtual chat to explore their future project building goals.
        - Address them by name and sign off as 'VC Brain Venture Partners'.

        Format:
        Subject: [Engaging Subject Line]

        [Email Body]
        """.strip()

        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.7,
                    messages=[
                        {"role": "system", "content": "You are a professional Venture Capital investor. Output only the email text with Subject header."},
                        {"role": "user", "content": prompt}
                    ]
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                print(f"OpenAI personalized outreach email generation failed: {str(e)}")

        # Local fallback text
        return f"""Subject: Congratulations on your recent {candidate['source_platform']} project!

Hi {candidate['full_name']},

I was reviewing recent activity on {candidate['source_platform']} and came across your profile. Your work on {candidate['bio']} looks exceptional, and your domain expertise in {', '.join(candidate['skills'])} is highly relevant to trends we are tracking at VC Brain.

We focus on backing top-tier technical minds at the seed stage. I'd love to schedule a brief 15-minute chat to learn more about what you're working on and see if we can help you scale.

Let me know if you have time for a virtual coffee this week.

Best regards,
VC Brain Venture Partners"""

discovery_service = DiscoveryService()

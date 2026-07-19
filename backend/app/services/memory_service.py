import asyncio
import uuid
import json
import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from app.core.config import settings
from app.services.openai_service import openai_service
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.models.schemas import FounderTimelineEvent, MemoryResponse

# Local in-memory stores for developer mock mode
MOCK_EVIDENCE = [
    {
        "id": "e-mock-1",
        "founder_id": "f1",
        "evidence_type": "metric",
        "source_kind": "founder",
        "title": "Built Grid Optimization at Tesla",
        "body": "CTO Priya Shah led grid scaling systems at Tesla Energy, managing optimization algorithms for 10GW+ grid loads.",
        "confidence": 1.0,
        "observed_at": "2026-01-12T10:00:00Z",
    },
    {
        "id": "e-mock-2",
        "founder_id": "f2",
        "evidence_type": "quote",
        "source_kind": "company",
        "title": "$180M Acquisition Exit",
        "body": "Marcus Chen was CEO of Lattice AI's predecessor which was acquired for $180M in cash and stock.",
        "confidence": 0.95,
        "observed_at": "2026-02-03T11:00:00Z",
    }
]

MOCK_SCORES = [
    {
        "id": "s-mock-1",
        "founder_id": "f1",
        "score": 88.0,
        "rationale": "High score due to deep technical background at Tesla Energy and MS EE from Stanford.",
        "scored_at": "2026-06-20T08:00:00Z",
        "score_components": {"experience": 90, "exits": 60, "education": 95}
    },
    {
        "id": "s-mock-2",
        "founder_id": "f2",
        "score": 94.0,
        "rationale": "Exceptional track record including a prior $180M acquisition and PhD from MIT.",
        "scored_at": "2026-07-10T09:00:00Z",
        "score_components": {"experience": 95, "exits": 90, "education": 98}
    }
]

class MemoryService:
    async def add_memory(
        self,
        founder_id: str,
        title: str,
        body: str,
        observed_at: datetime | None = None,
        source_kind: str = "manual",
        confidence: float = 1.0
    ) -> Dict[str, Any]:
        """
        Ingests a new memory fact for a founder. Generates vector embedding, checks 
        for duplicate assertions using pgvector, recalculates the founder score, and stores everything in PostgreSQL.
        """
        observed_at_dt = observed_at or datetime.now(timezone.utc)
        observed_at_str = observed_at_dt.isoformat()
        
        # 1. Generate text embedding
        embedding = [0.0] * settings.embedding_dimensions
        if openai_service.enabled:
            try:
                embeddings = await openai_service.embed([body])
                embedding = embeddings[0]
            except Exception as e:
                print(f"OpenAI embedding generation failed in memory: {str(e)}")

        # 2. Check for duplicate logs (similarity threshold > 0.85)
        duplicate_id = await self._detect_duplicate(founder_id, embedding, title, body)
        
        evidence_id = duplicate_id or str(uuid.uuid4())
        
        # 3. Persist evidence
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Dev Fallback
            fact = {
                "id": evidence_id,
                "founder_id": founder_id,
                "evidence_type": "other",
                "source_kind": source_kind,
                "title": title,
                "body": body,
                "confidence": confidence,
                "observed_at": observed_at_str
            }
            if duplicate_id:
                # Update existing
                idx = next((i for i, x in enumerate(MOCK_EVIDENCE) if x["id"] == duplicate_id), -1)
                if idx != -1:
                    MOCK_EVIDENCE[idx] = fact
            else:
                MOCK_EVIDENCE.append(fact)
            
            # Recalculate score locally
            await self._recalculate_score_mock(founder_id)
            return fact

        try:
            # Live Supabase DB insert/upsert
            data_payload = {
                "id": evidence_id,
                "founder_id": founder_id,
                "evidence_type": "other",
                "source_kind": source_kind,
                "title": title,
                "body": body,
                "confidence": confidence,
                "observed_at": observed_at_str,
                "embedding": embedding
            }
            
            res = supabase_client._client.table("evidence").upsert(data_payload).execute()
            if not res.data:
                raise Exception("Database write returned empty response")
            
            inserted_fact = res.data[0]
            
            # Trigger score re-evaluation asynchronously in the background
            asyncio.create_task(self._recalculate_score_supabase(founder_id))
            
            return inserted_fact
        except Exception as e:
            print(f"Supabase evidence saving failed: {str(e)}")
            # Fail gracefully, return mock object so it doesn't crash user interactions
            return {
                "id": evidence_id,
                "founder_id": founder_id,
                "title": title,
                "body": body,
                "observed_at": observed_at_str,
                "source_kind": source_kind
            }

    async def get_timeline(self, founder_id: str) -> List[FounderTimelineEvent]:
        """
        Queries all evidence facts and historic scores, merging them into a unified chronological event log.
        """
        events: List[FounderTimelineEvent] = []

        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock Fallback timeline
            facts = [x for x in MOCK_EVIDENCE if x["founder_id"] == founder_id]
            scores = [x for x in MOCK_SCORES if x["founder_id"] == founder_id]
            
            for f in facts:
                ts = datetime.fromisoformat(f["observed_at"].replace("Z", "+00:00"))
                events.append(FounderTimelineEvent(
                    type="memory",
                    timestamp=ts,
                    title=f["title"],
                    description=f["body"],
                    metadata={"source": f["source_kind"], "confidence": f["confidence"]}
                ))
            
            for s in scores:
                ts = datetime.fromisoformat(s["scored_at"].replace("Z", "+00:00"))
                events.append(FounderTimelineEvent(
                    type="score",
                    timestamp=ts,
                    title=f"Founder Score Updated: {s['score']}%",
                    description=s["rationale"],
                    metadata={"score_components": s["score_components"]}
                ))
            
            events.sort(key=lambda e: e.timestamp, reverse=True)
            return events

        # Live Supabase queries
        try:
            # Fetch evidence
            ev_res = supabase_client._client.table("evidence")\
                .select("id, title, body, observed_at, source_kind, confidence")\
                .eq("founder_id", founder_id)\
                .is_("deleted_at", None)\
                .order("observed_at", desc=True)\
                .execute()
            
            # Fetch score history
            sc_res = supabase_client._client.table("founder_score_history")\
                .select("id, score, rationale, score_components, scored_at")\
                .eq("founder_id", founder_id)\
                .is_("deleted_at", None)\
                .order("scored_at", desc=True)\
                .execute()

            for f in (ev_res.data or []):
                ts = datetime.fromisoformat(f["observed_at"].replace("Z", "+00:00"))
                events.append(FounderTimelineEvent(
                    type="memory",
                    timestamp=ts,
                    title=f["title"],
                    description=f["body"],
                    metadata={"source": f["source_kind"], "confidence": float(f["confidence"] or 1.0)}
                ))

            for s in (sc_res.data or []):
                ts = datetime.fromisoformat(s["scored_at"].replace("Z", "+00:00"))
                events.append(FounderTimelineEvent(
                    type="score",
                    timestamp=ts,
                    title=f"Founder Score Updated: {s['score']}%",
                    description=s["rationale"],
                    metadata={"score_components": s["score_components"] or {}}
                ))

            events.sort(key=lambda e: e.timestamp, reverse=True)
            return events
        except Exception as e:
            print(f"Supabase timeline querying failed: {str(e)}")
            return []

    async def semantic_query(self, founder_id: str, query: str, limit: int = 10) -> List[MemoryResponse]:
        """
        Generates query embedding and runs a cosine similarity matching on the database matching memories.
        """
        if not query.strip():
            return []

        # 1. Embed query
        embedding = [0.0] * settings.embedding_dimensions
        if openai_service.enabled:
            try:
                embeddings = await openai_service.embed([query])
                embedding = embeddings[0]
            except Exception as e:
                print(f"OpenAI query embedding failed: {str(e)}")

        # 2. Query DB
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock fallback: simple substring query returning deterministic mock similarity
            facts = [x for x in MOCK_EVIDENCE if x["founder_id"] == founder_id]
            q = query.lower()
            results = []
            for f in facts:
                score = 0.5
                if q in f["title"].lower() or q in f["body"].lower():
                    score = 0.89
                results.append(MemoryResponse(
                    id=f["id"],
                    title=f["title"],
                    body=f["body"],
                    observed_at=datetime.fromisoformat(f["observed_at"].replace("Z", "+00:00")),
                    source_kind=f["source_kind"],
                    similarity=score
                ))
            results.sort(key=lambda r: r.similarity or 0.0, reverse=True)
            return results[:limit]

        try:
            res = supabase_client._client.rpc("match_evidence", {
                "query_embedding": embedding,
                "match_founder_id": founder_id,
                "match_count": limit
            }).execute()
            
            return [
                MemoryResponse(
                    id=row["id"],
                    title=row["title"],
                    body=row["body"],
                    observed_at=datetime.fromisoformat(row["observed_at"].replace("Z", "+00:00")) if row.get("observed_at") else None,
                    source_kind=row["source_kind"],
                    similarity=round(float(row.get("similarity", 0.0)), 4)
                )
                for row in (res.data or [])
            ]
        except Exception as e:
            print(f"Supabase RPC match_evidence execution failed: {str(e)}")
            return []

    async def _detect_duplicate(self, founder_id: str, embedding: List[float], title: str, body: str) -> str | None:
        """
        Checks if a highly similar fact already exists in the database.
        """
        # Offline mode duplicate detection
        if not settings.supabase_url or not settings.supabase_service_role_key:
            facts = [x for x in MOCK_EVIDENCE if x["founder_id"] == founder_id]
            for f in facts:
                # String duplicate check
                if f["title"].lower() == title.lower() or f["body"].lower() == body.lower():
                    return f["id"]
            return None

        # Live pgvector duplicate check
        try:
            res = supabase_client._client.rpc("match_evidence", {
                "query_embedding": embedding,
                "match_founder_id": founder_id,
                "match_count": 1
            }).execute()
            if res.data:
                top_match = res.data[0]
                # If similarity is above 0.85, treat it as a duplicate/re-assertion of the same fact
                if float(top_match.get("similarity", 0)) > 0.85:
                    return top_match["id"]
            return None
        except Exception as e:
            print(f"Duplicate detection query failed: {str(e)}")
            return None

    async def _recalculate_score_supabase(self, founder_id: str):
        """
        Triggers OpenAI to evaluate cumulative memories and score the founder out of 100.
        """
        try:
            # Query all active evidence logs
            ev_res = supabase_client._client.table("evidence")\
                .select("title, body, observed_at, confidence")\
                .eq("founder_id", founder_id)\
                .is_("deleted_at", None)\
                .execute()
            
            facts = ev_res.data or []
            if not facts:
                return

            score, rationale, components = await self._run_ai_scoring_model(facts)

            # Insert into database history log (this syncs to founders.current_founder_score via trigger)
            supabase_client._client.table("founder_score_history").insert({
                "founder_id": founder_id,
                "score": score,
                "rationale": rationale,
                "score_components": components,
                "model_version": settings.openai_chat_model
            }).execute()
        except Exception as e:
            print(f"Supabase score recalculation background thread failed: {str(e)}")

    async def _recalculate_score_mock(self, founder_id: str):
        """
        Mock score recalculator for offline mode.
        """
        facts = [x for x in MOCK_EVIDENCE if x["founder_id"] == founder_id]
        if not facts:
            return
        
        score, rationale, components = await self._run_ai_scoring_model(facts)
        
        # Save to mock list
        new_score = {
            "id": f"s-mock-{len(MOCK_SCORES) + 1}",
            "founder_id": founder_id,
            "score": score,
            "rationale": rationale,
            "scored_at": datetime.now(timezone.utc).isoformat(),
            "score_components": components
        }
        MOCK_SCORES.append(new_score)
        
        # Automatically update store seed data current score
        founder_seed = next((f for f in store.list_founders() if f.id == founder_id), None)
        if founder_seed:
            founder_seed.current_founder_score = score # update seed
            # We can also dynamically edit metadata or cache
            if not hasattr(founder_seed, "current_founder_score"):
                # seed schemas check
                pass

    async def _run_ai_scoring_model(self, facts: List[Dict[str, Any]]) -> Tuple[float, str, Dict[str, Any]]:
        """
        Formats evidence items, calls OpenAI, and parses the returned score and components.
        """
        facts_text = "\n".join([
            f"- Fact: {f.get('title')}. Description: {f.get('body')}. Observed: {f.get('observed_at')}"
            for f in facts
        ])

        prompt = f"""
        You are a venture capital investment algorithm.
        Your task is to re-evaluate the overall rating score of a founder based on their cumulative evidence logs.

        Provide:
        1. A cumulative Founder Score from 0 to 100 representing their credibility, capability, and execution record.
           - Grid: 90+ represents elite tier (top 1% builders, repeat founders with major exits, Tesla grid engineers)
           - Grid: 75-90 represents strong tier (deep technical background, exits, strong capability)
           - Grid: 50-75 represents promising, average tier (early career, standard credentials)
           - Grid: <50 represents high risk or low execution capacity.
        2. A clear, concise rationale (2 sentences) explaining the rating and what variables moved it.
        3. Score components: technical capacity (0-100), domain depth (0-100), execution history (0-100).

        Return ONLY a JSON object matching this schema:
        {{
          "score": 85.5,
          "rationale": "Rationale explanation...",
          "components": {{
            "technical_capacity": 90,
            "domain_depth": 85,
            "execution_history": 80
          }}
        }}

        Current Founder Evidence Logs:
        {facts_text}
        """.strip()

        if openai_service.enabled:
            try:
                response = await openai_service._client.chat.completions.create(
                    model=settings.openai_chat_model,
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise venture capital scoring engine. Output JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                )
                content = response.choices[0].message.content or "{}"
                data = json.loads(content)
                return float(data.get("score", 70.0)), data.get("rationale", "Updated profile facts re-analyzed."), data.get("components", {})
            except Exception as e:
                print(f"OpenAI scoring re-evaluation failed: {str(e)}")

        # Fallback local math calculation if OpenAI is offline
        base_score = 70.0
        for f in facts:
            # Deterministic adjustments for offline reviews
            body_lower = f.get("body", "").lower()
            if "tesla" in body_lower or "google" in body_lower or "mit" in body_lower or "exit" in body_lower:
                base_score += 8.0
            if "failed" in body_lower or "risk" in body_lower:
                base_score -= 5.0
        
        base_score = min(max(base_score, 0.0), 100.0)
        
        return (
            base_score,
            "Recalculated offline based on local evidence log adjustments.",
            {"technical_capacity": base_score, "domain_depth": base_score, "execution_history": base_score}
        )

memory_service = MemoryService()

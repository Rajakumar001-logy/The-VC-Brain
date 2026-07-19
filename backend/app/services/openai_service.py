from __future__ import annotations

import json
import math
from typing import Any

from app.core.config import settings
from app.models.schemas import MemoDraft


class OpenAIService:
    """Thin OpenAI wrapper with graceful offline fallbacks."""

    def __init__(self) -> None:
        self._client: Any | None = None
        if settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
            except Exception:
                self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not self._client:
            return [self._fallback_embedding(text) for text in texts]

        response = await self._client.embeddings.create(
            model=settings.openai_embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    async def generate_memo(
        self,
        *,
        startup_name: str,
        sector: str,
        description: str,
        traction: str,
        notes: str | None = None,
    ) -> MemoDraft:
        if not self._client:
            return MemoDraft(
                summary=(
                    f"{startup_name} operates in {sector}. {description} "
                    f"Current traction: {traction}."
                ),
                thesis=(
                    f"Category opportunity in {sector} favors teams that combine "
                    "domain depth with durable distribution."
                ),
                market=f"Growing {sector} spend with room for a category-defining platform.",
                team="Founding team shows relevant domain expertise; diligence on hiring plan recommended.",
                product=description,
                risks=[
                    "Competitive intensity",
                    "Go-to-market execution risk",
                    "Capital efficiency under longer sales cycles",
                ],
                recommendation="watch",
                conviction=62,
            )

        prompt = f"""
You are a venture capital associate writing an investment memo draft.
Return ONLY valid JSON with keys:
summary, thesis, market, team, product, risks (array of strings),
recommendation (invest|pass|watch), conviction (0-100 integer).

Company: {startup_name}
Sector: {sector}
Description: {description}
Traction: {traction}
Analyst notes: {notes or "None"}
""".strip()

        response = await self._client.chat.completions.create(
            model=settings.openai_chat_model,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You write concise, rigorous VC investment memos.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        return MemoDraft.model_validate(data)

    def _fallback_embedding(self, text: str) -> list[float]:
        """Deterministic pseudo-embedding for local/dev without OpenAI."""
        dim = settings.embedding_dimensions
        values = [0.0] * dim
        tokens = text.lower().split()
        if not tokens:
            return values

        for i, token in enumerate(tokens):
            idx = (hash(token) % dim + dim) % dim
            values[idx] += 1.0 + (i % 7) * 0.01

        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        return [v / norm for v in values]


openai_service = OpenAIService()

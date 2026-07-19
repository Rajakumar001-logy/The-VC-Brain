from __future__ import annotations

from typing import Any

from app.core.config import settings


class SupabaseClient:
    def __init__(self) -> None:
        self._client: Any | None = None
        if settings.supabase_url and settings.supabase_service_role_key:
            try:
                from supabase import create_client

                self._client = create_client(
                    settings.supabase_url,
                    settings.supabase_service_role_key,
                )
            except Exception:
                self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def match_documents(
        self,
        *,
        embedding: list[float],
        match_count: int = 10,
    ) -> list[dict[str, Any]]:
        if not self._client:
            return []

        response = (
            self._client.rpc(
                "match_documents",
                {
                    "query_embedding": embedding,
                    "match_count": match_count,
                },
            )
            .execute()
        )
        return response.data or []

    async def upsert_document(
        self,
        *,
        id: str,
        source_type: str,
        source_id: str,
        title: str,
        content: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if not self._client:
            return

        self._client.table("documents").upsert(
            {
                "id": id,
                "source_type": source_type,
                "source_id": source_id,
                "title": title,
                "content": content,
                "embedding": embedding,
                "metadata": metadata or {},
            }
        ).execute()


supabase_client = SupabaseClient()

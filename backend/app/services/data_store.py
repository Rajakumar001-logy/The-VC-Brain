from app.models.schemas import Founder, InvestmentMemo, Startup
from app.services import seed_data


class DataStore:
    def list_founders(self) -> list[Founder]:
        return seed_data.FOUNDERS

    def get_founder(self, founder_id: str) -> Founder | None:
        return next((f for f in seed_data.FOUNDERS if f.id == founder_id), None)

    def search_founders(self, query: str) -> list[Founder]:
        q = query.lower()
        return [
            f
            for f in seed_data.FOUNDERS
            if q in f.name.lower()
            or q in f.company.lower()
            or any(q in s.lower() for s in f.skills)
        ]

    def list_startups(self) -> list[Startup]:
        return seed_data.STARTUPS

    def get_startup(self, startup_id: str) -> Startup | None:
        return next((s for s in seed_data.STARTUPS if s.id == startup_id), None)

    def list_memos(self) -> list[InvestmentMemo]:
        return seed_data.MEMOS

    def get_memo(self, memo_id: str) -> InvestmentMemo | None:
        return next((m for m in seed_data.MEMOS if m.id == memo_id), None)


store = DataStore()

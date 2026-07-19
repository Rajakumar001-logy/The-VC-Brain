from datetime import datetime, timezone
from typing import Dict, Any, List

from app.core.config import settings
from app.services.supabase_client import supabase_client
from app.services.data_store import store
from app.services.discovery_service import MOCK_STORE

class DashboardService:
    async def get_dashboard_metrics(self) -> Dict[str, Any]:
        """
        Gathers database statistics and aggregates pipeline values,
        score/trust distribution counts, and recent discoveries.
        """
        # Default empty structures
        founders = []
        startups = []
        memos = []
        discoveries = []

        # 1. Fetch raw data
        if not settings.supabase_url or not settings.supabase_service_role_key:
            # Mock Fallback
            founders = [{
                "name": f.name,
                "company": f.company,
                "score": f.current_founder_score if hasattr(f, "current_founder_score") else 75,
                "trust": f.current_trust_score if hasattr(f, "current_trust_score") else 60
            } for f in store.list_founders()]
            
            startups = [{
                "name": s.name,
                "sector": s.sector,
                "stage": s.stage.value,
                "valuation": s.valuation,
                "traction": s.traction,
                "created_at": datetime.now(timezone.utc)
            } for s in store.list_startups()]
            
            memos = [{
                "id": m.id,
                "title": m.title,
                "startup_name": m.startup_name,
                "status": m.status,
                "recommendation": m.recommendation,
                "conviction": m.conviction,
                "updated_at": m.updated_at or datetime.now(timezone.utc)
            } for m in store.list_memos()]
            
            discoveries = [{
                "full_name": d.full_name,
                "source_platform": d.source_platform,
                "calculated_score": d.calculated_score,
                "outreach_status": d.outreach_status,
                "created_at": d.created_at
            } for d in MOCK_STORE]
        else:
            try:
                # Live Supabase Fetch
                f_res = supabase_client._client.table("founders").select("full_name, company, current_founder_score, current_trust_score").execute()
                founders = [{
                    "name": row["full_name"],
                    "company": row["company"],
                    "score": float(row["current_founder_score"] or 70.0),
                    "trust": float(row["current_trust_score"] or 50.0)
                } for row in (f_res.data or [])]

                s_res = supabase_client._client.table("startups").select("name, sector, stage, valuation, traction, created_at").execute()
                startups = [{
                    "name": row["name"],
                    "sector": row["sector"],
                    "stage": row["stage"],
                    "valuation": float(row["valuation"] or 0.0),
                    "traction": row["traction"],
                    "created_at": datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                } for row in (s_res.data or [])]

                m_res = supabase_client._client.table("investment_memos").select("id, title, company_id, recommendation_status, recommendation_check_size, metadata, updated_at").execute()
                memos = []
                for row in (m_res.data or []):
                    meta = row.get("metadata") or {}
                    # Lookup company name from startups list
                    comp_id = row.get("company_id")
                    comp_name = "NovaGrid"
                    for s in startups:
                        if hasattr(s, "id") and s.id == comp_id:
                            comp_name = s["name"]
                            break
                    memos.append({
                        "id": row["id"],
                        "title": row["title"],
                        "startup_name": comp_name,
                        "status": "draft",
                        "recommendation": row["recommendation_status"],
                        "conviction": int(meta.get("confidence_score", 70)),
                        "updated_at": datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
                    })

                disc_res = supabase_client._client.table("discovered_founders").select("full_name, source_platform, calculated_score, outreach_status, created_at").execute()
                discoveries = [{
                    "full_name": row["full_name"],
                    "source_platform": row["source_platform"],
                    "calculated_score": float(row["calculated_score"]),
                    "outreach_status": row["outreach_status"],
                    "created_at": datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
                } for row in (disc_res.data or [])]
            except Exception as e:
                print(f"Supabase dashboard compilation queries failed: {str(e)}")

        # 2. Run Aggregations
        total_founders_count = len(founders)
        
        # Sort founders by score for Top Founders
        top_founders = sorted(founders, key=lambda f: f["score"], reverse=True)[:5]

        # Active applications
        active_applications = [s for s in startups if s["stage"] in ["sourcing", "screening", "diligence"]][:5]
        
        # Pipeline value & stages funnel
        pipeline_stages = {"sourcing": 0, "screening": 0, "diligence": 0, "ic": 0, "closed": 0}
        total_val = 0.0
        for s in startups:
            stage = s["stage"].lower()
            if stage in pipeline_stages:
                pipeline_stages[stage] += 1
            # Weighted ask size estimate (10% of valuation)
            total_val += (s["valuation"] * 0.1)

        # Average Conviction
        total_conviction = sum(m["conviction"] for m in memos)
        avg_conv = (total_conviction / len(memos)) if memos else 70.0

        # Founder score distribution bands (50-60, 60-70, 70-80, 80-90, 90-100)
        f_dist = {"50-60": 0, "60-70": 0, "70-80": 0, "80-90": 0, "90-100": 0}
        for f in founders:
            s = f["score"]
            if 50 <= s < 60:
                f_dist["50-60"] += 1
            elif 60 <= s < 70:
                f_dist["60-70"] += 1
            elif 70 <= s < 80:
                f_dist["70-80"] += 1
            elif 80 <= s < 90:
                f_dist["80-90"] += 1
            elif 90 <= s <= 100:
                f_dist["90-100"] += 1

        # Trust score distribution bands (0-20, 20-40, 40-60, 60-80, 80-100)
        t_dist = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
        for f in founders:
            t = f["trust"]
            if 0 <= t < 20:
                t_dist["0-20"] += 1
            elif 20 <= t < 40:
                t_dist["20-40"] += 1
            elif 40 <= t < 60:
                t_dist["40-60"] += 1
            elif 60 <= t < 80:
                t_dist["60-80"] += 1
            elif 80 <= t <= 100:
                t_dist["80-100"] += 1

        # Recent discoveries sorted by created_at desc
        recent_discoveries = sorted(discoveries, key=lambda d: d["created_at"], reverse=True)[:5]
        
        # Recent memos sorted by updated_at desc
        recent_memos = sorted(memos, key=lambda m: m["updated_at"], reverse=True)[:5]

        # Convert datetimes to strings for JSON serializations
        for app in active_applications:
            if isinstance(app["created_at"], datetime):
                app["created_at"] = app["created_at"].isoformat()
        
        for d in recent_discoveries:
            if isinstance(d["created_at"], datetime):
                d["created_at"] = d["created_at"].isoformat()
                
        for m in recent_memos:
            if isinstance(m["updated_at"], datetime):
                m["updated_at"] = m["updated_at"].isoformat()

        return {
            "total_founders": total_founders_count,
            "top_founders": top_founders,
            "recent_applications": active_applications,
            "pipeline_stages": pipeline_stages,
            "pipeline_value": total_val,
            "avg_conviction": avg_conv,
            "active_deals_count": len(startups),
            "memos_count": len(memos),
            "founder_score_distribution": f_dist,
            "trust_score_distribution": t_dist,
            "recent_discoveries": recent_discoveries,
            "recent_memos": recent_memos
        }

dashboard_service = DashboardService()

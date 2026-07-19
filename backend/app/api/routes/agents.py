from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.agent_schemas import AgentRunRequest, AgentRunResponse
from app.services.multi_agent_system import supervisor_agent

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/run", response_model=AgentRunResponse)
async def run_multi_agent_pipeline(
    payload: AgentRunRequest
):
    """
    Triggers the Supervisor Agent to orchestrate the venture intelligence pipeline,
    crawling data, scoring, researching, and generating an investment memo.
    """
    try:
        response = await supervisor_agent.orchestrate_pipeline(
            request_payload={
                "company_name": payload.company_name,
                "website": payload.website,
                "github": payload.github,
                "notes": payload.notes
            },
            retries_limit=payload.retries_limit
        )
        return AgentRunResponse(
            status=response["status"],
            logs=response["logs"],
            final_memo_id=response.get("final_memo_id"),
            output_payload=response.get("output_payload", {})
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Multi-Agent orchestration failed: {str(e)}"
        )

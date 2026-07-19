from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class AgentLogEntry(BaseModel):
    timestamp: str
    agent_name: str
    message: str
    status: str  # 'info', 'warning', 'success', 'error', 'retry'

class AgentRunRequest(BaseModel):
    company_name: str
    website: Optional[str] = None
    github: Optional[str] = None
    notes: Optional[str] = None
    retries_limit: int = 3

class AgentRunResponse(BaseModel):
    status: str
    logs: List[AgentLogEntry]
    final_memo_id: Optional[str] = None
    output_payload: Dict[str, Any]

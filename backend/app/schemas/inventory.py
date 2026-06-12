from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ReconciliationResponse(BaseModel):
    id: int
    status: str
    total_csv_assets: int
    total_json_assets: int
    missing_assets_count: int
    untracked_assets_count: int
    config_mismatch_count: int
    naming_mismatch_count: int
    ai_analysis: Optional[str] = None
    recommendations: Optional[Dict[str, Any]] = None
    executive_summary: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None
    class Config:
        from_attributes = True

class ReconciliationStartRequest(BaseModel):
    csv_upload_id: int
    json_upload_id: int

class ChatbotQueryRequest(BaseModel):
    query: str
    reconciliation_id: Optional[int] = None

class ChatbotQueryResponse(BaseModel):
    query: str
    response: str
    sources: List[str]

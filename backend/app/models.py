from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Citation(BaseModel):
    text: str
    page: Optional[int] = None
    section: Optional[str] = None
    file_name: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    java_version: str  # "5", "8", "17", "21"

class ChatResponse(BaseModel):
    session_id: str
    response: str
    citations: List[Citation]
    source_version: str
    timestamp: datetime
    cache_hit: bool
    tokens_used: Optional[dict] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    citations: Optional[List[Citation]] = None
    timestamp: datetime

class ChatHistory(BaseModel):
    session_id: str
    created_at: datetime
    messages: List[ChatMessage]

class VersionResponse(BaseModel):
    versions: List[str]
    default: str

class HealthResponse(BaseModel):
    status: str
    postgres: bool
    redis: bool
    chroma: bool

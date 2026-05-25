from datetime import datetime
from typing import Literal, List, Optional

from pydantic import BaseModel, Field, field_validator


class Citation(BaseModel):
    text: str
    page: Optional[int] = None
    section: Optional[str] = None
    file_name: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=10_000)
    java_version: Literal["8", "17", "21"]

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message cannot be empty or whitespace only")
        return v


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


class SessionSummary(BaseModel):
    session_id: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_java_version: Optional[str] = None
    first_message: Optional[str] = None


class SessionsResponse(BaseModel):
    sessions: List[SessionSummary]
    total: int


class HealthResponse(BaseModel):
    status: str
    postgres: bool
    redis: bool
    chroma: bool
    rag_ready: bool = False

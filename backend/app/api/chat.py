import logging
import uuid
from functools import lru_cache

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agents.orchestrator import OrchestratorAgent
from app.auth.dependencies import get_current_user
from app.config import config
from app.database import User, get_db
from app.models import ChatRequest, ChatResponse
from app.rag.embedder import Embedder
from app.rag.retriever import Retriever
from app.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@lru_cache(maxsize=1)
def _get_retriever() -> Retriever:
    vector_store = VectorStore(config.CHROMA_PATH)
    embedder = Embedder(config.EMBEDDING_MODEL)
    return Retriever(vector_store, embedder)


def get_agent() -> OrchestratorAgent:
    return OrchestratorAgent(_get_retriever())


@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatResponse:
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(
        "Chat request: version=%s session=%s user=%s",
        request.java_version,
        session_id,
        user.email,
    )
    return get_agent().process_query(
        db=db,
        session_id=session_id,
        user_query=request.message,
        java_version=request.java_version,
        user_id=user.id,
    )


@router.post("/stream")
def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session_id = request.session_id or str(uuid.uuid4())
    logger.info(
        "Stream request: version=%s session=%s user=%s",
        request.java_version,
        session_id,
        user.email,
    )
    return StreamingResponse(
        get_agent().stream_query(
            db=db,
            session_id=session_id,
            user_query=request.message,
            java_version=request.java_version,
            user_id=user.id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

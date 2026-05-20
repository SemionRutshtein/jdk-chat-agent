import logging
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models import ChatRequest, ChatResponse
from app.agents.orchestrator import OrchestratorAgent
from app.rag.retriever import Retriever
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

_agent = None

def get_agent() -> OrchestratorAgent:
    global _agent
    if _agent is None:
        vector_store = VectorStore(config.CHROMA_PATH)
        embedder = Embedder(config.EMBEDDING_MODEL)
        retriever = Retriever(vector_store, embedder)
        _agent = OrchestratorAgent(retriever)
    return _agent

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if request.java_version not in ["8", "17", "21"]:
        raise HTTPException(status_code=400, detail="Invalid Java version. Must be one of: 8, 17, 21")

    session_id = request.session_id or str(uuid.uuid4())
    logger.info(f"Chat request: version={request.java_version} session={session_id}")
    return get_agent().process_query(session_id=session_id, user_query=request.message, java_version=request.java_version)


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    if request.java_version not in ["8", "17", "21"]:
        raise HTTPException(status_code=400, detail="Invalid Java version. Must be one of: 8, 17, 21")

    session_id = request.session_id or str(uuid.uuid4())
    logger.info(f"Stream request: version={request.java_version} session={session_id}")

    return StreamingResponse(
        get_agent().stream_query(
            session_id=session_id,
            user_query=request.message,
            java_version=request.java_version,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering if behind proxy
        },
    )

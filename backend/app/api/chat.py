from fastapi import APIRouter, HTTPException
from app.models import ChatRequest, ChatResponse
from app.agents.orchestrator import OrchestratorAgent
from app.rag.retriever import Retriever
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config
import uuid

router = APIRouter(prefix="/api/chat", tags=["chat"])

vector_store = VectorStore(config.CHROMA_PATH)
embedder = Embedder(config.EMBEDDING_MODEL)
retriever = Retriever(vector_store, embedder)
agent = OrchestratorAgent(retriever)

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if request.java_version not in ["5", "8", "17", "21"]:
        raise HTTPException(status_code=400, detail="Invalid Java version. Must be one of: 5, 8, 17, 21")

    session_id = request.session_id or str(uuid.uuid4())
    return agent.process_query(session_id=session_id, user_query=request.message, java_version=request.java_version)

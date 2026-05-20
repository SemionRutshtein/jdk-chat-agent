from fastapi import APIRouter
from app.models import HealthResponse
from app.database import engine
from app.redis_client import redis_client
from app.config import config
from app.rag.vector_store import VectorStore
import sqlalchemy

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    postgres_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        postgres_ok = True
    except Exception:
        pass

    redis_ok = False
    try:
        redis_client.client.ping()
        redis_ok = True
    except Exception:
        pass

    chroma_ok = False
    try:
        vs = VectorStore(config.CHROMA_PATH)
        vs.get_or_create_collection("5")
        chroma_ok = True
    except Exception:
        pass

    return HealthResponse(
        status="ok" if all([postgres_ok, redis_ok, chroma_ok]) else "degraded",
        postgres=postgres_ok,
        redis=redis_ok,
        chroma=chroma_ok
    )

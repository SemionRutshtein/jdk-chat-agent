import logging
from functools import lru_cache

import sqlalchemy
from fastapi import APIRouter

from app.config import config
from app.database import engine
from app.models import HealthResponse
from app.rag.vector_store import VectorStore
from app.redis_client import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/health", tags=["health"])


@lru_cache(maxsize=1)
def _get_vector_store() -> VectorStore:
    return VectorStore(config.CHROMA_PATH)


@router.get("", response_model=HealthResponse)
def health_check() -> HealthResponse:
    postgres_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        postgres_ok = True
    except Exception:
        logger.warning("Postgres health check failed", exc_info=True)

    redis_ok = False
    try:
        redis_client.client.ping()
        redis_ok = True
    except Exception:
        logger.warning("Redis health check failed", exc_info=True)

    chroma_ok = False
    rag_ready = False
    try:
        vs = _get_vector_store()
        col = vs.get_or_create_collection("8")
        count = col.count()
        chroma_ok = True
        rag_ready = count > 0
    except Exception:
        logger.warning("Chroma health check failed", exc_info=True)

    overall = "ok" if all([postgres_ok, redis_ok, chroma_ok]) else "degraded"
    logger.debug(
        "Health: postgres=%s redis=%s chroma=%s rag_ready=%s",
        postgres_ok, redis_ok, chroma_ok, rag_ready,
    )
    return HealthResponse(
        status=overall,
        postgres=postgres_ok,
        redis=redis_ok,
        chroma=chroma_ok,
        rag_ready=rag_ready,
    )

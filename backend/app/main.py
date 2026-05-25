import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, health, history, sessions, versions
from app.auth import router as auth_router
from app.config import config
from app.database import init_db

logging.basicConfig(
    level=logging.DEBUG if config.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.validate()
    init_db()
    logger.info("Application startup complete")
    yield
    logger.info("Application shutdown")


app = FastAPI(
    title="Java RAG Agent API",
    description="AI-powered Java documentation assistant",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router.router)
app.include_router(chat.router)
app.include_router(history.router)
app.include_router(sessions.router)
app.include_router(versions.router)
app.include_router(health.router)


@app.get("/")
async def root():
    return {
        "message": "Java RAG Agent API",
        "endpoints": {
            "chat": "POST /api/chat",
            "history": "GET /api/history/{session_id}",
            "sessions": "GET /api/sessions",
            "versions": "GET /api/versions",
            "health": "GET /api/health",
        },
    }

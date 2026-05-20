import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, history, versions, health, sessions
from app.auth import router as auth_router
from app.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Java RAG Agent API",
    description="AI-powered Java documentation assistant",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()  # create tables (idempotent)

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
            "health": "GET /api/health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

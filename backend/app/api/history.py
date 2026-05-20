from fastapi import APIRouter, Depends, HTTPException
from app.models import ChatHistory, ChatMessage
from app.database import SessionLocal, ChatSession, User
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("/{session_id}", response_model=ChatHistory)
async def get_chat_history(session_id: str, user: User = Depends(get_current_user)) -> ChatHistory:
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter_by(id=session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        messages = [
            ChatMessage(role=msg.role, content=msg.content, citations=msg.citations, timestamp=msg.created_at)
            for msg in session.messages
        ]

        return ChatHistory(session_id=session_id, created_at=session.created_at, messages=messages)
    finally:
        db.close()

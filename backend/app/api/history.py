from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import ChatSession, User, get_db
from app.models import ChatHistory, ChatMessage

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/{session_id}", response_model=ChatHistory)
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatHistory:
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session or (session.user_id and session.user_id != user.id):
        raise HTTPException(status_code=404, detail="Session not found")

    messages = [
        ChatMessage(
            role=msg.role,
            content=msg.content,
            citations=msg.citations,
            timestamp=msg.created_at,
        )
        for msg in session.messages
    ]
    return ChatHistory(
        session_id=session_id, created_at=session.created_at, messages=messages
    )

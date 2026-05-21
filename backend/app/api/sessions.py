import logging
from fastapi import APIRouter, Depends, Query
from app.models import SessionSummary, SessionsResponse
from app.database import SessionLocal, ChatSession, ChatMessage, User
from app.auth.dependencies import get_current_user
from sqlalchemy import func

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.get("", response_model=SessionsResponse)
async def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
) -> SessionsResponse:
    """List all chat sessions, newest first."""
    db = SessionLocal()
    try:
        total = db.query(func.count(ChatSession.id)).filter(ChatSession.user_id == user.id).scalar()

        sessions = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user.id)
            .order_by(ChatSession.updated_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        summaries = []
        for s in sessions:
            msg_count = len(s.messages)
            last_version = None
            first_message = None
            for msg in s.messages:
                if msg.role == "user" and first_message is None:
                    first_message = msg.content[:80]
                if msg.java_version and last_version is None:
                    pass
            for msg in reversed(s.messages):
                if msg.java_version:
                    last_version = msg.java_version
                    break

            summaries.append(SessionSummary(
                session_id=s.id,
                created_at=s.created_at,
                updated_at=s.updated_at,
                message_count=msg_count,
                last_java_version=last_version,
                first_message=first_message,
            ))

        logger.info(f"Listed {len(summaries)} sessions (total={total})")
        return SessionsResponse(sessions=summaries, total=total)
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        return SessionsResponse(sessions=[], total=0)
    finally:
        db.close()

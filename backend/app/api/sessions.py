import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import ChatSession, User, get_db
from app.models import SessionSummary, SessionsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=SessionsResponse)
def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionsResponse:
    user_filter = or_(ChatSession.user_id == user.id, ChatSession.user_id == None)
    total: int = db.query(func.count(ChatSession.id)).filter(user_filter).scalar() or 0

    sessions = (
        db.query(ChatSession)
        .filter(user_filter)
        .order_by(ChatSession.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    summaries = []
    for s in sessions:
        first_message: str | None = None
        last_version: str | None = None

        for msg in s.messages:
            if msg.role == "user" and first_message is None:
                first_message = msg.content[:80]
            if msg.java_version:
                last_version = msg.java_version  # last occurrence wins

        summaries.append(SessionSummary(
            session_id=s.id,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=len(s.messages),
            last_java_version=last_version,
            first_message=first_message,
        ))

    logger.info("Listed %d sessions (total=%d)", len(summaries), total)
    return SessionsResponse(sessions=summaries, total=total)

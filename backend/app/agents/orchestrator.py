import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Generator, List, Optional

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import config
from app.database import ChatMessage, ChatSession
from app.models import ChatResponse, Citation
from app.rag.retriever import Retriever
from app.redis_client import redis_client
from .prompts import get_system_prompt

logger = logging.getLogger(__name__)

_MAX_HISTORY = 10
_MAX_TOKENS = 2000
_RAG_K = 5
_CONTEXT_SNIPPET = 800


class OrchestratorAgent:
    def __init__(self, retriever: Retriever) -> None:
        self.retriever = retriever
        self.client = Anthropic(api_key=config.CLAUDE_API_KEY)

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _generate_cache_key(self, query: str, java_version: str) -> str:
        key_hash = hashlib.md5(f"{java_version}:{query}".encode()).hexdigest()
        return f"query:{key_hash}"

    def _get_history_messages(
        self, session_id: str, db: Session, limit: int = _MAX_HISTORY
    ) -> List[dict]:
        try:
            rows = (
                db.query(ChatMessage)
                .filter_by(session_id=session_id)
                .order_by(ChatMessage.created_at.asc())
                .limit(limit)
                .all()
            )
            return [{"role": row.role, "content": row.content} for row in rows]
        except Exception:
            logger.warning(
                "Could not fetch history for session %s", session_id, exc_info=True
            )
            return []

    def _extract_citations(
        self, answer: str, retrieved_docs: List[dict]
    ) -> List[Citation]:
        citations: List[Citation] = []
        seen: set[str] = set()
        for cited_text in re.findall(r"\[([^\]]{5,200})\]", answer):
            if cited_text in seen:
                continue
            for doc in retrieved_docs:
                if cited_text.lower() in doc["text"].lower():
                    citations.append(Citation(
                        text=cited_text,
                        file_name=doc["metadata"].get("source", "unknown"),
                        section=doc["metadata"].get("section"),
                        page=doc["metadata"].get("page"),
                    ))
                    seen.add(cited_text)
                    break
        return citations

    def _build_context(self, retrieved_docs: List[dict]) -> str:
        return "\n\n---\n\n".join(
            f"[From: {doc['metadata'].get('source', 'unknown')}]\n{doc['text'][:_CONTEXT_SNIPPET]}..."
            for doc in retrieved_docs
        )

    def _save_messages(
        self,
        db: Session,
        session_id: str,
        user_id: Optional[str],
        query: str,
        response: str,
        citations: List[Citation],
        java_version: str,
    ) -> None:
        try:
            session = db.query(ChatSession).filter_by(id=session_id).first()
            if not session:
                session = ChatSession(id=session_id, user_id=user_id)
                db.add(session)

            db.add(ChatMessage(
                session_id=session_id,
                role="user",
                content=query,
                java_version=java_version,
            ))
            db.add(ChatMessage(
                session_id=session_id,
                role="assistant",
                content=response,
                citations=[c.model_dump() for c in citations],
                java_version=java_version,
            ))
            session.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            logger.error(
                "Failed to persist messages for session %s", session_id, exc_info=True
            )
            db.rollback()

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def process_query(
        self,
        db: Session,
        session_id: Optional[str],
        user_query: str,
        java_version: str,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        cache_key = self._generate_cache_key(user_query, java_version)
        has_history = bool(
            session_id and self._get_history_messages(session_id, db, limit=1)
        )

        if not has_history:
            cached = redis_client.get(cache_key)
            if cached:
                logger.info("Cache hit: version=%s key=%s", java_version, cache_key)
                return ChatResponse(
                    session_id=session_id or "unknown",
                    response=cached["response"],
                    citations=[Citation(**c) for c in cached["citations"]],
                    source_version=java_version,
                    timestamp=datetime.utcnow(),
                    cache_hit=True,
                )

        logger.info("Cache miss: version=%s query=%.60r", java_version, user_query)
        retrieved_docs = self.retriever.retrieve(user_query, java_version, k=_RAG_K)

        if not retrieved_docs:
            return ChatResponse(
                session_id=session_id or "unknown",
                response=(
                    f"The Java {java_version} documentation index is still being built "
                    "(first-boot seeding). Please wait a few minutes and try again."
                ),
                citations=[],
                source_version=java_version,
                timestamp=datetime.utcnow(),
                cache_hit=False,
            )

        context = self._build_context(retrieved_docs)
        system_prompt = get_system_prompt(java_version, context)
        history = (
            self._get_history_messages(session_id, db, limit=_MAX_HISTORY)
            if session_id
            else []
        )
        messages = history + [{"role": "user", "content": user_query}]

        answer = ""
        tokens_used = None
        try:
            api_response = self.client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=_MAX_TOKENS,
                system=system_prompt,
                messages=messages,
            )
            answer = api_response.content[0].text
            tokens_used = {
                "prompt_tokens": api_response.usage.input_tokens,
                "completion_tokens": api_response.usage.output_tokens,
            }
            logger.info(
                "Claude response: tokens_in=%d tokens_out=%d",
                tokens_used["prompt_tokens"],
                tokens_used["completion_tokens"],
            )
        except Exception:
            logger.error("Claude API error", exc_info=True)
            answer = "An error occurred while contacting the Claude API. Please try again."

        citations = self._extract_citations(answer, retrieved_docs)

        if session_id:
            self._save_messages(
                db, session_id, user_id, user_query, answer, citations, java_version
            )

        redis_client.set(
            cache_key,
            {"response": answer, "citations": [c.model_dump() for c in citations]},
        )

        return ChatResponse(
            session_id=session_id or "unknown",
            response=answer,
            citations=citations,
            source_version=java_version,
            timestamp=datetime.utcnow(),
            cache_hit=False,
            tokens_used=tokens_used,
        )

    def stream_query(
        self,
        db: Session,
        session_id: Optional[str],
        user_query: str,
        java_version: str,
        user_id: Optional[str] = None,
    ) -> Generator[str, None, None]:
        def sse(event: dict) -> str:
            return f"data: {json.dumps(event)}\n\n"

        retrieved_docs = self.retriever.retrieve(user_query, java_version, k=_RAG_K)

        if not retrieved_docs:
            if session_id:
                self._save_messages(
                    db, session_id, user_id, user_query, "", [], java_version
                )
            yield sse({
                "type": "token",
                "text": (
                    f"The Java {java_version} documentation index is still being built "
                    "(first-boot seeding). Please wait a few minutes and try again."
                ),
            })
            yield sse({"type": "citations", "citations": []})
            yield sse({"type": "done"})
            return

        context = self._build_context(retrieved_docs)
        system_prompt = get_system_prompt(java_version, context)
        history = (
            self._get_history_messages(session_id, db, limit=_MAX_HISTORY)
            if session_id
            else []
        )
        messages = history + [{"role": "user", "content": user_query}]

        full_answer = ""
        try:
            with self.client.messages.stream(
                model=config.CLAUDE_MODEL,
                max_tokens=_MAX_TOKENS,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for text_delta in stream.text_stream:
                    full_answer += text_delta
                    yield sse({"type": "token", "text": text_delta})
        except Exception:
            logger.error("Claude stream error", exc_info=True)
            yield sse({
                "type": "error",
                "message": "An error occurred during streaming. Please try again.",
            })
            yield sse({"type": "done"})
            return

        citations = self._extract_citations(full_answer, retrieved_docs)
        yield sse({"type": "citations", "citations": [c.model_dump() for c in citations]})
        yield sse({"type": "done"})

        if session_id:
            self._save_messages(
                db, session_id, user_id, user_query, full_answer, citations, java_version
            )

        cache_key = self._generate_cache_key(user_query, java_version)
        redis_client.set(
            cache_key,
            {"response": full_answer, "citations": [c.model_dump() for c in citations]},
        )

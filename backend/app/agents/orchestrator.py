import hashlib
import json
import logging
from datetime import datetime
from typing import Generator, List, Optional
from anthropic import Anthropic
from app.config import config
from app.rag.retriever import Retriever
from app.redis_client import redis_client
from app.database import SessionLocal, ChatSession, ChatMessage
from app.models import Citation, ChatResponse
from .prompts import get_system_prompt
import re

logger = logging.getLogger(__name__)

class OrchestratorAgent:
    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.client = Anthropic(api_key=config.CLAUDE_API_KEY)
        self.db = SessionLocal()

    def _generate_cache_key(self, query: str, java_version: str) -> str:
        key_hash = hashlib.md5(f"{java_version}:{query}".encode()).hexdigest()
        return f"query:{key_hash}"

    def _get_history_messages(self, session_id: str, limit: int = 10) -> List[dict]:
        """Fetch last `limit` messages for session, return as Claude messages array."""
        try:
            rows = (
                self.db.query(ChatMessage)
                .filter_by(session_id=session_id)
                .order_by(ChatMessage.created_at.asc())
                .limit(limit)
                .all()
            )
            return [{"role": row.role, "content": row.content} for row in rows]
        except Exception as e:
            logger.warning(f"Could not fetch history for session {session_id}: {e}")
            return []

    def _extract_citations(self, answer: str, retrieved_docs: List[dict]) -> List[Citation]:
        citations = []
        cited_texts = re.findall(r'\[([^\]]+)\]', answer)

        for cited_text in cited_texts:
            for doc in retrieved_docs:
                if cited_text.lower() in doc['text'].lower():
                    citations.append(Citation(
                        text=cited_text,
                        file_name=doc['metadata'].get('source', 'unknown'),
                        section=doc['metadata'].get('section'),
                        page=doc['metadata'].get('page')
                    ))
                    break

        return citations

    def process_query(self, session_id: Optional[str], user_query: str, java_version: str) -> ChatResponse:
        cache_key = self._generate_cache_key(user_query, java_version)

        # Only use cache for first-message queries — history changes the answer
        has_history = bool(session_id and self._get_history_messages(session_id, limit=1))
        if not has_history:
            cached_result = redis_client.get(cache_key)
            if cached_result:
                logger.info(f"Cache hit: version={java_version} key={cache_key}")
                return ChatResponse(
                    session_id=session_id or "unknown",
                    response=cached_result['response'],
                    citations=[Citation(**c) for c in cached_result['citations']],
                    source_version=java_version,
                    timestamp=datetime.utcnow(),
                    cache_hit=True
                )

        logger.info(f"Cache miss: version={java_version} query={user_query[:60]!r}")
        retrieved_docs = self.retriever.retrieve(user_query, java_version, k=5)

        if not retrieved_docs:
            return ChatResponse(
                session_id=session_id or "unknown",
                response=f"No relevant documentation found in Java {java_version} docs for your query.",
                citations=[],
                source_version=java_version,
                timestamp=datetime.utcnow(),
                cache_hit=False
            )

        context = "\n\n---\n\n".join([
            f"[From: {doc['metadata'].get('source', 'unknown')}]\n{doc['text'][:500]}..."
            for doc in retrieved_docs
        ])

        system_prompt = get_system_prompt(java_version, context)

        # Build messages: history + current user query
        history = self._get_history_messages(session_id, limit=10) if session_id else []
        messages = history + [{"role": "user", "content": user_query}]

        try:
            response = self.client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=1500,
                system=system_prompt,
                messages=messages,
            )
            answer = response.content[0].text
            tokens_used = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens
            }
            logger.info(f"Claude response: tokens_in={tokens_used['prompt_tokens']} tokens_out={tokens_used['completion_tokens']}")
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            answer = f"Error calling Claude API: {str(e)}"
            tokens_used = None

        citations = self._extract_citations(answer, retrieved_docs)

        if session_id:
            try:
                session = self.db.query(ChatSession).filter_by(id=session_id).first()
                if not session:
                    session = ChatSession(id=session_id)
                    self.db.add(session)

                self.db.add(ChatMessage(session_id=session_id, role="user", content=user_query, java_version=java_version))
                self.db.add(ChatMessage(session_id=session_id, role="assistant", content=answer, citations=[c.dict() for c in citations], java_version=java_version))
                self.db.commit()
            except Exception as e:
                logger.error(f"DB save error: {e}")
                self.db.rollback()

        cache_data = {'response': answer, 'citations': [c.dict() for c in citations]}
        redis_client.set(cache_key, cache_data)

        return ChatResponse(
            session_id=session_id or "unknown",
            response=answer,
            citations=citations,
            source_version=java_version,
            timestamp=datetime.utcnow(),
            cache_hit=False,
            tokens_used=tokens_used
        )

    def stream_query(self, session_id: Optional[str], user_query: str, java_version: str) -> Generator[str, None, None]:
        """Yield SSE-formatted strings for real-time token streaming."""

        def sse(event_dict: dict) -> str:
            return f"data: {json.dumps(event_dict)}\n\n"

        retrieved_docs = self.retriever.retrieve(user_query, java_version, k=5)

        if not retrieved_docs:
            yield sse({"type": "token", "text": f"No relevant documentation found in Java {java_version} docs for your query."})
            yield sse({"type": "citations", "citations": []})
            yield sse({"type": "done"})
            return

        context = "\n\n---\n\n".join([
            f"[From: {doc['metadata'].get('source', 'unknown')}]\n{doc['text'][:500]}..."
            for doc in retrieved_docs
        ])
        system_prompt = get_system_prompt(java_version, context)

        history = self._get_history_messages(session_id, limit=10) if session_id else []
        messages = history + [{"role": "user", "content": user_query}]

        full_answer = ""
        try:
            with self.client.messages.stream(
                model=config.CLAUDE_MODEL,
                max_tokens=1500,
                system=system_prompt,
                messages=messages,
            ) as stream:
                for text_delta in stream.text_stream:
                    full_answer += text_delta
                    yield sse({"type": "token", "text": text_delta})
        except Exception as e:
            logger.error(f"Claude stream error: {e}")
            yield sse({"type": "error", "message": str(e)})
            yield sse({"type": "done"})
            return

        citations = self._extract_citations(full_answer, retrieved_docs)
        yield sse({"type": "citations", "citations": [c.dict() for c in citations]})
        yield sse({"type": "done"})

        # persist to DB + cache
        if session_id:
            try:
                session = self.db.query(ChatSession).filter_by(id=session_id).first()
                if not session:
                    session = ChatSession(id=session_id)
                    self.db.add(session)
                self.db.add(ChatMessage(session_id=session_id, role="user", content=user_query, java_version=java_version))
                self.db.add(ChatMessage(session_id=session_id, role="assistant", content=full_answer,
                                        citations=[c.dict() for c in citations], java_version=java_version))
                self.db.commit()
            except Exception as e:
                logger.error(f"DB save error (stream): {e}")
                self.db.rollback()

        cache_key = self._generate_cache_key(user_query, java_version)
        redis_client.set(cache_key, {"response": full_answer, "citations": [c.dict() for c in citations]})

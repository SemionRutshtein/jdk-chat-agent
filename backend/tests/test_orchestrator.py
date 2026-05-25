from unittest.mock import MagicMock, patch

import pytest

from app.models import Citation
from app.agents.orchestrator import OrchestratorAgent


@pytest.fixture
def mock_retriever():
    retriever = MagicMock()
    retriever.retrieve.return_value = [
        {
            "text": "A lambda expression [JLS §15.27] is an anonymous function",
            "metadata": {"source": "jls8.pdf", "page": 626},
            "distance": 0.1,
        }
    ]
    return retriever


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.query.return_value.filter_by.return_value.first.return_value = None
    db.query.return_value.filter_by.return_value.order_by.return_value.limit.return_value.all.return_value = []
    return db


class TestCacheKey:
    def test_same_inputs_same_key(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        k1 = agent._generate_cache_key("What is a lambda?", "8")
        k2 = agent._generate_cache_key("What is a lambda?", "8")
        assert k1 == k2

    def test_different_versions_different_keys(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        k1 = agent._generate_cache_key("What is a lambda?", "8")
        k2 = agent._generate_cache_key("What is a lambda?", "17")
        assert k1 != k2

    def test_key_has_prefix(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        key = agent._generate_cache_key("query", "8")
        assert key.startswith("query:")


class TestExtractCitations:
    def test_citation_found(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        docs = [
            {
                "text": "A lambda expression is an anonymous function as defined in the spec",
                "metadata": {"source": "jls8.pdf", "page": 626},
            }
        ]
        answer = "According to [lambda expression is an anonymous function], this is true."
        citations = agent._extract_citations(answer, docs)
        assert len(citations) == 1
        assert citations[0].file_name == "jls8.pdf"
        assert citations[0].page == 626

    def test_no_brackets_no_citations(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        docs = [{"text": "some text", "metadata": {}}]
        citations = agent._extract_citations("No citations here.", docs)
        assert citations == []

    def test_duplicate_citation_deduped(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        docs = [{"text": "lambda expression is an anonymous function", "metadata": {}}]
        answer = "[lambda expression is an anonymous function] and [lambda expression is an anonymous function]"
        citations = agent._extract_citations(answer, docs)
        assert len(citations) == 1

    def test_short_bracket_content_ignored(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        docs = [{"text": "some text", "metadata": {}}]
        # Brackets with fewer than 5 chars are ignored
        citations = agent._extract_citations("See [fig].", docs)
        assert citations == []


class TestBuildContext:
    def test_builds_context_string(self, mock_retriever):
        agent = OrchestratorAgent(mock_retriever)
        docs = [
            {"text": "text one", "metadata": {"source": "doc1.pdf"}},
            {"text": "text two", "metadata": {"source": "doc2.pdf"}},
        ]
        ctx = agent._build_context(docs)
        assert "doc1.pdf" in ctx
        assert "doc2.pdf" in ctx
        assert "---" in ctx


class TestProcessQueryCacheHit:
    def test_returns_cached_response(self, mock_retriever, mock_db):
        agent = OrchestratorAgent(mock_retriever)
        cached_data = {
            "response": "Cached answer",
            "citations": [{"text": "cite", "page": 1, "section": None, "file_name": "f.pdf"}],
        }
        with patch("app.agents.orchestrator.redis_client") as mock_redis:
            mock_redis.get.return_value = cached_data
            result = agent.process_query(
                db=mock_db,
                session_id=None,
                user_query="What is a lambda?",
                java_version="8",
            )
        assert result.cache_hit is True
        assert result.response == "Cached answer"
        mock_retriever.retrieve.assert_not_called()


class TestProcessQueryNoRAGDocs:
    def test_returns_seeding_message(self, mock_db):
        retriever = MagicMock()
        retriever.retrieve.return_value = []
        agent = OrchestratorAgent(retriever)

        with patch("app.agents.orchestrator.redis_client") as mock_redis:
            mock_redis.get.return_value = None
            result = agent.process_query(
                db=mock_db,
                session_id=None,
                user_query="What is a lambda?",
                java_version="8",
            )
        assert "seeding" in result.response.lower()
        assert result.cache_hit is False
        assert result.citations == []

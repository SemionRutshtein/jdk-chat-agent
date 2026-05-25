import pytest
from pydantic import ValidationError

from app.models import ChatRequest, Citation


class TestChatRequest:
    def test_valid_request(self):
        req = ChatRequest(message="What is a lambda?", java_version="8")
        assert req.message == "What is a lambda?"
        assert req.java_version == "8"
        assert req.session_id is None

    def test_all_valid_versions(self):
        for version in ("8", "17", "21"):
            req = ChatRequest(message="test", java_version=version)
            assert req.java_version == version

    def test_invalid_version_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="test", java_version="11")

    def test_empty_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="", java_version="8")

    def test_whitespace_only_message_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="   ", java_version="8")

    def test_message_too_long_rejected(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="x" * 10_001, java_version="8")

    def test_message_max_length_accepted(self):
        req = ChatRequest(message="x" * 10_000, java_version="8")
        assert len(req.message) == 10_000

    def test_session_id_optional(self):
        req = ChatRequest(message="test", java_version="17", session_id="abc-123")
        assert req.session_id == "abc-123"


class TestCitation:
    def test_minimal_citation(self):
        c = Citation(text="JLS §15.27")
        assert c.text == "JLS §15.27"
        assert c.page is None
        assert c.file_name is None

    def test_full_citation(self):
        c = Citation(text="excerpt", page=42, section="15.27", file_name="jls.pdf")
        assert c.model_dump() == {
            "text": "excerpt",
            "page": 42,
            "section": "15.27",
            "file_name": "jls.pdf",
        }

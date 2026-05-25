import pytest

from app.auth.service import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_returns_string(self):
        hashed = hash_password("secret123")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_verify_correct_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("correct-password", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_same_password_different_hashes(self):
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2  # bcrypt uses random salt

    def test_long_password(self):
        long_pw = "x" * 128
        hashed = hash_password(long_pw)
        assert verify_password(long_pw, hashed) is True


class TestJWT:
    def test_create_and_decode_token(self):
        token = create_access_token("user-id-123", "user@example.com")
        assert isinstance(token, str)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-id-123"
        assert payload["email"] == "user@example.com"

    def test_decode_invalid_token(self):
        assert decode_token("invalid.token.value") is None

    def test_decode_tampered_token(self):
        token = create_access_token("user-id-123", "user@example.com")
        tampered = token[:-5] + "XXXXX"
        assert decode_token(tampered) is None

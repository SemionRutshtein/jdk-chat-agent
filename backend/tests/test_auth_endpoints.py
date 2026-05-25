import pytest


class TestRegister:
    def test_register_success(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "password123"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert body["email"] == "new@example.com"
        assert body["token_type"] == "bearer"
        assert "user_id" in body

    def test_register_duplicate_email(self, client):
        payload = {"email": "dup@example.com", "password": "password123"}
        client.post("/api/auth/register", json=payload)
        resp = client.post("/api/auth/register", json=payload)
        assert resp.status_code == 409

    def test_register_short_password_rejected(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": "short@example.com", "password": "abc"},
        )
        assert resp.status_code == 422

    def test_register_invalid_email_rejected(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "password123"},
        )
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        client.post(
            "/api/auth/register",
            json={"email": "login@example.com", "password": "password123"},
        )
        resp = client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "password123"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body

    def test_login_wrong_password(self, client):
        client.post(
            "/api/auth/register",
            json={"email": "wrongpw@example.com", "password": "correctpass"},
        )
        resp = client.post(
            "/api/auth/login",
            json={"email": "wrongpw@example.com", "password": "wrongpass"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "ghost@example.com", "password": "password123"},
        )
        assert resp.status_code == 401


class TestMe:
    def test_me_with_valid_token(self, client):
        reg = client.post(
            "/api/auth/register",
            json={"email": "me@example.com", "password": "password123"},
        )
        token = reg.json()["access_token"]
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@example.com"

    def test_me_without_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 403

    def test_me_with_invalid_token(self, client):
        resp = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer invalid.token"}
        )
        assert resp.status_code == 401

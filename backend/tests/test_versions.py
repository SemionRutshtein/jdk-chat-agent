class TestVersions:
    def test_versions_endpoint(self, client):
        resp = client.get("/api/versions")
        assert resp.status_code == 200
        body = resp.json()
        assert set(body["versions"]) == {"8", "17", "21"}
        assert body["default"] == "8"

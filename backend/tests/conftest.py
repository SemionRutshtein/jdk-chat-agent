from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def test_engine():
    from app.database import Base

    # StaticPool forces all connections to reuse one underlying connection,
    # making the in-memory DB visible across threads (needed for FastAPI's thread pool).
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(test_engine):
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSession()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def client(db):
    from app.database import get_db
    from app.main import app

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    mock_redis = MagicMock()
    mock_redis.get.return_value = None
    mock_redis.set.return_value = None
    mock_redis.client.ping.return_value = True

    with (
        patch("app.main.init_db"),
        patch("app.redis_client.redis_client", mock_redis),
        patch("app.agents.orchestrator.redis_client", mock_redis),
    ):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c

    app.dependency_overrides.clear()

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class Config:
    POSTGRES_URL: str = os.getenv(
        "POSTGRES_URL",
        "postgresql://rag_user:rag_password@localhost:5432/java_rag",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    CLAUDE_API_KEY: str | None = os.getenv("CLAUDE_API_KEY")
    CLAUDE_MODEL: str = "claude-sonnet-4-6"
    CHROMA_PATH: str = os.getenv(
        "CHROMA_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "../chroma_data"),
    )
    PDF_DATA_PATH: str = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "../data"
    )
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CACHE_TTL: int = 3600
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("1", "true", "yes")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3001,http://localhost:3000,https://jdkinfoagent.up.railway.app",
        ).split(",")
        if o.strip()
    ]

    def validate(self) -> None:
        if not self.CLAUDE_API_KEY:
            logger.warning("CLAUDE_API_KEY is not set — Claude calls will fail")
        if self.JWT_SECRET == "change-me-in-production":
            logger.warning(
                "JWT_SECRET is using the insecure default — set JWT_SECRET in production"
            )


config = Config()

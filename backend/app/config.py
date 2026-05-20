import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://rag_user:rag_password@localhost:5432/java_rag")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
    CLAUDE_MODEL = "claude-sonnet-4-6"
    CHROMA_PATH = os.path.join(os.path.dirname(__file__), "../chroma_data")
    PDF_DATA_PATH = os.path.join(os.path.dirname(__file__), "../data")
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    CACHE_TTL = 3600
    DEBUG = os.getenv("DEBUG", "False") == "True"

config = Config()

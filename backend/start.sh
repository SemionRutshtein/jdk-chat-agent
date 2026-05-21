#!/bin/bash
set -e

echo "=== Java Docs Assistant backend starting ==="

# 1. DB init (fast, synchronous)
echo "[1/3] Initializing database..."
python init_db.py

# 2. RAG seed - synchronous, before uvicorn starts.
#    Runs with full available RAM (uvicorn not yet running).
#    Persistent volume at /app/chroma_data -> skips instantly on subsequent deploys.
#    NOTE: heredoc is in the `if` condition so set -e doesn't trap its sys.exit(1).
echo "[2/3] Checking RAG vector store..."
if python - <<'PYEOF'
import sys
import chromadb
from app.config import config

try:
    client = chromadb.PersistentClient(path=config.CHROMA_PATH)
    col = client.get_collection("java-8")
    count = col.count()
    if count > 0:
        print(f"[rag] already seeded ({count} docs in java-8) - skipping", flush=True)
        sys.exit(0)
except Exception:
    pass

print("[rag] seeding vector store - takes ~5-15 min on first boot", flush=True)
sys.exit(1)
PYEOF
then
    echo "[rag] skip"
else
    python -u rag_init.py
    echo "[rag] init complete"
fi

# 3. Start uvicorn (Railway injects PORT; fallback 8000 for local)
echo "[3/3] Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

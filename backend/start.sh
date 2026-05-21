#!/bin/bash
set -e

echo "=== Java Docs Assistant backend starting ==="

# 1. Synchronous: DB tables (must exist before server accepts requests)
echo "[1/3] Initializing database…"
python init_db.py

# 2. Background: RAG vector store seed (long on first boot; safe to defer
#    because server can answer health + auth while embeddings build).
echo "[2/3] Scheduling RAG init in background…"
(
    python - <<'PYEOF'
import sys
import chromadb
from app.config import config

try:
    client = chromadb.PersistentClient(path=config.CHROMA_PATH)
    col = client.get_collection("java-8")
    if col.count() > 0:
        print("[rag] already initialized — skipping")
        sys.exit(0)
except Exception:
    pass
print("[rag] seeding vector store (this can take minutes on first boot)…")
sys.exit(1)
PYEOF
    if [ $? -ne 0 ]; then
        python rag_init.py && echo "[rag] init complete" || echo "[rag] init FAILED — server continues running"
    fi
) &

# 3. Foreground: uvicorn. Railway injects PORT; fallback 8000 for local.
echo "[3/3] Starting uvicorn on port ${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

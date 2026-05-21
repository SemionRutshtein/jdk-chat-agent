#!/bin/bash
set -e

echo "=== Java Docs Assistant backend starting ==="

# 1. Synchronous: DB tables (must exist before server accepts requests)
echo "[1/3] Initializing database…"
python init_db.py

# 2. Background: RAG vector store seed.
#    Uses persistent volume at /app/chroma_data — skips if already seeded.
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
        print(f"[rag] already initialized ({col.count()} docs in java-8) — skipping", flush=True)
        sys.exit(0)
except Exception as e:
    pass
print("[rag] starting vector store seed (first boot — may take 5-10 min)…", flush=True)
sys.exit(1)
PYEOF
    if [ $? -ne 0 ]; then
        python -u rag_init.py 2>&1 && echo "[rag] init complete ✓" || echo "[rag] init FAILED — server continues running"
    fi
) 2>&1 | while IFS= read -r line; do echo "[rag-bg] $line"; done &

# 3. Foreground: uvicorn. Railway injects PORT; fallback 8000 for local.
echo "[3/3] Starting uvicorn on port ${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

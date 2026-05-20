#!/bin/bash
set -e

echo "=== Java Docs Assistant backend starting ==="

# 1. Create DB tables (idempotent)
echo "[1/3] Initializing database..."
python init_db.py

# 2. Check if ChromaDB is already seeded; skip rag_init if so
echo "[2/3] Checking RAG vector store..."
python - <<'PYEOF'
import sys
import chromadb
from app.config import config

try:
    client = chromadb.PersistentClient(path=config.CHROMA_PATH)
    col = client.get_collection("java-8")
    count = col.count()
    if count > 0:
        print(f"RAG already initialized: java-8 has {count} chunks — skipping rag_init")
        sys.exit(0)
except Exception:
    pass

print("RAG not initialized — running rag_init.py (this takes a few minutes on first boot)...")
sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
    python rag_init.py
fi

# 3. Start server — Railway injects PORT; fallback to 8000 for local
echo "[3/3] Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

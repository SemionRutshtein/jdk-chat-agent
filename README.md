# Java Oracle Documentation RAG Agent

AI chat assistant that answers Java questions using official Oracle documentation as source of truth. Supports Java 8, 17, 21.

## Stack
- **Frontend**: React + Vite + Tailwind CSS → http://localhost:3001
- **Backend**: FastAPI + Claude API (claude-sonnet-4-6) → http://localhost:8000
- **Vector Store**: Chroma (ONNX embeddings, all-MiniLM-L6-v2)
- **Cache**: Redis
- **History**: PostgreSQL
- **Deploy**: Docker Compose

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/SemionRutshtein/jdk-chat-agent
cd jdk-chat-agent
cp .env.example .env
# Edit .env — set CLAUDE_API_KEY=sk-ant-...
```

### 2. Add Java PDFs

Place these files in `backend/data/`:

| File | Source |
|------|--------|
| `java-8-jls.pdf` | Java SE 8 Language Specification |
| `java-8-jvms.pdf` | Java SE 8 JVM Specification |
| `java-17-jls.pdf` | Java SE 17 Language Specification |
| `java-17-jvms.pdf` | Java SE 17 JVM Specification |
| `java-21-jls.pdf` | Java SE 21 Language Specification |
| `java-21-jvms.pdf` | Java SE 21 JVM Specification |

Download from https://docs.oracle.com/javase/specs/

### 3. Start services

```bash
docker-compose up -d --build
```

### 4. Initialize vector store (first time only)

```bash
docker-compose exec backend python rag_init.py
```

Loads and embeds all PDFs into Chroma (~5 min first run, downloads ONNX model).

### 5. Open the app

- **Chat UI**: http://localhost:3001
- **API**: http://localhost:8000
- **Health**: http://localhost:8000/api/health

## API

### POST /api/chat
```json
// Request
{ "session_id": "optional-uuid", "message": "What is a lambda expression?", "java_version": "8" }

// Response
{
  "session_id": "uuid",
  "response": "A lambda expression...",
  "citations": [{ "text": "PAGE 626", "file_name": "java-8-jls.pdf" }],
  "source_version": "8",
  "cache_hit": false,
  "tokens_used": { "prompt_tokens": 911, "completion_tokens": 425 }
}
```

### GET /api/versions → `{ "versions": ["8","17","21"], "default": "8" }`
### GET /api/history/{session_id} → full message history
### GET /api/health → postgres / redis / chroma status

## Architecture

```
Browser (React)
    ↓ POST /api/chat
FastAPI backend
    ├── Redis cache check (1h TTL)
    ├── Chroma vector search (top 5 chunks)
    └── Claude claude-sonnet-4-6 with RAG context
         └── Answer + citations from docs
    ↓
Redis (cache) + PostgreSQL (session history)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "No documents found" | Run `docker-compose exec backend python rag_init.py` |
| PDF load error (deadlock) | Re-run init — retries 3x automatically |
| Port 3001 in use | Change `3001:3000` in docker-compose.yml |
| Claude API error | Check `CLAUDE_API_KEY` in `.env` |

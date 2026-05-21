# Java Documentation RAG Agent

> An AI assistant that answers Java questions using **only** Oracle's official Language and JVM specifications as the source of truth — no hallucination, every claim traceable to a page in the spec. Supports Java 8, 17, and 21.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│   LoginPage → Chat → SessionSidebar → MessageList (markdown)   │
│   fetch() SSE stream  │  axios + Bearer JWT                    │
└───────────────┬────────────────────────────────────────────────┘
                │  HTTPS  (window.__API_URL__ injected at runtime)
┌───────────────▼────────────────────────────────────────────────┐
│                      FastAPI Backend                            │
│                                                                 │
│   ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐   │
│   │  JWT Auth    │   │  RAG Pipeline   │   │  Orchestrator │   │
│   │  HS256 token │   │  PDF → chunks   │   │  Claude API   │   │
│   │  bcrypt+SHA  │   │  ONNX embed     │   │  SSE stream   │   │
│   └──────────────┘   │  BM25 + vector  │   │  multi-turn   │   │
│                      │  RRF re-rank    │   └───────────────┘   │
│                      └─────────────────┘                        │
│   ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│   │  Redis   │   │  PostgreSQL  │   │  ChromaDB (HNSW)     │   │
│   │  1h cache│   │  users       │   │  384-dim cosine      │   │
│   │          │   │  sessions    │   │  2800+ spec chunks   │   │
│   └──────────┘   │  messages    │   └──────────────────────┘   │
│                  └──────────────┘                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1 — Hybrid Retrieval: BM25 + Vector → Reciprocal Rank Fusion

Pure vector search misses exact keyword matches (`synchronized`, `volatile`, JLS section numbers). BM25 alone misses paraphrase. Combining both is the standard production answer.

**Implementation**: over-fetch 15 candidates from ChromaDB by cosine similarity, score the same 15 with `BM25Okapi`, fuse both ranked lists with RRF:

```
score(doc) = Σ  1 / (60 + rank_i(doc))
```

No weight tuning. Robust to score-magnitude differences between systems. Returns top 6.

→ [`backend/app/rag/retriever.py`](backend/app/rag/retriever.py)

---

### 2 — ONNX Embeddings (No PyTorch)

`sentence-transformers` drags in PyTorch + CUDA headers (~1 GB image). ChromaDB ships its own ONNX runtime with `all-MiniLM-L6-v2` (~80 MB). Same 384-dim embedding quality, zero extra dependencies, faster cold start.

→ [`backend/app/rag/embedder.py`](backend/app/rag/embedder.py)

---

### 3 — Real-Time SSE Streaming

Claude's `messages.stream()` yields text deltas. The orchestrator wraps them in a generator that emits SSE-formatted JSON, and FastAPI's `StreamingResponse` pushes to the browser with zero buffering (`X-Accel-Buffering: no`).

**Event protocol** (self-describing, extensible):
```
data: {"type": "token",     "text": "A lambda expression..."}
data: {"type": "citations", "citations": [{...}]}
data: {"type": "done"}
data: {"type": "error",     "message": "..."}   ← only on failure
```

Frontend reads via `fetch()` + `ReadableStream` — `EventSource` doesn't support POST bodies, so it can't carry session/version context.

→ [`backend/app/agents/orchestrator.py`](backend/app/agents/orchestrator.py) — `stream_query()`
→ [`backend/app/api/chat.py`](backend/app/api/chat.py) — `POST /api/chat/stream`
→ [`frontend/src/api/client.js`](frontend/src/api/client.js) — `streamMessage()`

---

### 4 — Multi-Turn Conversation with Session History

Every request fetches the last 10 messages for the session from PostgreSQL and prepends them to the `messages[]` array sent to Claude. RAG context is retrieved fresh from the **current question**. This lets users ask natural follow-ups ("elaborate on that", "show me a code example", "how does it differ in Java 21?") without the model losing context.

Redis cache is bypassed when a session already has history — same words, different conversation context, different answer.

→ [`backend/app/agents/orchestrator.py`](backend/app/agents/orchestrator.py) — `_get_history_messages()`
→ [`backend/app/agents/prompts.py`](backend/app/agents/prompts.py)

---

### 5 — JWT Auth with bcrypt + SHA-256 Pre-Hash

`passlib 1.7.4` is incompatible with `bcrypt >= 4.0.1` (which ChromaDB requires) — the library's wrap-bug detection hits bcrypt's new 72-byte rejection. Solution: drop passlib, call `bcrypt` directly, SHA-256 pre-hash eliminates the 72-byte limit entirely:

```python
def _prehash(password: str) -> bytes:
    return hashlib.sha256(password.encode()).hexdigest().encode()  # always 64 bytes
```

Sessions are scoped to authenticated users — `ChatSession.user_id` FK, all queries filtered per user.

→ [`backend/app/auth/service.py`](backend/app/auth/service.py)
→ [`backend/app/auth/dependencies.py`](backend/app/auth/dependencies.py)

---

### 6 — Runtime API URL Injection (PaaS-Compatible)

Vite bakes `VITE_API_URL` at **build time**. On Railway (or any PaaS), the Docker image is built before the backend URL is assigned. Solution: nginx entrypoint writes a tiny JS file at **container start** from the runtime environment:

```sh
# frontend/docker-entrypoint.sh
echo "window.__API_URL__ = '${VITE_API_URL}';" > /usr/share/nginx/html/config.js
```

`index.html` loads `/config.js`, React reads `window.__API_URL__ || import.meta.env.VITE_API_URL || localhost`. Build artifact is environment-agnostic.

→ [`frontend/docker-entrypoint.sh`](frontend/docker-entrypoint.sh)
→ [`frontend/src/api/client.js`](frontend/src/api/client.js)

---

## Backend Code Map

```
backend/
├── app/
│   ├── main.py              FastAPI app, CORS, router + auth wiring
│   ├── config.py            Env vars, paths, model names, JWT settings
│   ├── database.py          SQLAlchemy: User, ChatSession, ChatMessage
│   ├── models.py            Pydantic request/response schemas
│   ├── redis_client.py      Redis JSON wrapper with TTL
│   │
│   ├── api/
│   │   ├── chat.py          POST /api/chat  (blocking)
│   │   │                    POST /api/chat/stream  (SSE)
│   │   ├── history.py       GET  /api/history/{session_id}
│   │   ├── sessions.py      GET  /api/sessions  (per-user, paginated)
│   │   ├── versions.py      GET  /api/versions
│   │   └── health.py        GET  /api/health  (postgres/redis/chroma)
│   │
│   ├── auth/
│   │   ├── router.py        POST /api/auth/register|login  GET /api/auth/me
│   │   ├── service.py       hash_password, verify_password, JWT create/decode
│   │   └── dependencies.py  get_current_user  (FastAPI Depends)
│   │
│   ├── rag/
│   │   ├── pdf_loader.py    PDF → text → 500-word chunks, 100-word overlap
│   │   ├── embedder.py      ChromaDB ONNX all-MiniLM-L6-v2, 384 dims
│   │   ├── vector_store.py  ChromaDB PersistentClient, HNSW cosine index
│   │   └── retriever.py     Vector k=15 + BM25 → RRF → top 6
│   │
│   └── agents/
│       ├── orchestrator.py  process_query(), stream_query(), DB persist, cache
│       └── prompts.py       System prompt (multi-turn, RAG context injection)
│
├── data/                    6 Oracle PDFs (baked into Docker image)
├── rag_init.py              Vector store seeding (auto-runs at first boot)
├── init_db.py               SQLAlchemy table creation (idempotent)
├── start.sh                 Entrypoint: init DB → check chroma → uvicorn
└── Dockerfile
```

---

## Quick Start (Local)

**Requires**: Docker Desktop

```bash
# 1. Clone
git clone https://github.com/SemionRutshtein/jdk-chat-agent
cd jdk-chat-agent

# 2. Create .env
cat > .env << 'EOF'
CLAUDE_API_KEY=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
POSTGRES_URL=postgresql://rag_user:rag_password@postgres:5432/java_rag
REDIS_URL=redis://redis:6379
JWT_SECRET=YGmOp7zP7Xmi-7FBGv-JvULWVgxQ-eAAU4sAHj0oiKteKOzoYYAlcNFanvmh1_IK
DEBUG=False
EOF

# 3. Start everything
docker compose up -d --build
```

Watch first-boot RAG initialization (~3–5 min):
```bash
docker compose logs -f backend
# Wait for: "Application startup complete"
```

| URL | Description |
|---|---|
| http://localhost:3001 | Chat UI (local) |
| http://localhost:8000/docs | **Swagger UI** — interactive API explorer (local) |
| http://localhost:8000/redoc | ReDoc — readable API reference (local) |
| http://localhost:8000/api/health | Service health + chunk counts (local) |
| https://jdkinfoagent.up.railway.app | Chat UI (production) |
| https://jdkinfoagentb.up.railway.app/docs | Swagger UI (production) |
| https://jdkinfoagentb.up.railway.app/api/health | Health check (production) |

**First use**: open https://jdkinfoagent.up.railway.app → **Register** → start chatting.

---

## API Reference

Interactive docs with request/response schemas and live testing:
- **Local**: http://localhost:8000/docs
- **Production**: https://jdkinfoagentb.up.railway.app/docs

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create account, returns 7-day JWT |
| `POST` | `/api/auth/login` | — | Authenticate, returns JWT |
| `GET` | `/api/auth/me` | Bearer | Current user info |

**Register / Login request body:**
```json
{ "email": "you@example.com", "password": "secret123" }
```

**Response:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "email": "you@example.com",
  "user_id": "6274e34f-69cd-4787-aaf8-..."
}
```

All subsequent requests require: `Authorization: Bearer <access_token>`

---

### Chat

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/chat` | Bearer | Blocking — waits for full response |
| `POST` | `/api/chat/stream` | Bearer | SSE — tokens stream in real time |

**Request body (both endpoints):**
```json
{
  "session_id": "my-session-1",
  "message": "What is a lambda expression in Java?",
  "java_version": "8"
}
```

`session_id` is optional — a UUID is generated if omitted. `java_version` must be `"8"`, `"17"`, or `"21"`.

**`/api/chat` response:**
```json
{
  "session_id": "my-session-1",
  "response": "A lambda expression is an anonymous function...",
  "citations": [
    { "text": "cited excerpt", "file_name": "java-8-jls.pdf", "page": 626 }
  ],
  "source_version": "8",
  "cache_hit": false,
  "tokens_used": { "prompt_tokens": 911, "completion_tokens": 425 },
  "timestamp": "2026-05-21T10:00:00"
}
```

**`/api/chat/stream` — Server-Sent Events:**
```
data: {"type": "token",     "text": "A lambda "}
data: {"type": "token",     "text": "expression is..."}
data: {"type": "citations", "citations": [{"file_name": "java-8-jls.pdf", "page": 626}]}
data: {"type": "done"}
```

---

### Sessions & Metadata

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/sessions?limit=20&offset=0` | Bearer | User's sessions, newest first |
| `GET` | `/api/history/{session_id}` | Bearer | Full message history |
| `GET` | `/api/versions` | — | `{"versions": ["8","17","21"], "default": "8"}` |
| `GET` | `/api/health` | — | Postgres / Redis / Chroma status + chunk counts |

**`/api/health` response:**
```json
{
  "status": "healthy",
  "postgres": "connected",
  "redis": "connected",
  "chroma": "connected",
  "collections": { "8": 879, "17": 952, "21": 969 }
}
```

---

## Railway Deployment

### Pre-configured services in project `jdk-chat-agent`

| Service | ID | Status |
|---|---|---|
| Postgres | `09d6fbac` | ✅ Online |
| Redis | `0dd626a2` | ✅ Online |
| backend | `685219d0` | ⚙️ Needs config below |
| frontend | `dd647942` | ⚙️ Needs config below |

---

### Step 1 — Install Railway GitHub App *(one-time, ~30 seconds)*

[railway.app](https://railway.app) → project `jdk-chat-agent` → **Settings → GitHub → Install App** → select `SemionRutshtein/jdk-chat-agent`

This enables auto-deploy on push to `main` and unblocks CLI/API variable management.

---

### Step 2 — Backend: root directory + environment variables

Railway → **backend** service → **Settings → Source → Root Directory**: `backend`

Railway → **backend** service → **Variables** → add each:

```
POSTGRES_URL   postgresql://postgres:pJWqYiNDzZrWNhABwPsGObbBdHElmYKJ@postgres.railway.internal:5432/railway
REDIS_URL      redis://default:KjPhBQDiWNtFgCCeWHtXuyoOkvaBNlnv@redis.railway.internal:6379
CLAUDE_API_KEY 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
JWT_SECRET     YGmOp7zP7Xmi-7FBGv-JvULWVgxQ-eAAU4sAHj0oiKteKOzoYYAlcNFanvmh1_IK
DEBUG          False
```

> `PORT` is injected automatically by Railway — do not set it.

> **First boot** takes ~3–5 min: `start.sh` auto-runs RAG initialization (embeds all 6 PDFs into ChromaDB).

---

### Step 3 — Frontend: root directory + environment variable

Railway → **frontend** service → **Settings → Source → Root Directory**: `frontend`

Railway → **frontend** service → **Variables**:

```
VITE_API_URL   https://jdkinfoagentb.up.railway.app
```

> Find the backend's public domain: Railway → backend → **Settings → Networking → Public URL**. You will send this domain after Railway assigns it.

---

### Step 4 — Persistent volume for ChromaDB *(strongly recommended)*

Railway → backend → **Volumes** → add → Mount path: `/app/chroma_data`

Without this: RAG re-initializes on every deploy (~5 min). With it: instant startup.

---

### Step 5 — Enable GitHub Actions auto-deploy

Railway → project → **Settings → Tokens** → create project token → copy value

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Name: `RAILWAY_TOKEN`
- Value: paste token

After this: every merge to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. Deploys backend (runs `start.sh`: DB init → chroma check → uvicorn)
2. Deploys frontend after backend is up (nginx injects `VITE_API_URL` at container start)

---

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| LLM | Claude claude-sonnet-4-6 | Best spec-citation instruction following |
| Embeddings | all-MiniLM-L6-v2 via ONNX | 384-dim, 80 MB, no PyTorch |
| Vector store | ChromaDB (HNSW cosine) | Embedded, persistent, no infra overhead |
| Keyword search | rank_bm25 (pure Python) | Complements vector for exact term matching |
| Backend | FastAPI + uvicorn | Async, native SSE/streaming, auto OpenAPI |
| Auth | JWT HS256 + bcrypt | Stateless, standard, 7-day tokens |
| Cache | Redis (1h TTL) | Saves Claude API cost on repeated questions |
| History | PostgreSQL + SQLAlchemy | Per-user session isolation, ACID |
| Frontend | React 18 + Vite + Tailwind | Fast HMR, minimal bundle |
| Serving | nginx (alpine) | Gzip, SPA routing, static asset caching |
| Deploy | Docker + Railway | Reproducible builds, managed Postgres/Redis |

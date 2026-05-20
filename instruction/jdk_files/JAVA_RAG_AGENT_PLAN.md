# Java Oracle Documentation RAG Agent - Complete Project Plan

## 📋 Project Overview
- **Goal**: AI-powered chat agent that answers Java questions using official Oracle documentation as RAG source
- **Scope**: 4 Java versions (5, 8, 17, 21)
- **Timeline**: 3 days
- **Tech Stack**: FastAPI (Python) + React + Claude API + Chroma + Redis + PostgreSQL

---

## 🏗️ Architecture (Hybrid - Variant 3)

### High-Level Flow
```
User Chat Input (React Frontend)
    ↓
FastAPI Backend
    ├─ Version Selection (Redis cached)
    ├─ Query Preprocessing
    └─ Orchestrator Agent (Claude API)
         ├─ Vector Search (Chroma - Java docs namespace)
         ├─ Context Building
         └─ Response Generation (with doc citations)
    ↓
Response Cache (Redis) + DB History (PostgreSQL)
    ↓
React Chat UI (with prev messages + citations)
```

### Component Breakdown
1. **Frontend**: React Chat Interface (single version selector + message history)
2. **Backend**: FastAPI with 5 main endpoints
3. **RAG**: Chroma VectorDB (local, in-container)
4. **Caching**: Redis (query results + embeddings metadata)
5. **History**: PostgreSQL (chat sessions + messages)
6. **Orchestration**: Single Orchestrator Agent (Claude API)

---

## 📁 Project Structure

```
java-rag-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry
│   │   ├── config.py                  # Environment variables
│   │   ├── models.py                  # Pydantic schemas
│   │   ├── database.py                # PostgreSQL connection
│   │   ├── redis_client.py            # Redis wrapper
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_loader.py          # Load + chunk PDFs
│   │   │   ├── embedder.py            # Sentence-Transformers
│   │   │   ├── vector_store.py        # Chroma wrapper
│   │   │   └── retriever.py           # Vector search + ranking
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator.py        # Main Claude agent
│   │   │   └── prompts.py             # Prompt templates
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── chat.py                # /api/chat endpoint
│   │       ├── history.py             # /api/history endpoint
│   │       ├── versions.py            # /api/versions endpoint
│   │       └── health.py              # /api/health endpoint
│   ├── data/
│   │   ├── java-5-docs.pdf            # (User provides)
│   │   ├── java-8-docs.pdf
│   │   ├── java-17-docs.pdf
│   │   └── java-21-docs.pdf
│   ├── chroma_data/                   # Vector store persisted here
│   ├── requirements.txt
│   ├── Dockerfile
│   └── init_db.py                     # DB schema setup
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx               # Main chat component
│   │   │   ├── VersionSelector.jsx    # Java version dropdown
│   │   │   ├── MessageList.jsx        # Conversation history
│   │   │   ├── MessageInput.jsx       # Input + send button
│   │   │   └── CitationBadge.jsx      # Doc link visualization
│   │   ├── pages/
│   │   │   └── index.jsx              # Home page
│   │   ├── api/
│   │   │   └── client.js              # Axios/fetch wrapper
│   │   ├── App.jsx
│   │   ├── index.css                  # Tailwind
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── tailwind.config.js
│
├── docker-compose.yml
├── .env.example
├── README.md
└── IMPLEMENTATION_PROMPT.md            # Claude Code prompt (below)
```

---

## 🚀 Implementation Phases

### **Phase 1: Setup & Core RAG (Day 1 - 4-5 hours)**

#### Tasks:
- [ ] Initialize git repo + folder structure
- [ ] Create `docker-compose.yml` (FastAPI, PostgreSQL, Redis, Chroma)
- [ ] Set up Python environment + `requirements.txt`
- [ ] Create PostgreSQL schema (chat_sessions, chat_messages, doc_metadata)
- [ ] Implement `app/rag/pdf_loader.py` (PyPDF2 → chunking)
- [ ] Implement `app/rag/embedder.py` (Sentence-Transformers)
- [ ] Implement `app/rag/vector_store.py` (Chroma wrapper)
- [ ] Create initialization script to populate vector store from PDFs
- [ ] Test RAG retrieval locally (no API yet)

#### Success Criteria:
- Docker stack runs without errors
- PDFs loaded → chunks created → embeddings stored in Chroma
- Vector search returns relevant docs for test queries

---

### **Phase 2: Backend API + Agent (Day 1-2 - 5-6 hours)**

#### Tasks:
- [ ] Implement FastAPI main app + CORS setup
- [ ] Create Pydantic models (ChatRequest, ChatResponse, Citation)
- [ ] Implement Redis wrapper (`redis_client.py`)
- [ ] Implement PostgreSQL wrapper (`database.py`)
- [ ] Create Orchestrator Agent (`agents/orchestrator.py`)
  - Takes user query + Java version
  - Retrieves relevant docs from Chroma
  - Calls Claude API with system prompt + context
  - Extracts citations from response
- [ ] Implement 5 API endpoints:
  - `POST /api/chat` (main endpoint)
  - `GET /api/history/{session_id}` (chat history)
  - `GET /api/versions` (available Java versions)
  - `GET /api/sessions` (user's chat sessions)
  - `GET /api/health` (service health)
- [ ] Add request/response caching (Redis)
- [ ] Test all endpoints with curl/Postman

#### Success Criteria:
- `/api/chat` returns structured response with citations
- Cache hits reduce response time by 50%+
- No hallucinations (all answers backed by docs)

---

### **Phase 3: Frontend (Day 2 - 3-4 hours)**

#### Tasks:
- [ ] Initialize React + Vite project
- [ ] Build Chat component (message display)
- [ ] Build VersionSelector (dropdown for Java 5/8/17/21)
- [ ] Build MessageInput (textarea + send button)
- [ ] Build CitationBadge (clickable doc links)
- [ ] Implement API client wrapper
- [ ] Add session/chat history management (local state + backend)
- [ ] Styling with Tailwind CSS (dark theme - Volcanic Intelligence)
- [ ] Test end-to-end (send message → see response + citations)

#### Success Criteria:
- Chat loads previous messages on session restore
- Version selector switches context correctly
- Citations are clickable and readable

---

### **Phase 4: Polish & Deployment (Day 3 - 2-3 hours)**

#### Tasks:
- [ ] Docker build + tag images
- [ ] Create `.env.example` + documentation
- [ ] Add error handling + logging
- [ ] Write README with setup instructions
- [ ] Test full stack: `docker-compose up`
- [ ] Performance testing (response time, token usage)
- [ ] Bug fixes + edge cases

#### Success Criteria:
- Single `docker-compose up` starts entire stack
- All endpoints respond in <5s (with caching)
- Ready for demo

---

## 🔧 Key Implementation Details

### API Endpoints Design

```
POST /api/chat
Request:
{
  "session_id": "uuid",
  "message": "How do I create a thread pool in Java?",
  "java_version": "8"
}

Response:
{
  "response": "To create a thread pool in Java 8, use ExecutorService. Example: ExecutorService executor = Executors.newFixedThreadPool(10);",
  "citations": [
    {
      "text": "ExecutorService",
      "page": 245,
      "url": "oracle-java8-docs/concurrent.pdf#page=245"
    }
  ],
  "source_version": "8",
  "timestamp": "2025-05-20T10:30:00Z",
  "cache_hit": false
}
```

```
GET /api/history/{session_id}
Response:
{
  "session_id": "uuid",
  "created_at": "2025-05-20T10:00:00Z",
  "messages": [
    {
      "role": "user",
      "content": "...",
      "timestamp": "..."
    },
    {
      "role": "assistant",
      "content": "...",
      "citations": [...],
      "timestamp": "..."
    }
  ]
}
```

```
GET /api/versions
Response:
{
  "versions": ["5", "8", "17", "21"],
  "default": "8"
}
```

---

## 🤖 Orchestrator Agent Design

### System Prompt Template:
```
You are a Java documentation assistant. Your role is to answer questions 
about Java {VERSION} based ONLY on official Oracle documentation.

IMPORTANT RULES:
1. ALWAYS cite the exact section/page from documentation
2. If information is not in the docs, say "Not found in Java {VERSION} documentation"
3. Do NOT generate code beyond what's in official examples
4. Do NOT make assumptions about implementation details

Context from documentation:
{RETRIEVED_DOCS}

User Question: {USER_QUERY}

Respond in this format:
ANSWER: [Your answer with citations in [square brackets]]
CONFIDENCE: [high/medium/low]
```

### Agent Flow:
```python
def orchestrator_agent(user_query, java_version, session_id):
    # 1. Check cache
    cache_key = f"query:{java_version}:{hash(user_query)}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 2. Retrieve relevant docs
    docs = vector_store.search(
        query=user_query,
        namespace=f"java-{java_version}",
        k=5
    )
    
    # 3. Build prompt
    context = "\n".join([doc.content for doc in docs])
    prompt = system_prompt.format(
        VERSION=java_version,
        RETRIEVED_DOCS=context,
        USER_QUERY=user_query
    )
    
    # 4. Call Claude API
    response = claude_client.messages.create(
        model="claude-3-5-sonnet-20241022",  # or Opus for better quality
        max_tokens=1000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    # 5. Extract answer + citations
    answer = response.content[0].text
    citations = extract_citations(answer, docs)
    
    # 6. Cache + save to DB
    result = {
        "response": answer,
        "citations": citations,
        "source_version": java_version,
        "cache_hit": False
    }
    
    redis.setex(cache_key, 3600, json.dumps(result))  # 1 hour TTL
    db.save_message(session_id, "user", user_query)
    db.save_message(session_id, "assistant", answer, citations)
    
    return result
```

---

## 📦 Dependencies

### Backend (`requirements.txt`)
```
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
anthropic==0.7.0
chroma-db==0.4.11
sentence-transformers==2.2.2
redis==5.0.1
psycopg2-binary==2.9.9
PyPDF2==3.16.0
python-dotenv==1.0.0
```

### Frontend (`package.json`)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

---

## 🐳 Docker Setup

### `docker-compose.yml`
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: rag_user
      POSTGRES_PASSWORD: rag_password
      POSTGRES_DB: java_rag
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      POSTGRES_URL: postgresql://rag_user:rag_password@postgres:5432/java_rag
      REDIS_URL: redis://redis:6379
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/data:/app/data
      - ./backend/chroma_data:/app/chroma_data

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://backend:8000
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

## 📝 Database Schema

### PostgreSQL Tables
```sql
-- Chat Sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20),  -- 'user' or 'assistant'
    content TEXT,
    citations JSONB,   -- Array of {text, page, section}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id)
);

-- Document Metadata
CREATE TABLE doc_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    java_version VARCHAR(10),
    file_name VARCHAR(255),
    file_path VARCHAR(255),
    chunks_count INT,
    embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version (java_version)
);
```

---

## 🎯 Success Criteria

- ✅ Responds to Java questions with doc citations (zero hallucinations)
- ✅ Supports 4 Java versions with version switching
- ✅ Chat history persists across sessions
- ✅ Response time <3s (with caching)
- ✅ Docker Compose starts everything in one command
- ✅ Code is clean, documented, ready for code review
- ✅ Ready for production-like demo

---

## 📚 References & Resources

- [Anthropic SDK Docs](https://github.com/anthropic-ai/anthropic-sdk-python)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Chroma Docs](https://docs.trychroma.com/)
- [Sentence-Transformers](https://www.sbert.net/)

---

## ⚠️ Known Constraints & Gotchas

1. **PDF Chunking**: Large PDFs need smart chunking (overlap 50-100 tokens) to preserve context
2. **Embeddings**: Sentence-Transformers is CPU-bound; consider GPU if available
3. **Claude API Cost**: 4 versions × ~100 test queries = ~$5-15 in API costs
4. **Redis TTL**: Cache expiry should balance freshness vs. cost (1 hour recommended)
5. **Session Management**: No auth yet; use UUID for simplicity

---

## 🔄 Next Steps

1. **Immediately**: Download 4 Java Oracle PDFs → `/backend/data/`
2. **Day 1**: Use Claude Code with `IMPLEMENTATION_PROMPT.md` to scaffold project
3. **Day 2-3**: Iterate on agent quality + frontend UX
4. **Day 3 End**: Final testing + deployment

---

**Created**: 2025-05-20  
**Status**: Ready for implementation

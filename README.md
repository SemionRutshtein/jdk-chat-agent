# Java Oracle Documentation RAG Agent

AI-powered assistant that answers Java questions using official Oracle documentation.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Claude API key
- Java documentation PDFs (5, 8, 17, 21)

### Setup

1. **Clone and setup**:
```bash
git clone <repo>
cd java-rag-agent
cp .env.example .env
# Edit .env and add CLAUDE_API_KEY
```

2. **Download Java documentation PDFs**:
Place the following files in `backend/data/`:
- `java-5-docs.pdf`
- `java-8-docs.pdf`
- `java-17-docs.pdf`
- `java-21-docs.pdf`

3. **Start services**:
```bash
docker-compose up -d
```

4. **Initialize vector store** (first time only):
```bash
docker-compose exec backend python rag_init.py
```

5. **Access**:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Health: http://localhost:8000/api/health

## Architecture

```
User Input (React Frontend)
    ↓
FastAPI Backend
    ├─ Version Selection (Redis cached)
    ├─ RAG Pipeline (Chroma VectorDB)
    └─ Orchestrator Agent (Claude API)
    ↓
Response with Citations
    ↓
Cache (Redis) + History (PostgreSQL)
```

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python 3.11+) + Claude API
- **Vector Store**: Chroma (local, in-container)
- **Cache**: Redis
- **Database**: PostgreSQL (chat history)
- **Deployment**: Docker Compose

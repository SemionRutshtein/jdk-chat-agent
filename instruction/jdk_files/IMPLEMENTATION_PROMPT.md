# IMPLEMENTATION PROMPT FOR CLAUDE CODE
## Java Oracle Documentation RAG Agent - Full Stack Build

### PROJECT CONTEXT

**Goal**: Build an AI-powered chat interface that answers Java questions using official Oracle documentation as a Retrieval-Augmented Generation (RAG) source.

**Tech Stack**:
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python 3.11+) + Claude API
- **Vector Store**: Chroma (local, in-container)
- **Cache**: Redis
- **Database**: PostgreSQL (chat history)
- **Deployment**: Docker Compose

**Timeline**: 3-day sprint (Day 1-3)

**Constraints**:
- Support 4 Java versions: 5, 8, 17, 21
- ALL responses must cite official documentation (prevent hallucinations)
- Chat history persistence with session management
- No user authentication (use UUIDs for sessions)
- Single orchestrator agent (Claude API calls)
- Response time < 3 seconds (with caching)

---

### PHASE 1: PROJECT SCAFFOLDING & RAG CORE
**Estimated Time**: 4-5 hours

#### Step 1.1: Initialize Repository Structure
Create the complete folder structure exactly as specified below. Use the provided `JAVA_RAG_AGENT_PLAN.md` as reference for exact paths.

**Folder Tree**:
```
java-rag-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── database.py
│   │   ├── redis_client.py
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_loader.py
│   │   │   ├── embedder.py
│   │   │   ├── vector_store.py
│   │   │   └── retriever.py
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator.py
│   │   │   └── prompts.py
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── chat.py
│   │       ├── history.py
│   │       ├── versions.py
│   │       └── health.py
│   ├── data/
│   │   ├── java-5-docs.pdf
│   │   ├── java-8-docs.pdf
│   │   ├── java-17-docs.pdf
│   │   └── java-21-docs.pdf
│   ├── chroma_data/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── init_db.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx
│   │   │   ├── VersionSelector.jsx
│   │   │   ├── MessageList.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   └── CitationBadge.jsx
│   │   ├── pages/
│   │   │   └── index.jsx
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── tailwind.config.js
├── docker-compose.yml
├── .env.example
└── README.md
```

#### Step 1.2: Create Backend Configuration

**File: `backend/app/config.py`**
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # PostgreSQL
    POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://rag_user:rag_password@localhost:5432/java_rag")
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Claude API
    CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
    CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
    
    # RAG
    CHROMA_PATH = os.path.join(os.path.dirname(__file__), "../../backend/chroma_data")
    PDF_DATA_PATH = os.path.join(os.path.dirname(__file__), "../../backend/data")
    
    # Embedding
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Cache
    CACHE_TTL = 3600  # 1 hour
    
    # App
    DEBUG = os.getenv("DEBUG", "False") == "True"

config = Config()
```

**File: `backend/app/models.py`**
```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class Citation(BaseModel):
    text: str
    page: Optional[int] = None
    section: Optional[str] = None
    file_name: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: Optional[str] = None  # If None, create new session
    message: str
    java_version: str  # "5", "8", "17", "21"

class ChatResponse(BaseModel):
    session_id: str
    response: str
    citations: List[Citation]
    source_version: str
    timestamp: datetime
    cache_hit: bool
    tokens_used: Optional[dict] = None  # {prompt_tokens, completion_tokens}

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    citations: Optional[List[Citation]] = None
    timestamp: datetime

class ChatHistory(BaseModel):
    session_id: str
    created_at: datetime
    messages: List[ChatMessage]

class VersionResponse(BaseModel):
    versions: List[str]
    default: str

class HealthResponse(BaseModel):
    status: str
    postgres: bool
    redis: bool
    chroma: bool
```

**File: `backend/requirements.txt`**
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
sqlalchemy==2.0.23
pydantic-settings==2.1.0
```

#### Step 1.3: Implement RAG Core Pipeline

**File: `backend/app/rag/pdf_loader.py`**
```python
import PyPDF2
import os
from pathlib import Path
from typing import List, Tuple

class PDFLoader:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path
    
    def extract_text(self) -> str:
        """Extract all text from PDF"""
        text = ""
        with open(self.pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num, page in enumerate(pdf_reader.pages):
                text += f"[PAGE {page_num + 1}]\n"
                text += page.extract_text()
                text += "\n"
        return text
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[Tuple[str, dict]]:
        """
        Split text into overlapping chunks.
        Returns list of (chunk_text, metadata)
        """
        chunks = []
        words = text.split()
        chunk_words = []
        
        for i, word in enumerate(words):
            chunk_words.append(word)
            
            if len(chunk_words) >= chunk_size:
                chunk_text = " ".join(chunk_words)
                metadata = {
                    "source": Path(self.pdf_path).name,
                    "chunk_index": len(chunks),
                    "word_count": len(chunk_words)
                }
                chunks.append((chunk_text, metadata))
                
                # Overlap: keep last 'overlap' words for next chunk
                chunk_words = chunk_words[-overlap:]
        
        # Add remaining chunk
        if chunk_words:
            chunk_text = " ".join(chunk_words)
            metadata = {
                "source": Path(self.pdf_path).name,
                "chunk_index": len(chunks),
                "word_count": len(chunk_words)
            }
            chunks.append((chunk_text, metadata))
        
        return chunks
    
    def load_and_chunk(self, chunk_size: int = 500) -> List[Tuple[str, dict]]:
        """Load PDF and return chunks with metadata"""
        text = self.extract_text()
        return self.chunk_text(text, chunk_size=chunk_size)
```

**File: `backend/app/rag/embedder.py`**
```python
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np

class Embedder:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
    
    def embed_text(self, text: str) -> np.ndarray:
        """Embed single text"""
        return self.model.encode([text])[0]
    
    def embed_texts(self, texts: List[str]) -> List[np.ndarray]:
        """Embed multiple texts"""
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return [e for e in embeddings]
```

**File: `backend/app/rag/vector_store.py`**
```python
import chromadb
from chromadb.config import Settings
import os
from typing import List, Tuple, Optional

class VectorStore:
    def __init__(self, persist_path: str):
        self.persist_path = persist_path
        os.makedirs(persist_path, exist_ok=True)
        
        # Initialize Chroma with persistence
        self.client = chromadb.PersistentClient(path=persist_path)
        self.collections = {}
    
    def get_or_create_collection(self, java_version: str):
        """Get or create collection for Java version"""
        collection_name = f"java-{java_version}"
        
        if collection_name not in self.collections:
            self.collections[collection_name] = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        
        return self.collections[collection_name]
    
    def add_documents(self, java_version: str, documents: List[Tuple[str, dict]], embeddings: List[List[float]]):
        """
        Add documents to vector store.
        
        Args:
            java_version: Java version (5, 8, 17, 21)
            documents: List of (text, metadata) tuples
            embeddings: List of embedding vectors
        """
        collection = self.get_or_create_collection(java_version)
        
        ids = []
        texts = []
        metadatas = []
        
        for i, (text, metadata) in enumerate(documents):
            doc_id = f"{java_version}_{i}"
            ids.append(doc_id)
            texts.append(text)
            metadatas.append(metadata)
        
        collection.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas
        )
        
        print(f"Added {len(ids)} documents to java-{java_version}")
    
    def search(self, java_version: str, query_embedding: List[float], k: int = 5) -> List[dict]:
        """
        Search for similar documents.
        
        Returns:
            List of {text, metadata, distance}
        """
        collection = self.get_or_create_collection(java_version)
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=k
        )
        
        docs = []
        for i in range(len(results['documents'][0])):
            docs.append({
                'text': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'distance': results['distances'][0][i]
            })
        
        return docs
```

**File: `backend/app/rag/retriever.py`**
```python
from .vector_store import VectorStore
from .embedder import Embedder
from typing import List

class Retriever:
    def __init__(self, vector_store: VectorStore, embedder: Embedder):
        self.vector_store = vector_store
        self.embedder = embedder
    
    def retrieve(self, query: str, java_version: str, k: int = 5) -> List[dict]:
        """
        Retrieve relevant documents for query.
        
        Args:
            query: User query
            java_version: Java version to search in
            k: Number of results
        
        Returns:
            List of relevant documents with metadata
        """
        # Embed query
        query_embedding = self.embedder.embed_text(query).tolist()
        
        # Search
        results = self.vector_store.search(java_version, query_embedding, k=k)
        
        return results
```

#### Step 1.4: Create PostgreSQL Integration

**File: `backend/app/database.py`**
```python
from sqlalchemy import create_engine, Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid
from app.config import config

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String)  # "user" or "assistant"
    content = Column(Text)
    citations = Column(JSON, nullable=True)
    java_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")

class DocumentMetadata(Base):
    __tablename__ = "doc_metadata"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    java_version = Column(String, nullable=False)
    file_name = Column(String)
    chunks_count = Column(String)
    embedded_at = Column(DateTime, default=datetime.utcnow)

# Database setup
engine = create_engine(config.POSTGRES_URL)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**File: `backend/init_db.py`**
```python
from app.database import init_db

if __name__ == "__main__":
    init_db()
    print("Database initialized!")
```

#### Step 1.5: Create Redis Wrapper

**File: `backend/app/redis_client.py`**
```python
import redis
import json
from app.config import config
from typing import Optional, Any

class RedisClient:
    def __init__(self):
        self.client = redis.from_url(config.REDIS_URL, decode_responses=True)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"Redis GET error: {e}")
        return None
    
    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache"""
        try:
            ttl = ttl or config.CACHE_TTL
            self.client.setex(
                key,
                ttl,
                json.dumps(value, default=str)
            )
        except Exception as e:
            print(f"Redis SET error: {e}")
    
    def delete(self, key: str):
        """Delete key from cache"""
        try:
            self.client.delete(key)
        except Exception as e:
            print(f"Redis DELETE error: {e}")
    
    def exists(self, key: str) -> bool:
        """Check if key exists"""
        return self.client.exists(key) > 0

redis_client = RedisClient()
```

---

### PHASE 2: BACKEND API & AGENT
**Estimated Time**: 5-6 hours

#### Step 2.1: Implement Orchestrator Agent

**File: `backend/app/agents/prompts.py`**
```python
ORCHESTRATOR_SYSTEM_PROMPT = """You are a Java documentation assistant powered by Oracle's official documentation.

Your role:
1. Answer questions about Java {JAVA_VERSION} using ONLY official Oracle documentation
2. ALWAYS cite the exact source (page/section) from the documentation
3. If information is not found in the docs, explicitly say: "This information is not available in Java {JAVA_VERSION} official documentation"
4. Provide code examples ONLY from official documentation
5. Be concise but complete

IMPORTANT RULES:
- Do NOT generate or assume implementation details beyond what's documented
- Do NOT provide best practices not explicitly mentioned in docs
- ALL answers must be traceable to the provided documentation context
- If ambiguous, ask for clarification

---

Documentation Context (Java {JAVA_VERSION}):
{CONTEXT}

---

User Question: {USER_QUERY}

Respond with:
1. ANSWER: [Your answer with [cited_text] markers]
2. CITATIONS: [List of cited sections/pages]
3. CONFIDENCE: [high/medium/low]
"""

def get_system_prompt(java_version: str, context: str, user_query: str) -> str:
    """Build system prompt with context"""
    return ORCHESTRATOR_SYSTEM_PROMPT.format(
        JAVA_VERSION=java_version,
        CONTEXT=context,
        USER_QUERY=user_query
    )
```

**File: `backend/app/agents/orchestrator.py`**
```python
import hashlib
import json
from datetime import datetime
from typing import List, Tuple, Optional
from anthropic import Anthropic
from app.config import config
from app.rag.retriever import Retriever
from app.redis_client import redis_client
from app.database import SessionLocal, ChatSession, ChatMessage
from app.models import Citation, ChatResponse
from .prompts import get_system_prompt
import re

class OrchestratorAgent:
    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.client = Anthropic(api_key=config.CLAUDE_API_KEY)
        self.db = SessionLocal()
    
    def _generate_cache_key(self, query: str, java_version: str) -> str:
        """Generate cache key for query"""
        key_str = f"{java_version}:{query}"
        key_hash = hashlib.md5(key_str.encode()).hexdigest()
        return f"query:{key_hash}"
    
    def _extract_citations(self, answer: str, retrieved_docs: List[dict]) -> List[Citation]:
        """
        Extract citations from answer and match with retrieved documents.
        Looks for [text] patterns in answer and maps to source docs.
        """
        citations = []
        
        # Find all [text] patterns
        citation_pattern = r'\[([^\]]+)\]'
        cited_texts = re.findall(citation_pattern, answer)
        
        for cited_text in cited_texts:
            # Try to find matching document
            for doc in retrieved_docs:
                if cited_text.lower() in doc['text'].lower():
                    source = doc['metadata'].get('source', 'unknown')
                    citation = Citation(
                        text=cited_text,
                        file_name=source,
                        section=doc['metadata'].get('section', None),
                        page=doc['metadata'].get('page', None)
                    )
                    citations.append(citation)
                    break
        
        return citations
    
    def process_query(self, 
                      session_id: Optional[str],
                      user_query: str,
                      java_version: str) -> ChatResponse:
        """
        Main entry point for processing user query.
        
        Flow:
        1. Check cache
        2. Retrieve relevant documents
        3. Call Claude with context
        4. Extract citations
        5. Save to DB
        6. Cache result
        """
        
        # 1. Check cache
        cache_key = self._generate_cache_key(user_query, java_version)
        cached_result = redis_client.get(cache_key)
        
        if cached_result:
            return ChatResponse(
                session_id=session_id or "unknown",
                response=cached_result['response'],
                citations=[Citation(**c) for c in cached_result['citations']],
                source_version=java_version,
                timestamp=datetime.utcnow(),
                cache_hit=True
            )
        
        # 2. Retrieve documents
        retrieved_docs = self.retriever.retrieve(user_query, java_version, k=5)
        
        if not retrieved_docs:
            no_docs_response = f"No relevant documentation found in Java {java_version} docs for your query."
            return ChatResponse(
                session_id=session_id or "unknown",
                response=no_docs_response,
                citations=[],
                source_version=java_version,
                timestamp=datetime.utcnow(),
                cache_hit=False
            )
        
        # Build context from documents
        context = "\n\n---\n\n".join([
            f"[From: {doc['metadata'].get('source', 'unknown')}]\n{doc['text'][:500]}..."
            for doc in retrieved_docs
        ])
        
        # 3. Call Claude API
        system_prompt = get_system_prompt(java_version, context, user_query)
        
        try:
            response = self.client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=1000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_query}
                ]
            )
            
            answer = response.content[0].text
            tokens_used = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens
            }
        
        except Exception as e:
            print(f"Claude API error: {e}")
            answer = f"Error calling Claude API: {str(e)}"
            tokens_used = None
        
        # 4. Extract citations
        citations = self._extract_citations(answer, retrieved_docs)
        
        # 5. Save to DB
        if session_id:
            try:
                session = self.db.query(ChatSession).filter_by(id=session_id).first()
                if not session:
                    session = ChatSession(id=session_id)
                    self.db.add(session)
                
                # Save user message
                user_msg = ChatMessage(
                    session_id=session_id,
                    role="user",
                    content=user_query,
                    java_version=java_version
                )
                self.db.add(user_msg)
                
                # Save assistant message
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=answer,
                    citations=[c.dict() for c in citations],
                    java_version=java_version
                )
                self.db.add(assistant_msg)
                self.db.commit()
            except Exception as e:
                print(f"DB save error: {e}")
                self.db.rollback()
        
        # 6. Cache result
        cache_data = {
            'response': answer,
            'citations': [c.dict() for c in citations]
        }
        redis_client.set(cache_key, cache_data)
        
        return ChatResponse(
            session_id=session_id or "unknown",
            response=answer,
            citations=citations,
            source_version=java_version,
            timestamp=datetime.utcnow(),
            cache_hit=False,
            tokens_used=tokens_used
        )
```

#### Step 2.2: Implement FastAPI Endpoints

**File: `backend/app/api/chat.py`**
```python
from fastapi import APIRouter, HTTPException, Depends
from app.models import ChatRequest, ChatResponse
from app.agents.orchestrator import OrchestratorAgent
from app.rag.retriever import Retriever
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config
import uuid

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Initialize components
vector_store = VectorStore(config.CHROMA_PATH)
embedder = Embedder(config.EMBEDDING_MODEL)
retriever = Retriever(vector_store, embedder)
agent = OrchestratorAgent(retriever)

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Main chat endpoint.
    
    Request:
        - session_id: Optional[str] - Session ID (create new if not provided)
        - message: str - User query
        - java_version: str - "5", "8", "17", or "21"
    
    Response:
        - ChatResponse with answer + citations
    """
    
    # Validate Java version
    if request.java_version not in ["5", "8", "17", "21"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid Java version. Must be one of: 5, 8, 17, 21"
        )
    
    # Create session if not provided
    session_id = request.session_id or str(uuid.uuid4())
    
    # Process query
    response = agent.process_query(
        session_id=session_id,
        user_query=request.message,
        java_version=request.java_version
    )
    
    return response
```

**File: `backend/app/api/history.py`**
```python
from fastapi import APIRouter, HTTPException, Depends
from app.models import ChatHistory, ChatMessage
from app.database import SessionLocal, ChatSession
from datetime import datetime

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("/{session_id}", response_model=ChatHistory)
async def get_chat_history(session_id: str) -> ChatHistory:
    """Get chat history for a session"""
    
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter_by(id=session_id).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        messages = [
            ChatMessage(
                role=msg.role,
                content=msg.content,
                citations=msg.citations,
                timestamp=msg.created_at
            )
            for msg in session.messages
        ]
        
        return ChatHistory(
            session_id=session_id,
            created_at=session.created_at,
            messages=messages
        )
    finally:
        db.close()
```

**File: `backend/app/api/versions.py`**
```python
from fastapi import APIRouter
from app.models import VersionResponse

router = APIRouter(prefix="/api/versions", tags=["versions"])

@router.get("", response_model=VersionResponse)
async def get_versions() -> VersionResponse:
    """Get available Java versions"""
    return VersionResponse(
        versions=["5", "8", "17", "21"],
        default="8"
    )
```

**File: `backend/app/api/health.py`**
```python
from fastapi import APIRouter
from app.models import HealthResponse
from app.database import engine
from app.redis_client import redis_client
from app.config import config
from app.rag.vector_store import VectorStore
import sqlalchemy

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Check service health"""
    
    # Check PostgreSQL
    postgres_ok = False
    try:
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        postgres_ok = True
    except:
        pass
    
    # Check Redis
    redis_ok = False
    try:
        redis_client.client.ping()
        redis_ok = True
    except:
        pass
    
    # Check Chroma
    chroma_ok = False
    try:
        vector_store = VectorStore(config.CHROMA_PATH)
        vector_store.get_or_create_collection("5")
        chroma_ok = True
    except:
        pass
    
    return HealthResponse(
        status="ok" if all([postgres_ok, redis_ok, chroma_ok]) else "degraded",
        postgres=postgres_ok,
        redis=redis_ok,
        chroma=chroma_ok
    )
```

#### Step 2.3: Create FastAPI Main App

**File: `backend/app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, history, versions, health
from app.config import config

app = FastAPI(
    title="Java RAG Agent API",
    description="AI-powered Java documentation assistant",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(history.router)
app.include_router(versions.router)
app.include_router(health.router)

@app.get("/")
async def root():
    return {
        "message": "Java RAG Agent API",
        "endpoints": {
            "chat": "POST /api/chat",
            "history": "GET /api/history/{session_id}",
            "versions": "GET /api/versions",
            "health": "GET /api/health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

#### Step 2.4: Create Backend Dockerfile

**File: `backend/Dockerfile`**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY app/ ./app/
COPY init_db.py .

# Expose port
EXPOSE 8000

# Initialize DB and start app
CMD python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

### PHASE 3: FRONTEND
**Estimated Time**: 3-4 hours

#### Step 3.1: Initialize React + Vite

Create a new React project with Vite:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

#### Step 3.2: Install Dependencies

**File: `frontend/package.json` - Add dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "tailwindcss": "^3.3.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@tailwindcss/forms": "^0.5.7"
  }
}
```

Install: `npm install`

#### Step 3.3: Create Frontend Components

**File: `frontend/src/api/client.js`**
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const chatAPI = {
    sendMessage: (sessionId, message, javaVersion) =>
        client.post('/api/chat', { session_id: sessionId, message, java_version: javaVersion }),
    
    getHistory: (sessionId) =>
        client.get(`/api/history/${sessionId}`),
    
    getVersions: () =>
        client.get('/api/versions'),
    
    health: () =>
        client.get('/api/health'),
};

export default client;
```

**File: `frontend/src/components/Chat.jsx`**
```jsx
import React, { useState, useEffect } from 'react';
import { chatAPI } from '../api/client';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VersionSelector from './VersionSelector';

export default function Chat() {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [javaVersion, setJavaVersion] = useState('8');
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState(['5', '8', '17', '21']);

    // Load versions on mount
    useEffect(() => {
        chatAPI.getVersions().then(res => {
            setVersions(res.data.versions);
            setJavaVersion(res.data.default);
        }).catch(err => console.error('Failed to load versions:', err));
    }, []);

    // Create new session on mount
    useEffect(() => {
        const newSessionId = 'session-' + Date.now();
        setSessionId(newSessionId);
    }, []);

    // Load chat history if session exists
    useEffect(() => {
        if (sessionId && messages.length === 0) {
            chatAPI.getHistory(sessionId)
                .then(res => {
                    setMessages(res.data.messages);
                })
                .catch(err => {
                    // Session not found in DB, start fresh
                    console.log('New session started');
                });
        }
    }, [sessionId]);

    const handleSendMessage = async (message) => {
        if (!message.trim() || !sessionId) return;

        // Add user message
        setMessages(prev => [...prev, {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        }]);

        setLoading(true);

        try {
            const res = await chatAPI.sendMessage(sessionId, message, javaVersion);
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response,
                citations: res.data.citations,
                timestamp: res.data.timestamp
            }]);
        } catch (err) {
            console.error('Error sending message:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Error: Failed to get response. Please try again.',
                citations: [],
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Java Documentation Assistant</h1>
                    <VersionSelector 
                        versions={versions}
                        current={javaVersion}
                        onChange={setJavaVersion}
                    />
                </div>
            </div>

            {/* Messages */}
            <MessageList messages={messages} loading={loading} />

            {/* Input */}
            <MessageInput onSend={handleSendMessage} disabled={loading} />
        </div>
    );
}
```

**File: `frontend/src/components/MessageList.jsx`**
```jsx
import React, { useEffect, useRef } from 'react';
import CitationBadge from './CitationBadge';

export default function MessageList({ messages, loading }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="max-w-4xl mx-auto">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        <p className="text-lg">Ask me anything about Java documentation!</p>
                        <p className="text-sm mt-2">Select a version above to get started.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-2xl ${
                                msg.role === 'user' 
                                    ? 'bg-blue-600 rounded-lg p-3' 
                                    : 'bg-gray-800 rounded-lg p-3 border border-gray-700'
                            }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.citations && msg.citations.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {msg.citations.map((citation, i) => (
                                            <CitationBadge key={i} citation={citation} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
}
```

**File: `frontend/src/components/VersionSelector.jsx`**
```jsx
export default function VersionSelector({ versions, current, onChange }) {
    return (
        <select
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
            {versions.map(v => (
                <option key={v} value={v}>Java {v}</option>
            ))}
        </select>
    );
}
```

**File: `frontend/src/components/MessageInput.jsx`**
```jsx
import React, { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            onSend(input);
            setInput('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-gray-800 border-t border-gray-700 p-4">
            <div className="max-w-4xl mx-auto flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about Java documentation..."
                    disabled={disabled}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={disabled || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded transition"
                >
                    Send
                </button>
            </div>
        </form>
    );
}
```

**File: `frontend/src/components/CitationBadge.jsx`**
```jsx
export default function CitationBadge({ citation }) {
    return (
        <div className="text-xs bg-gray-700 rounded px-2 py-1 inline-block hover:bg-gray-600 cursor-pointer">
            <span className="text-blue-300">{citation.text}</span>
            {citation.file_name && <span className="text-gray-400 ml-1">- {citation.file_name}</span>}
            {citation.page && <span className="text-gray-400 ml-1">pg. {citation.page}</span>}
        </div>
    );
}
```

**File: `frontend/src/App.jsx`**
```jsx
import React from 'react';
import Chat from './components/Chat';

export default function App() {
    return <Chat />;
}
```

**File: `frontend/src/main.jsx`**
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
```

**File: `frontend/src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
}
```

**File: `frontend/Dockerfile`**
```dockerfile
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app
RUN npm install -g http-server

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["http-server", "dist", "-p", "3000"]
```

**File: `frontend/vite.config.js`**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
    }
})
```

**File: `frontend/tailwind.config.js`**
```javascript
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
```

---

### PHASE 4: DOCKER & DEPLOYMENT
**Estimated Time**: 2-3 hours

#### Step 4.1: Create Docker Compose

**File: `docker-compose.yml`**
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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rag_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      POSTGRES_URL: postgresql://rag_user:rag_password@postgres:5432/java_rag
      REDIS_URL: redis://redis:6379
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
      DEBUG: "False"
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/data:/app/data
      - ./backend/chroma_data:/app/chroma_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

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

networks:
  default:
    name: java-rag-network
```

#### Step 4.2: Create Environment File

**File: `.env.example`**
```
# Claude API
CLAUDE_API_KEY=sk-ant-xxxxx

# Database
POSTGRES_URL=postgresql://rag_user:rag_password@postgres:5432/java_rag

# Redis
REDIS_URL=redis://redis:6379

# Debug
DEBUG=False
```

#### Step 4.3: Create README

**File: `README.md`**
```markdown
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
docker-compose exec backend python -c "
from app.rag.pdf_loader import PDFLoader
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config

embedder = Embedder()
vector_store = VectorStore(config.CHROMA_PATH)

for version in ['5', '8', '17', '21']:
    pdf_path = f'data/java-{version}-docs.pdf'
    loader = PDFLoader(pdf_path)
    docs = loader.load_and_chunk()
    embeddings = embedder.embed_texts([doc[0] for doc in docs])
    vector_store.add_documents(version, docs, embeddings)
    print(f'Loaded Java {version}')
"
```

5. **Access**:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- Health: http://localhost:8000/api/health

## API Endpoints

### POST /api/chat
Send a question and get an answer with citations.

Request:
```json
{
    "session_id": "optional-uuid",
    "message": "How do I create a thread pool?",
    "java_version": "8"
}
```

Response:
```json
{
    "session_id": "uuid",
    "response": "To create a thread pool...",
    "citations": [
        {"text": "ExecutorService", "file_name": "java-8-docs.pdf", "page": 245}
    ],
    "source_version": "8",
    "cache_hit": false
}
```

### GET /api/history/{session_id}
Get chat history for a session.

### GET /api/versions
Get available Java versions.

### GET /api/health
Service health check.

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

## Development

### Local Development (without Docker)

1. **Python backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
uvicorn app.main:app --reload
```

2. **React frontend**:
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting

- **"No documents found"**: Vector store not initialized. Run the initialization script.
- **Claude API errors**: Check API key and rate limits.
- **Database connection errors**: Ensure PostgreSQL is running and credentials are correct.

## Cost Estimation

- 100 queries × 4 versions × $0.003 per query ≈ $1.20
- Budget: $20-50 recommended for testing

## Next Steps

- [ ] Add user authentication
- [ ] Support more Java versions
- [ ] Fine-tune prompts for better answers
- [ ] Add feedback mechanism for model improvement
- [ ] Deploy to cloud (AWS, GCP, Azure)

---

Made with ❤️ for the Java community
```

---

### PHASE 5: INITIALIZATION SCRIPT
**Estimated Time**: 1 hour (manual one-time)

**File: `backend/rag_init.py`**
```python
"""
Initialize RAG vector store with PDFs.
Run this after docker-compose is up.
"""

from app.rag.pdf_loader import PDFLoader
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config
import os

def initialize_rag():
    print("🚀 Initializing RAG Vector Store...")
    
    embedder = Embedder(config.EMBEDDING_MODEL)
    vector_store = VectorStore(config.CHROMA_PATH)
    
    versions = ['5', '8', '17', '21']
    
    for version in versions:
        pdf_path = os.path.join(config.PDF_DATA_PATH, f'java-{version}-docs.pdf')
        
        if not os.path.exists(pdf_path):
            print(f"⚠️  Skipping Java {version}: PDF not found at {pdf_path}")
            continue
        
        print(f"\n📖 Loading Java {version}...")
        
        try:
            # Load and chunk PDF
            loader = PDFLoader(pdf_path)
            docs = loader.load_and_chunk(chunk_size=500)
            print(f"  ✓ Chunked into {len(docs)} pieces")
            
            # Embed texts
            texts = [doc[0] for doc in docs]
            embeddings = embedder.embed_texts(texts)
            print(f"  ✓ Generated {len(embeddings)} embeddings")
            
            # Store in Chroma
            vector_store.add_documents(version, docs, embeddings)
            print(f"  ✓ Stored in Chroma")
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print("\n✅ RAG initialization complete!")

if __name__ == "__main__":
    initialize_rag()
```

---

## 📝 EXECUTION CHECKLIST

Use this checklist to track progress:

- [ ] **Day 1 Morning**: Project structure + Config + RAG core (pdf_loader, embedder, vector_store, retriever)
- [ ] **Day 1 Afternoon**: PostgreSQL + Redis + Orchestrator Agent
- [ ] **Day 1 Evening**: FastAPI endpoints (all 5 endpoints)
- [ ] **Day 2 Morning**: React components (Chat, MessageList, VersionSelector, etc.)
- [ ] **Day 2 Afternoon**: Frontend styling + API integration
- [ ] **Day 2 Evening**: Docker + docker-compose + test locally
- [ ] **Day 3 Morning**: Download PDFs + Initialize vector store
- [ ] **Day 3 Afternoon**: Integration testing + bug fixes
- [ ] **Day 3 Evening**: Final polish + demo ready

---

## 🎯 SUCCESS METRICS

Before presenting:

✅ Chat sends message → gets response with citations in <3s
✅ Version selector switches Java versions correctly
✅ Chat history persists across sessions
✅ No hallucinations (all citations traceable)
✅ `docker-compose up` starts full stack
✅ `/api/health` returns all services green
✅ Code is clean, documented, and production-ready
✅ README is comprehensive for handoff

---

**Generated**: 2025-05-20  
**Project**: Java RAG Agent AI Interview Test  
**Duration**: 3 days  
**Budget**: $20-50

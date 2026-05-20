from sqlalchemy import create_engine, Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
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
    role = Column(String)
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

engine = create_engine(config.POSTGRES_URL)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

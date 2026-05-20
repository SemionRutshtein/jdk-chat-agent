from .vector_store import VectorStore
from .embedder import Embedder
from typing import List

class Retriever:
    def __init__(self, vector_store: VectorStore, embedder: Embedder):
        self.vector_store = vector_store
        self.embedder = embedder

    def retrieve(self, query: str, java_version: str, k: int = 5) -> List[dict]:
        query_embedding = self.embedder.embed_text(query).tolist()
        return self.vector_store.search(java_version, query_embedding, k=k)

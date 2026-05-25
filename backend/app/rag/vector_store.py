import logging
import os
from typing import List, Tuple

import chromadb

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self, persist_path: str) -> None:
        self.persist_path = persist_path
        os.makedirs(persist_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_path)
        self._collections: dict = {}

    def get_or_create_collection(self, java_version: str):
        name = f"java-{java_version}"
        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collections[name]

    def add_documents(
        self,
        java_version: str,
        documents: List[Tuple[str, dict]],
        embeddings: List[List[float]],
    ) -> None:
        collection = self.get_or_create_collection(java_version)
        ids = [f"{java_version}_{i}" for i in range(len(documents))]
        texts = [text for text, _ in documents]
        metadatas = [meta for _, meta in documents]
        collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
        logger.info("Added %d documents to java-%s", len(ids), java_version)

    def search(
        self, java_version: str, query_embedding: List[float], k: int = 5
    ) -> List[dict]:
        collection = self.get_or_create_collection(java_version)
        results = collection.query(query_embeddings=[query_embedding], n_results=k)
        return [
            {
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
            }
            for i in range(len(results["documents"][0]))
        ]

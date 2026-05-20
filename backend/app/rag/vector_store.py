import chromadb
import os
from typing import List, Tuple

class VectorStore:
    def __init__(self, persist_path: str):
        self.persist_path = persist_path
        os.makedirs(persist_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_path)
        self.collections = {}

    def get_or_create_collection(self, java_version: str):
        collection_name = f"java-{java_version}"
        if collection_name not in self.collections:
            self.collections[collection_name] = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return self.collections[collection_name]

    def add_documents(self, java_version: str, documents: List[Tuple[str, dict]], embeddings: List[List[float]]):
        collection = self.get_or_create_collection(java_version)
        ids = []
        texts = []
        metadatas = []

        for i, (text, metadata) in enumerate(documents):
            ids.append(f"{java_version}_{i}")
            texts.append(text)
            metadatas.append(metadata)

        collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metadatas)
        print(f"Added {len(ids)} documents to java-{java_version}")

    def search(self, java_version: str, query_embedding: List[float], k: int = 5) -> List[dict]:
        collection = self.get_or_create_collection(java_version)
        results = collection.query(query_embeddings=[query_embedding], n_results=k)

        docs = []
        for i in range(len(results['documents'][0])):
            docs.append({
                'text': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'distance': results['distances'][0][i]
            })
        return docs

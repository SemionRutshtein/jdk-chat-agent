from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np

class Embedder:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()

    def embed_text(self, text: str) -> np.ndarray:
        return self.model.encode([text])[0]

    def embed_texts(self, texts: List[str]) -> List[np.ndarray]:
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return [e for e in embeddings]

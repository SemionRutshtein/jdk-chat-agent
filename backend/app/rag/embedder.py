from chromadb.utils import embedding_functions
from typing import List
import numpy as np

class Embedder:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        # Uses ONNX runtime — no PyTorch dependency
        self._fn = embedding_functions.DefaultEmbeddingFunction()
        self.embedding_dim = 384  # all-MiniLM-L6-v2 output dim

    def embed_text(self, text: str) -> np.ndarray:
        return np.array(self._fn([text])[0])

    def embed_texts(self, texts: List[str]) -> List[np.ndarray]:
        results = self._fn(texts)
        return [np.array(e) for e in results]

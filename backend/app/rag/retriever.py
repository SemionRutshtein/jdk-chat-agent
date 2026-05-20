import logging
from typing import List

from rank_bm25 import BM25Okapi

from .vector_store import VectorStore
from .embedder import Embedder

logger = logging.getLogger(__name__)

# Reciprocal Rank Fusion constant — higher k = less sensitivity to top ranks
_RRF_K = 60
_VECTOR_CANDIDATES = 15   # over-fetch for re-ranking
_FINAL_K = 6              # returned to orchestrator


def _tokenize(text: str) -> List[str]:
    """Lowercase whitespace tokenizer — fast, no external deps."""
    return text.lower().split()


def _reciprocal_rank_fusion(rankings: List[List[str]]) -> List[str]:
    """
    Combine multiple ranked lists of doc IDs using RRF.
    Returns IDs sorted by descending fused score.
    """
    scores: dict[str, float] = {}
    for ranked in rankings:
        for rank, doc_id in enumerate(ranked):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
    return sorted(scores, key=lambda d: scores[d], reverse=True)


class Retriever:
    def __init__(self, vector_store: VectorStore, embedder: Embedder):
        self.vector_store = vector_store
        self.embedder = embedder

    def retrieve(self, query: str, java_version: str, k: int = _FINAL_K) -> List[dict]:
        """
        Hybrid retrieval: vector similarity + BM25 over candidates, fused with RRF.

        Steps:
          1. Embed query → fetch _VECTOR_CANDIDATES chunks from Chroma (vector ranking)
          2. Build BM25 index over those candidates → get BM25 ranking
          3. RRF-fuse both rankings → return top k
        """
        # 1. Vector retrieval (over-fetch)
        query_embedding = self.embedder.embed_text(query).tolist()
        candidates = self.vector_store.search(java_version, query_embedding, k=_VECTOR_CANDIDATES)

        if not candidates:
            return []

        # Assign stable IDs to candidates
        ids = [str(i) for i in range(len(candidates))]
        id_to_doc = {str(i): doc for i, doc in enumerate(candidates)}

        # Vector ranking order (already sorted by cosine distance, best first)
        vector_ranking = ids[:]

        # 2. BM25 over candidate texts
        tokenized_corpus = [_tokenize(doc["text"]) for doc in candidates]
        bm25 = BM25Okapi(tokenized_corpus)
        bm25_scores = bm25.get_scores(_tokenize(query))
        bm25_ranking = [ids[i] for i in sorted(range(len(ids)), key=lambda x: bm25_scores[x], reverse=True)]

        # 3. RRF fusion
        fused_ids = _reciprocal_rank_fusion([vector_ranking, bm25_ranking])

        result = [id_to_doc[i] for i in fused_ids[:k]]
        logger.debug(
            f"Hybrid retrieval: version={java_version} candidates={len(candidates)} returned={len(result)}"
        )
        return result

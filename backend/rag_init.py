"""Initialize RAG vector store with PDFs. Streams one PDF at a time to stay within RAM limits."""

import gc
import os
import chromadb
from app.rag.pdf_loader import PDFLoader
from app.rag.vector_store import VectorStore
from app.config import config
from chromadb.utils import embedding_functions

VERSIONS = {
    '8':  ['java-8-jls.pdf',  'java-8-jvms.pdf'],
    '17': ['java-17-jls.pdf', 'java-17-jvms.pdf'],
    '21': ['java-21-jls.pdf', 'java-21-jvms.pdf'],
}

BATCH_SIZE = 32


def embed_and_store(collection, pdf_path: str, embed_fn, global_idx: int) -> int:
    """Load one PDF, embed in batches of BATCH_SIZE, add to collection. Returns next global_idx."""
    print(f"  Loading {os.path.basename(pdf_path)}...", flush=True)
    loader = PDFLoader(pdf_path)
    chunks = loader.load_and_chunk(chunk_size=500)
    print(f"  {len(chunks)} chunks", flush=True)

    for batch_start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[batch_start:batch_start + BATCH_SIZE]
        texts = [c[0] for c in batch]
        metas = [c[1] for c in batch]
        ids = [f"doc_{global_idx + j}" for j in range(len(batch))]

        embeddings = embed_fn(texts)

        collection.add(ids=ids, documents=texts, embeddings=embeddings, metadatas=metas)
        global_idx += len(batch)

        if (batch_start // BATCH_SIZE) % 10 == 0:
            print(f"  ... {global_idx} docs stored", flush=True)

    del chunks
    gc.collect()
    return global_idx


def initialize_rag():
    print("Initializing RAG Vector Store...", flush=True)

    embed_fn = embedding_functions.DefaultEmbeddingFunction()
    vs = VectorStore(config.CHROMA_PATH)

    for version, pdf_files in VERSIONS.items():
        print(f"\nProcessing Java {version}...", flush=True)
        collection = vs.get_or_create_collection(version)

        if collection.count() > 0:
            print(f"  Java {version} already seeded ({collection.count()} docs) - skipping", flush=True)
            continue

        global_idx = 0
        for pdf_file in pdf_files:
            pdf_path = os.path.join(config.PDF_DATA_PATH, pdf_file)
            if not os.path.exists(pdf_path):
                print(f"  Skipping {pdf_file}: not found", flush=True)
                continue

            for attempt in range(3):
                try:
                    global_idx = embed_and_store(collection, pdf_path, embed_fn, global_idx)
                    break
                except Exception as e:
                    if attempt < 2:
                        print(f"  Retry {attempt + 1}/3 for {pdf_file}: {e}", flush=True)
                        import time; time.sleep(2)
                    else:
                        print(f"  Failed {pdf_file} after 3 attempts: {e}", flush=True)

        print(f"  Java {version} done: {collection.count()} docs total", flush=True)
        gc.collect()

    print("\nRAG initialization complete!", flush=True)


if __name__ == "__main__":
    initialize_rag()

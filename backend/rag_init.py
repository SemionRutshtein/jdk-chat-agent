"""Initialize RAG vector store with PDFs. Run after docker-compose is up."""

from app.rag.pdf_loader import PDFLoader
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config
import os

def initialize_rag():
    print("Initializing RAG Vector Store...")

    embedder = Embedder(config.EMBEDDING_MODEL)
    vector_store = VectorStore(config.CHROMA_PATH)

    versions = ['5', '8', '17', '21']

    for version in versions:
        pdf_path = os.path.join(config.PDF_DATA_PATH, f'java-{version}-docs.pdf')

        if not os.path.exists(pdf_path):
            print(f"Skipping Java {version}: PDF not found at {pdf_path}")
            continue

        print(f"Loading Java {version}...")

        try:
            loader = PDFLoader(pdf_path)
            docs = loader.load_and_chunk(chunk_size=500)
            print(f"  Chunked into {len(docs)} pieces")

            texts = [doc[0] for doc in docs]
            embeddings = embedder.embed_texts(texts)
            print(f"  Generated {len(embeddings)} embeddings")

            vector_store.add_documents(version, docs, [e.tolist() for e in embeddings])
            print(f"  Stored in Chroma")

        except Exception as e:
            print(f"  Error: {e}")

    print("RAG initialization complete!")

if __name__ == "__main__":
    initialize_rag()

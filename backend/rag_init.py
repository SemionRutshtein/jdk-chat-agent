"""Initialize RAG vector store with PDFs. Run after docker-compose is up."""

from app.rag.pdf_loader import PDFLoader
from app.rag.vector_store import VectorStore
from app.rag.embedder import Embedder
from app.config import config
import os

# 2 PDFs per version: Language Spec (jls) + JVM Spec (jvms)
VERSIONS = {
    '8':  ['java-8-jls.pdf',  'java-8-jvms.pdf'],
    '17': ['java-17-jls.pdf', 'java-17-jvms.pdf'],
    '21': ['java-21-jls.pdf', 'java-21-jvms.pdf'],
}

def initialize_rag():
    print("Initializing RAG Vector Store...")

    embedder = Embedder(config.EMBEDDING_MODEL)
    vector_store = VectorStore(config.CHROMA_PATH)

    for version, pdf_files in VERSIONS.items():
        print(f"\nLoading Java {version}...")
        all_docs = []

        for pdf_file in pdf_files:
            pdf_path = os.path.join(config.PDF_DATA_PATH, pdf_file)

            if not os.path.exists(pdf_path):
                print(f"  Skipping {pdf_file}: not found")
                continue

            try:
                loader = PDFLoader(pdf_path)
                docs = loader.load_and_chunk(chunk_size=500)
                print(f"  {pdf_file}: {len(docs)} chunks")
                all_docs.extend(docs)
            except Exception as e:
                print(f"  Error loading {pdf_file}: {e}")

        if not all_docs:
            print(f"  No docs loaded for Java {version}, skipping")
            continue

        try:
            texts = [doc[0] for doc in all_docs]
            embeddings = embedder.embed_texts(texts)
            print(f"  Generated {len(embeddings)} embeddings total")

            vector_store.add_documents(version, all_docs, [e.tolist() for e in embeddings])
            print(f"  Stored in Chroma collection java-{version}")
        except Exception as e:
            print(f"  Error embedding/storing: {e}")

    print("\nRAG initialization complete!")

if __name__ == "__main__":
    initialize_rag()

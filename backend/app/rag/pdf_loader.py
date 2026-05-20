import PyPDF2
import shutil
import tempfile
from pathlib import Path
from typing import List, Tuple

class PDFLoader:
    def __init__(self, pdf_path: str):
        self.pdf_path = pdf_path

    def extract_text(self) -> str:
        # Copy to /tmp first — avoids macOS Docker volume deadlock (EAGAIN/EDEADLK)
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            shutil.copy2(self.pdf_path, tmp.name)
            tmp_path = tmp.name

        text = ""
        with open(tmp_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num, page in enumerate(pdf_reader.pages):
                text += f"[PAGE {page_num + 1}]\n"
                text += page.extract_text() or ""
                text += "\n"

        Path(tmp_path).unlink(missing_ok=True)
        return text

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[Tuple[str, dict]]:
        chunks = []
        words = text.split()
        chunk_words = []

        for word in words:
            chunk_words.append(word)

            if len(chunk_words) >= chunk_size:
                chunk_text = " ".join(chunk_words)
                metadata = {
                    "source": Path(self.pdf_path).name,
                    "chunk_index": len(chunks),
                    "word_count": len(chunk_words)
                }
                chunks.append((chunk_text, metadata))
                chunk_words = chunk_words[-overlap:]

        if chunk_words:
            chunks.append((" ".join(chunk_words), {
                "source": Path(self.pdf_path).name,
                "chunk_index": len(chunks),
                "word_count": len(chunk_words)
            }))

        return chunks

    def load_and_chunk(self, chunk_size: int = 500) -> List[Tuple[str, dict]]:
        text = self.extract_text()
        return self.chunk_text(text, chunk_size=chunk_size)

import logging
import shutil
import tempfile
from pathlib import Path
from typing import List, Tuple

import PyPDF2

logger = logging.getLogger(__name__)


class PDFLoader:
    def __init__(self, pdf_path: str) -> None:
        self.pdf_path = Path(pdf_path)

    def extract_text(self) -> str:
        # Copy to a temp dir first — avoids macOS Docker volume deadlock (EAGAIN/EDEADLK)
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir) / "doc.pdf"
            shutil.copy2(self.pdf_path, tmp_path)
            parts: List[str] = []
            with open(tmp_path, "rb") as fh:
                reader = PyPDF2.PdfReader(fh)
                for page_num, page in enumerate(reader.pages):
                    parts.append(f"[PAGE {page_num + 1}]\n")
                    parts.append(page.extract_text() or "")
                    parts.append("\n")
        return "".join(parts)

    def chunk_text(
        self, text: str, chunk_size: int = 500, overlap: int = 100
    ) -> List[Tuple[str, dict]]:
        chunks: List[Tuple[str, dict]] = []
        words = text.split()
        start = 0

        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_words = words[start:end]
            chunks.append((
                " ".join(chunk_words),
                {
                    "source": self.pdf_path.name,
                    "chunk_index": len(chunks),
                    "word_count": len(chunk_words),
                },
            ))
            if end == len(words):
                break
            start = end - overlap

        return chunks

    def load_and_chunk(self, chunk_size: int = 500) -> List[Tuple[str, dict]]:
        text = self.extract_text()
        return self.chunk_text(text, chunk_size=chunk_size)

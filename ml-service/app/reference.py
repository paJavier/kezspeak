"""Turn a tutor's reference file into a Gemini request part.

Files are read in memory and never stored. PDFs go to Gemini as-is (it reads
them natively); TXT and DOCX are sent as plain text.
"""

import base64
import io
import re
import zipfile
from xml.etree import ElementTree

MAX_REFERENCE_BYTES = 10 * 1024 * 1024
# Enough for a long lesson handout while keeping each Gemini call small.
MAX_TEXT_CHARS = 60_000
ALLOWED_EXTENSIONS = ("pdf", "docx", "txt")

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


class ReferenceFileError(ValueError):
    pass


def _docx_text(raw: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            info = archive.getinfo("word/document.xml")
            # A zip bomb could expand far past the upload limit.
            if info.file_size > 20 * MAX_REFERENCE_BYTES:
                raise ReferenceFileError("This DOCX file is too large to read.")
            root = ElementTree.fromstring(archive.read(info))
    except (KeyError, zipfile.BadZipFile, ElementTree.ParseError) as exc:
        raise ReferenceFileError("This DOCX file could not be read.") from exc
    paragraphs = ("".join(t.text or "" for t in p.iter(f"{_W}t")) for p in root.iter(f"{_W}p"))
    return "\n".join(p for p in paragraphs if p.strip())


def _text_part(text: str) -> dict:
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        raise ReferenceFileError("The file has no readable text.")
    return {"text": text[:MAX_TEXT_CHARS]}


def to_gemini_part(filename: str, raw: bytes) -> dict:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise ReferenceFileError("Choose a PDF, DOCX, or TXT file.")
    if len(raw) > MAX_REFERENCE_BYTES:
        raise ReferenceFileError("The file must be 10 MB or smaller.")
    if not raw:
        raise ReferenceFileError("The file is empty.")

    if extension == "pdf":
        if not raw.startswith(b"%PDF"):
            raise ReferenceFileError("This file is not a valid PDF.")
        return {"inline_data": {"mime_type": "application/pdf", "data": base64.b64encode(raw).decode()}}
    if extension == "docx":
        return _text_part(_docx_text(raw))
    return _text_part(raw.decode("utf-8", errors="replace"))

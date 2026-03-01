import PyPDF2
import io
import zipfile


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extracts text from a PDF file content."""
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text.strip()


def extract_pdfs_from_zip(zip_bytes: bytes) -> list[tuple[str, str]]:
    """
    Extracts all PDF files from a ZIP archive.
    Returns a list of (filename, extracted_text) tuples.
    """
    results = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        for name in zf.namelist():
            # Skip directories and hidden/macOS resource files
            if name.endswith("/") or name.startswith("__MACOSX") or name.startswith("."):
                continue
            if name.lower().endswith(".pdf"):
                pdf_bytes = zf.read(name)
                try:
                    text = extract_text_from_pdf(pdf_bytes)
                    if text:  # Only include PDFs with extractable text
                        # Use just the filename, not the full path inside ZIP
                        filename = name.split("/")[-1]
                        results.append((filename, text))
                except Exception:
                    # Skip corrupted PDFs
                    pass
    return results


def extract_jds_from_zip(zip_bytes: bytes) -> list[tuple[str, str]]:
    """
    Extracts all JD PDF files from a ZIP archive.
    Returns a list of (filename, extracted_text) tuples.
    """
    return extract_pdfs_from_zip(zip_bytes)


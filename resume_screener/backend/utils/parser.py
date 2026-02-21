import PyPDF2
import io

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extracts text from a PDF file content."""
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text.strip()

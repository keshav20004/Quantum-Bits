from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, Response
from sqlalchemy.orm import Session
import uvicorn
import os
import json
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db, Base
from models import User, Transaction
from auth import get_current_user, check_credits, deduct_credits
from utils.parser import extract_text_from_pdf, extract_pdfs_from_zip
from utils.llm_logic import score_resume, bulk_score_resumes
from utils.csv_export import generate_csv
from routes.auth_routes import router as auth_router
from routes.payment_routes import router as payment_router

# ── Create DB tables on startup ──────────
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ASR Services")

# Include API routers
app.include_router(auth_router)
app.include_router(payment_router)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for bulk results (keyed by session_id)
bulk_results_store: dict[str, list[dict]] = {}


# ── Single Resume Analyze (protected) ────────────────────────

@app.post("/analyze")
async def seniority_analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(None),
    job_description_file: UploadFile = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check credits BEFORE analysis
    check_credits(user, required=1)

    if not resume.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")

    try:
        resume_content = await resume.read()
        resume_text = extract_text_from_pdf(resume_content)

        final_jd = job_description
        if job_description_file and job_description_file.filename.endswith(".pdf"):
            jd_content = await job_description_file.read()
            final_jd = extract_text_from_pdf(jd_content)

        if not final_jd:
            raise HTTPException(status_code=400, detail="Job description text or PDF is required.")

        analysis = score_resume(resume_text, final_jd)

        # Deduct 1 credit after successful analysis
        deduct_credits(db, user, count=1)

        # Return analysis with remaining credits
        analysis["credits_remaining"] = user.resume_credits
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Bulk Resume Screening (protected) ────────────────────────

@app.post("/bulk-analyze")
async def bulk_analyze(
    resumes: list[UploadFile] = File(...),
    job_description: str = Form(None),
    job_description_file: UploadFile = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts multiple resume PDFs (or a single ZIP) + a job description.
    Returns Server-Sent Events streaming each scored result in real-time.
    """
    # 1. Extract job description
    final_jd = job_description
    if job_description_file and job_description_file.filename and job_description_file.filename.endswith(".pdf"):
        jd_content = await job_description_file.read()
        final_jd = extract_text_from_pdf(jd_content)

    if not final_jd:
        raise HTTPException(status_code=400, detail="Job description text or PDF is required.")

    # 2. Extract all resumes
    resume_pairs: list[tuple[str, str]] = []  # (filename, text)

    for upload in resumes:
        content = await upload.read()
        fname = upload.filename or "unknown.pdf"

        if fname.lower().endswith(".zip"):
            pairs = extract_pdfs_from_zip(content)
            resume_pairs.extend(pairs)
        elif fname.lower().endswith(".pdf"):
            try:
                text = extract_text_from_pdf(content)
                if text:
                    resume_pairs.append((fname, text))
            except Exception:
                pass
        # Silently skip non-PDF/non-ZIP files

    if not resume_pairs:
        raise HTTPException(status_code=400, detail="No valid PDF resumes found in the uploaded files.")

    total = len(resume_pairs)

    # 3. Check credits BEFORE processing
    check_credits(user, required=total)

    session_id = str(uuid.uuid4())

    # Capture user_id for use in the generator (avoid session issues)
    user_id = user.id

    # 4. Stream results via SSE
    async def event_stream():
        results = []
        processed = 0

        # Send initial metadata
        yield f"data: {json.dumps({'type': 'start', 'total': total, 'session_id': session_id})}\\n\\n"

        async for result in bulk_score_resumes(resume_pairs, final_jd, concurrency=20):
            processed += 1
            result["index"] = processed
            result["total"] = total
            result["type"] = "result"
            results.append(result)
            yield f"data: {json.dumps(result)}\\n\\n"

        # Store results for CSV download
        bulk_results_store[session_id] = results

        # Deduct credits after ALL processing is done
        deduct_db = next(get_db())
        try:
            db_user = deduct_db.query(User).filter(User.id == user_id).first()
            if db_user:
                deduct_credits(deduct_db, db_user, count=total)
                credits_remaining = db_user.resume_credits
            else:
                credits_remaining = 0
        finally:
            deduct_db.close()

        # Send completion event
        shortlisted = sum(1 for r in results if r.get("score", 0) >= 60)
        avg_score = round(sum(r.get("score", 0) for r in results) / max(len(results), 1), 1)
        yield f"data: {json.dumps({'type': 'complete', 'total': total, 'processed': processed, 'shortlisted': shortlisted, 'avg_score': avg_score, 'session_id': session_id, 'credits_remaining': credits_remaining})}\\n\\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/download-results/{session_id}")
async def download_results(session_id: str):
    """Download bulk screening results as CSV."""
    results = bulk_results_store.get(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found or expired.")

    csv_bytes = generate_csv(results)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=screening_results_{session_id[:8]}.csv"},
    )


# --- Serve Frontend Static Files ---
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    # Mount static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static-assets")

    # Serve index.html for all non-API routes (SPA catch-all)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

from utils.parser import extract_text_from_pdf
from utils.llm_logic import score_resume

app = FastAPI(title="Resume Screening AI")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def seniority_analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(None),
    job_description_file: UploadFile = File(None)
):
    if not resume.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported.")
    
    try:
        # 1. Read and Parse Resume PDF
        resume_content = await resume.read()
        resume_text = extract_text_from_pdf(resume_content)
        
        # 2. Extract Job Description Text
        final_jd = job_description
        if job_description_file and job_description_file.filename.endswith(".pdf"):
            jd_content = await job_description_file.read()
            final_jd = extract_text_from_pdf(jd_content)
        
        if not final_jd:
            raise HTTPException(status_code=400, detail="Job description text or PDF is required.")

        # 3. Score with LLM
        analysis = score_resume(resume_text, final_jd)
        
        return analysis
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

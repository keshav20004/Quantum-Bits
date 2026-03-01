import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List, Literal, AsyncGenerator


class ResumeScore(BaseModel):
    score: int = Field(description="Match score between 0 and 100")
    verdict: str = Field(description="One of: 'Shortlisted', 'Maybe', or 'Rejected'")
    reason: str = Field(description="One clear sentence explaining WHY this candidate was shortlisted, maybe, or rejected relative to the job description")
    matching_skills: List[str] = Field(description="List of skills found in both resume and job description")
    missing_skills: List[str] = Field(description="List of required skills missing from the resume")
    summary: str = Field(description="Brief analysis of the candidate's suitability")


def _build_chain():
    """Build the LangChain scoring chain (reusable)."""
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0)
    parser = JsonOutputParser(pydantic_object=ResumeScore)

    prompt = ChatPromptTemplate.from_template(
        "You are an expert HR recruiter screening resumes against a job description.\n\n"
        "INSTRUCTIONS:\n"
        "1. Compare the resume with the job description carefully.\n"
        "2. Provide a match score (0-100).\n"
        "3. Provide a verdict: 'Shortlisted' (score >= 70), 'Maybe' (score 50-69), or 'Rejected' (score < 50).\n"
        "4. Provide a clear, specific REASON explaining why this candidate was shortlisted, maybe, or rejected. "
        "For rejected candidates, state exactly what critical skills/experience they lack. "
        "For shortlisted candidates, state what makes them a strong match.\n"
        "5. List matching skills and missing skills.\n"
        "6. Write a brief summary of the candidate's overall suitability.\n\n"
        "Job Description:\n{job_description}\n\n"
        "Resume:\n{resume_text}\n\n"
        "{format_instructions}"
    )

    return prompt | llm | parser, parser


def score_resume(resume_text: str, job_description: str) -> dict:
    """Scores a resume against a job description using Google Gemini (sync)."""
    chain, parser = _build_chain()

    result = chain.invoke({
        "resume_text": resume_text,
        "job_description": job_description,
        "format_instructions": parser.get_format_instructions()
    })

    return result


async def async_score_resume(
    filename: str,
    resume_text: str,
    job_description: str,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Async wrapper for scoring a single resume with semaphore-bounded concurrency."""
    async with semaphore:
        try:
            result = await asyncio.to_thread(score_resume, resume_text, job_description)
            result["filename"] = filename
            return result
        except Exception as e:
            return {
                "filename": filename,
                "score": 0,
                "verdict": "Rejected",
                "reason": f"Error processing this resume: {str(e)}",
                "matching_skills": [],
                "missing_skills": [],
                "summary": f"Error processing: {str(e)}",
                "error": True,
            }


async def bulk_score_resumes(
    resumes: list[tuple[str, str]],
    job_description: str,
    concurrency: int = 20,
) -> AsyncGenerator[dict, None]:
    """
    Process multiple resumes concurrently against a single job description.
    Yields results one-by-one as they complete.
    """
    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        asyncio.create_task(
            async_score_resume(filename, text, job_description, semaphore)
        )
        for filename, text in resumes
    ]

    for coro in asyncio.as_completed(tasks):
        result = await coro
        yield result


async def async_score_resume_against_jd(
    jd_filename: str,
    resume_text: str,
    jd_text: str,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Async wrapper for scoring a resume against a single JD (reverse mode)."""
    async with semaphore:
        try:
            result = await asyncio.to_thread(score_resume, resume_text, jd_text)
            result["jd_filename"] = jd_filename
            return result
        except Exception as e:
            return {
                "jd_filename": jd_filename,
                "score": 0,
                "verdict": "Rejected",
                "reason": f"Error processing this JD: {str(e)}",
                "matching_skills": [],
                "missing_skills": [],
                "summary": f"Error processing: {str(e)}",
                "error": True,
            }


async def bulk_score_resume_against_jds(
    resume_text: str,
    jd_pairs: list[tuple[str, str]],
    concurrency: int = 20,
) -> AsyncGenerator[dict, None]:
    """
    Process one resume against multiple JDs concurrently (reverse mode).
    Yields results one-by-one as they complete.
    """
    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        asyncio.create_task(
            async_score_resume_against_jd(jd_filename, resume_text, jd_text, semaphore)
        )
        for jd_filename, jd_text in jd_pairs
    ]

    for coro in asyncio.as_completed(tasks):
        result = await coro
        yield result

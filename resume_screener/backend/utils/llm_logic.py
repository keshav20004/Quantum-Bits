from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List

class ResumeScore(BaseModel):
    score: int = Field(description="Match score between 0 and 100")
    matching_skills: List[str] = Field(description="List of skills found in both resume and job description")
    missing_skills: List[str] = Field(description="List of required skills missing from the resume")
    summary: str = Field(description="Brief analysis of the candidate's suitability")

def score_resume(resume_text: str, job_description: str) -> dict:
    """Scores a resume against a job description using Google Gemini."""
    
    # Updated to gemini-flash-latest which is verified to work with the provided API key.
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    
    parser = JsonOutputParser(pydantic_object=ResumeScore)
    
    prompt = ChatPromptTemplate.from_template(
        "You are an expert HR recruiter. Compare the following resume with the job description.\n"
        "Provide a match score (0-100), identify matching skills, missing skills, and a brief summary.\n\n"
        "Job Description:\n{job_description}\n\n"
        "Resume:\n{resume_text}\n\n"
        "{format_instructions}"
    )
    
    chain = prompt | llm | parser
    
    result = chain.invoke({
        "resume_text": resume_text,
        "job_description": job_description,
        "format_instructions": parser.get_format_instructions()
    })
    
    return result

import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

try:
    print("\nAttempting a test generation with 'gemini-flash-latest'...")
    response = client.models.generate_content(
        model='gemini-flash-latest',
        contents='Say hello'
    )
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

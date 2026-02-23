import os
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv

# Load .env from the backend root (…/backend/.env) regardless of CWD.
backend_root = Path(__file__).resolve().parents[1]
load_dotenv(backend_root / ".env")

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY is not set. Put it in backend/.env or set it in your shell."
    )

client = Groq(api_key=api_key)

def generate_response(prompt: str):
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    return completion.choices[0].message.content.strip()

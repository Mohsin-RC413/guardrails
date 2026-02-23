import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models import TextRequest, FullProcessRequest
from app.validators import (
    guard_pii,
    guard_gibberish,
    guard_toxic,
    guard_nsfw,
    run_validation
)
from app.groq_client import generate_response

app = FastAPI(title="Guardrails LLM Backend")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")
cors_origin_regex = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"http://(localhost|127\.0\.0\.1):\d+",
).strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_origin_regex=cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Individual Guardrail Endpoints
# -------------------------------

@app.post("/validate/pii")
def validate_pii(request: TextRequest):
    return run_validation(guard_pii, request.text)


@app.post("/validate/gibberish")
def validate_gibberish(request: TextRequest):
    return run_validation(guard_gibberish, request.text)


@app.post("/validate/toxic")
def validate_toxic(request: TextRequest):
    return run_validation(guard_toxic, request.text)


@app.post("/validate/nsfw")
def validate_nsfw(request: TextRequest):
    if guard_nsfw is None:
        return {
            "status": "not_configured",
            "message": (
                "NSFW validator is not installed. Install a Guardrails Hub "
                "NSFW validator and ensure it is available in guardrails.hub."
            )
        }
    return run_validation(guard_nsfw, request.text)


# -------------------------------
# Full Pipeline Endpoint
# -------------------------------

@app.post("/process/full")
def full_process(request: FullProcessRequest):

    # Step 1: Validate Prompt
    prompt = request.prompt

    prompt_validators = [
        ("pii", guard_pii),
        ("gibberish", guard_gibberish),
        ("toxic", guard_toxic),
    ]
    if guard_nsfw is not None:
        prompt_validators.append(("nsfw", guard_nsfw))

    for name, guard in prompt_validators:
        result = run_validation(guard, prompt)
        if result["status"] == "failed":
            return {
                "phase": "prompt_validation",
                "validator_failed": name,
                "details": result
            }
        prompt = result.get("output", prompt)

    # Step 2: Generate LLM Response
    try:
        response = generate_response(prompt)
    except Exception as exc:
        return {
            "phase": "generation",
            "status": "failed",
            "error": str(exc)
        }

    # Step 3: Validate Response
    for name, guard in prompt_validators:
        result = run_validation(guard, response)
        if result["status"] == "failed":
            return {
                "phase": "response_validation",
                "validator_failed": name,
                "details": result
            }
        response = result.get("output", response)

    return {
        "status": "success",
        "validated_prompt": prompt,
        "validated_response": response
    }

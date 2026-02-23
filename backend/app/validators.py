import time
from guardrails import Guard, install


def _load_validator(class_name: str, hub_uri: str):
    """Load a Hub validator class, installing it if needed."""
    try:
        from guardrails import hub as hub_mod
        return getattr(hub_mod, class_name)
    except Exception:
        pass

    try:
        module = install(hub_uri, quiet=True)
        return getattr(module, class_name)
    except Exception as exc:
        raise RuntimeError(
            f"Unable to load {class_name}. "
            f"Run: guardrails configure && guardrails hub install {hub_uri}. "
            f"Original error: {exc}"
        ) from exc


def _load_optional_validator(class_name: str):
    """Load an already-installed Hub validator or return None if missing."""
    try:
        from guardrails import hub as hub_mod
        return getattr(hub_mod, class_name)
    except Exception:
        return None


GuardrailsPII = _load_validator("GuardrailsPII", "hub://guardrails/guardrails_pii")
GibberishText = _load_validator("GibberishText", "hub://guardrails/gibberish_text")
ToxicLanguage = _load_validator("ToxicLanguage", "hub://guardrails/toxic_language")
NSFWText = _load_optional_validator("NSFWText")

# Initialize guards once (important for performance)

guard_pii = Guard().use(
    GuardrailsPII(
        entities=["DATE_TIME", "PHONE_NUMBER", "EMAIL_ADDRESS", "ADDRESS", "SSN"],
        on_fail="fix"
    )
)

guard_gibberish = Guard().use(
    GibberishText(threshold=0.3, on_fail="exception")
)

guard_toxic = Guard().use(
    ToxicLanguage(threshold=0.5, validation_method="sentence", on_fail="exception")
)

guard_nsfw = None
if NSFWText is not None:
    guard_nsfw = Guard().use(
        NSFWText(threshold=0.5, validation_method="sentence", on_fail="exception")
    )

def run_validation(guard, text):
    start = time.time()
    try:
        result = guard.validate(text)
        return {
            "status": "passed",
            "output": result.validated_output,
            "execution_time": round(time.time() - start, 4)
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
            "execution_time": round(time.time() - start, 4)
        }

"""Gemini estimate used only for the tutor-facing research comparison.

The score asks for the same quantity the trained model predicts (L2-ARCTIC
pronunciation accuracy, 0-100) so the two numbers are comparable. It is stored
in `ai_comparisons` and never feeds evaluations, final scores or pre/post.
"""

import base64
import json
import logging
import time

import httpx

from app.config import settings

log = logging.getLogger("kezspeak")

PROMPT = """You are assisting an English tutor at Kez Tutorial Service with a research comparison on an ESL learner's recorded speaking response.

Speaking task: "{task}"

Listen to the recording and respond in JSON with:
- "transcript": what the learner said, verbatim, including hesitations like "um".
- "score": your estimate of PRONUNCIATION ACCURACY from 0 to 100, defined as the percentage of phonemes the learner pronounced correctly (100 = every phoneme correct, 0 = none). Judge pronunciation only, not grammar, vocabulary or content.
- "summary": 2-3 sentences for the tutor on fluency, pronunciation, grammar and vocabulary.
- "strengths": 2-3 short, specific things the learner did well.
- "improvements": 2-3 short, specific, actionable suggestions.

Do not give a CEFR level or proficiency label. Refer to words the learner actually used. If the audio has no speech, set score to 0, say so in the summary, and leave the lists empty."""

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "transcript": {"type": "STRING"},
        "score": {"type": "NUMBER"},
        "summary": {"type": "STRING"},
        "strengths": {"type": "ARRAY", "items": {"type": "STRING"}},
        "improvements": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["transcript", "score", "summary", "strengths", "improvements"],
}


# Give up on a stalled model quickly and try the next one.
PER_MODEL_TIMEOUT = 40


class GeminiError(Exception):
    pass


def compare(audio: bytes, mime_type: str, task_prompt: str) -> dict:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not set in .env.local.")

    body = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT.format(task=task_prompt)},
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(audio).decode()}},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.2,
        },
    }
    # Try each configured model in order. Google retires models for new keys
    # (404) and sheds load (429/503), so fall through to the next one then.
    errors = []
    for model in settings.gemini_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        started = time.perf_counter()
        try:
            response = httpx.post(url, json=body, headers={"x-goog-api-key": settings.gemini_api_key}, timeout=PER_MODEL_TIMEOUT)
        except httpx.HTTPError as exc:
            errors.append(f"{model}: unreachable ({type(exc).__name__})")
            log.warning("Gemini %s gave no answer within %ds, trying next model", model, PER_MODEL_TIMEOUT)
            continue
        if response.status_code == 200:
            log.info("Gemini %s answered in %.1fs", model, time.perf_counter() - started)
            break
        log.warning("Gemini %s returned %d, trying next model", model, response.status_code)
        errors.append(f"{model}: {response.status_code} {response.text[:200]}")
        if response.status_code not in (404, 429, 500, 503):
            raise GeminiError("; ".join(errors))
    else:
        raise GeminiError("; ".join(errors) or "No Gemini model configured.")

    try:
        # Newer models may return thinking parts first; keep only the answer text.
        parts = response.json()["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError) as exc:
        raise GeminiError("Gemini returned no usable answer (possibly blocked by safety filters).") from exc

    def as_list(value) -> list[str]:
        return [str(item) for item in value][:5] if isinstance(value, list) else []

    try:
        score = min(100.0, max(0.0, float(parsed.get("score"))))
    except (TypeError, ValueError):
        score = None
    return {
        "provider": "gemini",
        "model": model,
        "ai_score": None if score is None else round(score, 2),
        "transcript": str(parsed.get("transcript", "")),
        "summary": str(parsed.get("summary", "")),
        "strengths": as_list(parsed.get("strengths")),
        "improvements": as_list(parsed.get("improvements")),
    }

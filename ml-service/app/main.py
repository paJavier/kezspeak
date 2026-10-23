"""KezSpeak ML service: speech-to-text, feature extraction and scoring.

Run from ml-service/:  .venv\\Scripts\\uvicorn app.main:app --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError

from app import admin, db, gemini
from app.auth import CurrentUser, get_current_user, require_api_key
from app.config import settings
from app.pipeline import audio, model, nlp, run, stt

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("kezspeak")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load heavy models once at startup so the first learner isn't kept waiting.
    try:
        model.load()
        log.info("Scoring model loaded (%s)", settings.model_version)
    except model.ModelNotReady as exc:
        log.warning("%s", exc)
    stt.get_model()
    nlp.warm_up()
    log.info("Whisper '%s' and NLP tools ready", settings.whisper_model)
    # Jobs don't survive a restart; without this they'd stay "transcribing"
    # forever and could never be retried.
    try:
        if count := db.fail_interrupted():
            log.warning("Marked %d interrupted submission(s) as failed (retryable)", count)
    except Exception as exc:
        log.warning("Could not check for interrupted submissions: %s", exc)
    yield
    nlp.shutdown()


app = FastAPI(title="KezSpeak ML service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": model.describe()}


def _authorize(submission_id: str, user: CurrentUser) -> dict:
    submission = db.get_submission(submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found.")
    is_owner = submission["learner_id"] == user.id
    if not is_owner and not user.is_staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot process this submission.")
    if not is_owner and user.role == "tutor" and not _tutor_has_learner(user.id, submission["learner_id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This learner is not assigned to you.")
    return submission


def _tutor_has_learner(tutor_id: str, learner_id: str) -> bool:
    result = (
        db.get_client()
        .table("assignments")
        .select("id")
        .eq("tutor_id", tutor_id)
        .eq("learner_id", learner_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


@app.post("/submissions/{submission_id}/process", status_code=status.HTTP_202_ACCEPTED)
def process(
    submission_id: str,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _authorize(submission_id, user)
    if not db.claim_submission(submission_id, ["pending"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission is already being processed.")
    background.add_task(run.process_submission, submission_id)
    return {"submission_id": submission_id, "status": "processing"}


@app.post("/evaluate", dependencies=[Depends(require_api_key)])
def evaluate(file: UploadFile = File(...)) -> dict:
    """Score an uploaded recording directly (server-to-server, API key required).

    Nothing is stored: the caller gets the transcript, features and machine
    estimate back. The browser flow uses /submissions/{id}/process instead.
    """
    # Read one byte past the limit so oversized uploads are rejected without
    # loading arbitrarily large files into memory.
    raw = file.file.read(settings.max_audio_bytes + 1)
    try:
        return run.evaluate_bytes(raw)
    except audio.AudioError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    except model.ModelNotReady:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The scoring model is not installed on the server.")


@app.post("/submissions/{submission_id}/ai-comparison")
def ai_comparison(submission_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Tutor/admin research aid: a Gemini estimate next to the trained model's.

    The Gemini score is stored in `ai_comparisons` only and never changes the
    evaluation, the final score or the pre/post comparison.
    """
    if not user.is_staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only tutors and admins can run AI comparisons.")
    submission = _authorize(submission_id, user)
    evaluation = db.get_evaluation(submission_id)
    if submission["status"] != "completed" or not evaluation:
        raise HTTPException(status.HTTP_409_CONFLICT, "Wait for the trained model's result before comparing.")

    try:
        existing = db.get_ai_comparison(submission_id)
    except APIError as exc:
        log.warning("ai_comparisons lookup failed: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AI comparison isn't set up yet: run migration 20261025_ai_comparisons.sql.",
        )
    # One Gemini call per recording keeps cost predictable.
    if existing:
        return existing

    raw = db.download_audio(submission["audio_path"])
    prompt = db.get_task_prompt(submission["task_id"]) or "Free speaking"
    try:
        result = gemini.compare(raw, submission.get("mime_type") or "audio/webm", prompt)
    except gemini.GeminiError as exc:
        log.warning("Gemini comparison failed for %s: %s", submission_id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Gemini is unavailable right now. Try again later.")

    return db.save_ai_comparison(
        {
            **result,
            "submission_id": submission_id,
            "model_score": evaluation["predicted_score"],
            "model_version": evaluation["model_version"],
            "requested_by": user.id,
        }
    )


@app.post("/submissions/{submission_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry(
    submission_id: str,
    background: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _authorize(submission_id, user)
    if not db.claim_submission(submission_id, ["failed"]):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only failed submissions can be retried.")
    background.add_task(run.process_submission, submission_id)
    return {"submission_id": submission_id, "status": "processing"}

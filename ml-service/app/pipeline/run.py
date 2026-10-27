"""Run audio through the full assessment pipeline.

Submissions move pending -> processing -> transcribing -> extracting_features
-> evaluating -> completed. Any failure marks the submission `failed` with a
readable error; the audio is left in storage so it can be retried without
re-recording.
"""

import logging
import threading
import time
from typing import Callable

from app import db
from app.config import settings
from app.pipeline import acoustic, audio, model, nlp, stt

log = logging.getLogger(__name__)

# Whisper and LanguageTool are heavy; one job at a time is enough for a
# prototype and keeps memory predictable.
_pipeline_lock = threading.Lock()


def _check_length(seconds: float, max_seconds: float) -> None:
    if seconds < settings.min_audio_seconds:
        raise audio.AudioError("The recording is too short to assess.")
    if seconds > max_seconds:
        raise audio.AudioError(f"The recording is longer than {int(max_seconds)} seconds.")


def analyze(raw: bytes, max_seconds: float, on_stage: Callable[[str], None] = lambda _stage: None) -> dict:
    """Decode, transcribe, extract features and score. Shared by /evaluate and submissions."""
    if len(raw) > settings.max_audio_bytes:
        raise audio.AudioError(f"The recording is larger than {settings.max_audio_bytes // (1024 * 1024)} MB.")

    started = time.perf_counter()
    y, sr = audio.decode_audio(raw)
    seconds = len(y) / sr
    _check_length(seconds, max_seconds)

    on_stage("transcribing")
    transcript = stt.transcribe(y)
    if not transcript:
        raise audio.AudioError("No speech was detected in the recording.")

    on_stage("extracting_features")
    acoustic_features = acoustic.add_speech_rate(acoustic.extract_audio_features(y, sr), transcript)
    nlp_features = nlp.extract_nlp_features(transcript)

    on_stage("evaluating")
    score = model.predict(acoustic_features)

    return {
        "duration_seconds": round(seconds, 2),
        "transcript": transcript,
        "acoustic_features": acoustic_features,
        "nlp_features": nlp_features,
        "predicted_score": round(score, 2),
        "model_version": settings.model_version,
        "feature_version": settings.feature_version,
        "processing_ms": int((time.perf_counter() - started) * 1000),
    }


def evaluate_bytes(raw: bytes) -> dict:
    with _pipeline_lock:
        return analyze(raw, settings.max_audio_seconds)


def process_submission(submission_id: str) -> None:
    with _pipeline_lock:
        started = time.perf_counter()
        try:
            submission = db.get_submission(submission_id)
            if submission is None:
                log.error("Submission %s disappeared before processing", submission_id)
                return

            task_limit = (submission.get("assessment_tasks") or {}).get("duration_seconds")
            max_seconds = min(settings.max_audio_seconds, (task_limit or settings.max_audio_seconds) + 15)
            raw = db.download_audio(submission["audio_path"])

            result = analyze(raw, max_seconds, on_stage=lambda stage: db.set_status(submission_id, stage))

            db.set_duration(submission_id, result.pop("duration_seconds"))
            result["processing_ms"] = int((time.perf_counter() - started) * 1000)
            db.save_evaluation({"submission_id": submission_id, **result})
            db.set_status(submission_id, "completed")
            log.info("Submission %s completed in %.1fs", submission_id, time.perf_counter() - started)

        except audio.AudioError as exc:
            db.set_status(submission_id, "failed", str(exc))
        except model.ModelNotReady as exc:
            log.error("%s", exc)
            db.set_status(submission_id, "failed", "The scoring model is not installed on the server.")
        except Exception:
            log.exception("Submission %s failed", submission_id)
            db.set_status(submission_id, "failed", "Processing failed on the server. It can be retried.")

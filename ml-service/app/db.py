"""Service-role Supabase access. This key bypasses RLS: never expose it to the browser."""

from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_submission(submission_id: str) -> dict | None:
    result = (
        get_client()
        .table("submissions")
        .select("*, assessment_tasks(duration_seconds)")
        .eq("id", submission_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None


def claim_submission(submission_id: str, from_statuses: list[str]) -> bool:
    """Atomically move a submission into processing so it only runs once."""
    result = (
        get_client()
        .table("submissions")
        .update({"status": "processing", "error": None})
        .eq("id", submission_id)
        .in_("status", from_statuses)
        .execute()
    )
    return bool(result.data)


IN_FLIGHT = ["processing", "transcribing", "extracting_features", "evaluating"]


def fail_interrupted() -> int:
    """Mark jobs left mid-pipeline by a restart as failed so they can be retried.

    Safe only while a single ml-service instance runs (true for this prototype).
    """
    result = (
        get_client()
        .table("submissions")
        .update({"status": "failed", "error": "Processing was interrupted by a server restart. It can be retried."})
        .in_("status", IN_FLIGHT)
        .execute()
    )
    return len(result.data or [])


def set_status(submission_id: str, status: str, error: str | None = None) -> None:
    get_client().table("submissions").update({"status": status, "error": error}).eq(
        "id", submission_id
    ).execute()


def set_duration(submission_id: str, seconds: float) -> None:
    get_client().table("submissions").update({"duration_seconds": round(seconds, 2)}).eq(
        "id", submission_id
    ).execute()


def download_audio(path: str) -> bytes:
    return get_client().storage.from_(settings.recordings_bucket).download(path)


def save_evaluation(row: dict) -> None:
    get_client().table("evaluations").upsert(row, on_conflict="submission_id").execute()


def get_evaluation(submission_id: str) -> dict | None:
    result = (
        get_client()
        .table("evaluations")
        .select("predicted_score, model_version")
        .eq("submission_id", submission_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None


def get_task_prompt(task_id: str) -> str | None:
    result = (
        get_client().table("assessment_tasks").select("prompt").eq("id", task_id).maybe_single().execute()
    )
    return result.data.get("prompt") if result and result.data else None


def get_ai_comparison(submission_id: str) -> dict | None:
    result = (
        get_client()
        .table("ai_comparisons")
        .select("*")
        .eq("submission_id", submission_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None


def save_ai_comparison(row: dict) -> dict:
    result = get_client().table("ai_comparisons").upsert(row, on_conflict="submission_id").execute()
    return result.data[0]


def get_role(user_id: str) -> str | None:
    result = (
        get_client().table("profiles").select("role").eq("id", user_id).maybe_single().execute()
    )
    return result.data.get("role") if result and result.data else None

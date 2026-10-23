import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_ROOT.parent

# All keys live in the repo's .env.local (gitignored). Real environment
# variables (e.g. on a deployment host) take precedence over the file.
load_dotenv(REPO_ROOT / ".env.local")


def _list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # Same project as the frontend, so reuse VITE_SUPABASE_URL unless overridden.
    supabase_url: str = os.getenv("SUPABASE_URL", os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    allowed_origins: list[str] = field(
        default_factory=lambda: _list(
            os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8443")
        )
    )

    # Shared secret for server-to-server calls to /evaluate. Empty = endpoint disabled.
    api_key: str = os.getenv("KEZSPEAK_API_KEY", "")

    recordings_bucket: str = os.getenv("RECORDINGS_BUCKET", "recordings")

    # Gemini, for the tutor-only research comparison (never feeds scores).
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    # Comma-separated, tried in order on 404/429/5xx or timeout. Keep fast
    # models only: gemini-3.8-flash took ~100 s. gemini-2.5-* is closed to new keys.
    gemini_models: list[str] = field(
        default_factory=lambda: _list(os.getenv("GEMINI_MODEL", "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest"))
    )

    whisper_model: str = os.getenv("WHISPER_MODEL", "small")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    model_path: Path = SERVICE_ROOT / os.getenv("MODEL_PATH", "model/kezspeak_production_xgboost.pkl")
    features_path: Path = SERVICE_ROOT / os.getenv(
        "FEATURES_PATH", "model/kezspeak_production_features.pkl"
    )
    model_version: str = os.getenv("MODEL_VERSION", "kezspeak-xgb-audio-v1")
    feature_version: str = os.getenv("FEATURE_VERSION", "audio40-nlp15-v1")

    # Grammar checks need Java + LanguageTool (~260 MB download on first use).
    enable_grammar: bool = os.getenv("ENABLE_GRAMMAR", "true").lower() == "true"

    max_audio_bytes: int = int(os.getenv("MAX_AUDIO_BYTES", str(10 * 1024 * 1024)))
    min_audio_seconds: float = 1.0
    max_audio_seconds: float = 300.0


settings = Settings()

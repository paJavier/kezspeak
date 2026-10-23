"""Score a local audio file with the full pipeline, without Supabase.

Usage (from ml-service/):
    .venv\\Scripts\\python scripts\\score_file.py path\\to\\recording.webm
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.pipeline import acoustic, audio, model, nlp, stt  # noqa: E402


def main(path: str) -> None:
    timings = {}
    start = time.perf_counter()
    y, sr = audio.decode_audio(Path(path).read_bytes())
    timings["decode_s"] = time.perf_counter() - start

    t = time.perf_counter()
    transcript = stt.transcribe(y)
    timings["transcribe_s"] = time.perf_counter() - t

    t = time.perf_counter()
    features = acoustic.add_speech_rate(acoustic.extract_audio_features(y, sr), transcript)
    nlp_features = nlp.extract_nlp_features(transcript)
    timings["features_s"] = time.perf_counter() - t

    try:
        score = model.predict(features)
    except model.ModelNotReady as exc:
        score = None
        print(f"[model not installed] {exc}\n")
    timings["total_s"] = time.perf_counter() - start

    print(
        json.dumps(
            {
                "duration_s": round(len(y) / sr, 2),
                "transcript": transcript,
                "predicted_score": None if score is None else round(score, 2),
                "acoustic_features": features,
                "nlp_features": nlp_features,
                "timings": {k: round(v, 2) for k, v in timings.items()},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

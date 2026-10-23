"""Speech-to-text with Whisper "small", the model used in the Colab notebook.

The notebook used openai-whisper; faster-whisper runs the same weights via
CTranslate2 and is several times faster on CPU. Greedy decoding with
temperature fallback mirrors openai-whisper's ``transcribe`` defaults.
"""

import threading

import numpy as np
from faster_whisper import WhisperModel

from app.config import settings

_model: WhisperModel | None = None
_lock = threading.Lock()


def get_model() -> WhisperModel:
    global _model
    with _lock:
        if _model is None:
            _model = WhisperModel(
                settings.whisper_model,
                device=settings.whisper_device,
                compute_type=settings.whisper_compute_type,
            )
    return _model


def transcribe(y: np.ndarray) -> str:
    segments, _info = get_model().transcribe(
        y,
        language="en",
        beam_size=1,
        temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
        condition_on_previous_text=True,
        vad_filter=False,
    )
    return "".join(segment.text for segment in segments).strip()

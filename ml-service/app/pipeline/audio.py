"""Decode uploaded recordings to the format the model was trained on.

Training used L2-ARCTIC at 16 kHz mono float32, and the notebook's inference
path loads files with ``librosa.load(path, sr=16000, mono=True)``. Browsers
upload webm/opus, which librosa cannot read without ffmpeg, so we decode with
PyAV (downmixing to mono float at the native rate) and then resample with
librosa, the same resampler ``librosa.load`` uses.
"""

import io

import av
import librosa
import numpy as np

TARGET_SR = 16000


class AudioError(ValueError):
    pass


def decode_audio(data: bytes) -> tuple[np.ndarray, int]:
    if not data:
        raise AudioError("The recording is empty.")

    try:
        with av.open(io.BytesIO(data)) as container:
            stream = next((s for s in container.streams if s.type == "audio"), None)
            if stream is None:
                raise AudioError("The file has no audio track.")

            native_sr = stream.codec_context.sample_rate
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=native_sr)
            chunks = []
            for frame in container.decode(stream):
                for out in resampler.resample(frame):
                    chunks.append(out.to_ndarray()[0])
            for out in resampler.resample(None):
                chunks.append(out.to_ndarray()[0])
    except AudioError:
        raise
    except Exception as exc:  # PyAV raises many codec-specific errors
        raise AudioError(f"Could not decode the recording: {exc}") from exc

    if not chunks:
        raise AudioError("The recording contains no audio frames.")

    y = np.concatenate(chunks).astype(np.float32)
    if native_sr != TARGET_SR:
        y = librosa.resample(y, orig_sr=native_sr, target_sr=TARGET_SR)

    return np.asarray(y, dtype=np.float32), TARGET_SR

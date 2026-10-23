"""The 40 acoustic features the production model was trained on.

Ported from ``extract_audio_features`` and ``extract_all_features`` in
SoftEng_Pre_Processing.ipynb (cells 87 and 89). Keep this file in lockstep
with the notebook: any change here changes what the model sees.
"""

import re

import librosa
import numpy as np
import parselmouth

# Exact order from the notebook (cell 156); also saved as
# kezspeak_production_features.pkl, which model.py checks against this.
AUDIO_FEATURES = [
    "duration",
    "energy_mean",
    "energy_std",
    "energy_max",
    "speech_duration",
    "silence_duration",
    "pause_count",
    "avg_pause",
    "max_pause",
    "pitch_mean",
    "pitch_std",
    "pitch_min",
    "pitch_max",
    *[f"mfcc_{i}_mean" for i in range(1, 14)],
    *[f"mfcc_{i}_std" for i in range(1, 14)],
    "speech_rate",
]

SILENCE_TOP_DB = 30
N_MFCC = 13

_WORD = re.compile(r"\b[a-zA-Z]+\b")


def count_words(text: str) -> int:
    # Training computed speech_rate from the regex word count in
    # extract_nlp_features, not from transcript.split() (which the notebook's
    # later inference helper used). Match training.
    return len(_WORD.findall(str(text).strip().lower()))


def extract_audio_features(y: np.ndarray, sr: int) -> dict:
    features: dict = {}

    duration = len(y) / sr
    features["duration"] = float(duration)

    rms = librosa.feature.rms(y=y)
    features["energy_mean"] = float(np.mean(rms))
    features["energy_std"] = float(np.std(rms))
    features["energy_max"] = float(np.max(rms))

    intervals = librosa.effects.split(y, top_db=SILENCE_TOP_DB)
    speech_duration = sum((end - start) / sr for start, end in intervals)
    silence_duration = max(0, duration - speech_duration)
    pause_durations = [
        (intervals[i + 1][0] - intervals[i][1]) / sr for i in range(len(intervals) - 1)
    ]

    features["speech_duration"] = float(speech_duration)
    features["silence_duration"] = float(silence_duration)
    features["pause_count"] = int(len(pause_durations))
    features["avg_pause"] = float(np.mean(pause_durations) if pause_durations else 0)
    features["max_pause"] = float(np.max(pause_durations) if pause_durations else 0)

    try:
        sound = parselmouth.Sound(y, sampling_frequency=sr)
        frequencies = sound.to_pitch().selected_array["frequency"]
        frequencies = frequencies[frequencies > 0]
        if len(frequencies) > 0:
            features["pitch_mean"] = float(np.mean(frequencies))
            features["pitch_std"] = float(np.std(frequencies))
            features["pitch_min"] = float(np.min(frequencies))
            features["pitch_max"] = float(np.max(frequencies))
        else:
            features.update(pitch_mean=0, pitch_std=0, pitch_min=0, pitch_max=0)
    except Exception:
        features.update(pitch_mean=0, pitch_std=0, pitch_min=0, pitch_max=0)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
    for i in range(N_MFCC):
        features[f"mfcc_{i + 1}_mean"] = float(np.mean(mfcc[i]))
        features[f"mfcc_{i + 1}_std"] = float(np.std(mfcc[i]))

    return features


def add_speech_rate(features: dict, transcript: str) -> dict:
    duration = features["duration"]
    word_count = count_words(transcript)
    features["speech_rate"] = word_count / duration * 60 if duration > 0 else 0
    return features

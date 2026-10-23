import io
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import soundfile as sf

from app.pipeline import acoustic, audio, nlp

FIXTURES = Path(__file__).parent / "fixtures"
SR = 16000


def tone_with_pause(seconds_on=1.0, pause=0.5, sr=SR):
    t = np.arange(int(seconds_on * sr)) / sr
    voiced = 0.3 * np.sin(2 * np.pi * 150 * t).astype(np.float32)
    silence = np.zeros(int(pause * sr), dtype=np.float32)
    return np.concatenate([voiced, silence, voiced])


def test_feature_names_and_order_match_training():
    assert len(acoustic.AUDIO_FEATURES) == 40
    y = tone_with_pause()
    features = acoustic.add_speech_rate(acoustic.extract_audio_features(y, SR), "hello there")
    assert set(features) == set(acoustic.AUDIO_FEATURES)


def test_pause_detection_finds_the_gap():
    features = acoustic.extract_audio_features(tone_with_pause(pause=0.5), SR)
    assert features["pause_count"] == 1
    assert features["avg_pause"] == pytest.approx(0.5, abs=0.15)
    assert features["duration"] == pytest.approx(2.5, abs=1e-6)


def test_speech_rate_uses_training_word_count():
    # Training counted words with r"\b[a-zA-Z]+\b", so "20th" is not a word.
    text = "for the 20th time that evening."
    assert acoustic.count_words(text) == 5
    assert len(text.split()) == 6  # the notebook's later inference helper got this wrong
    features = acoustic.add_speech_rate({"duration": 30.0}, "one two three")
    assert features["speech_rate"] == pytest.approx(6.0)


def test_nlp_features_have_all_columns():
    features = nlp.extract_nlp_features("I went to the beach. It was quiet and beautiful.")
    assert set(features) == set(nlp.NLP_FEATURES)
    assert features["word_count"] == 10
    assert features["sentence_count"] == 2


def test_mattr_matches_ttr_for_short_text():
    features = nlp.extract_nlp_features("the cat the dog")
    assert features["mattr"] == pytest.approx(features["ttr"]) == pytest.approx(0.75)


def test_decode_wav_resamples_to_16k_mono():
    stereo_44k = np.stack([tone_with_pause(sr=44100), tone_with_pause(sr=44100)], axis=1)
    buffer = io.BytesIO()
    sf.write(buffer, stereo_44k, 44100, format="WAV")
    y, sr = audio.decode_audio(buffer.getvalue())
    assert sr == SR
    assert y.ndim == 1
    assert len(y) / sr == pytest.approx(2.5, abs=0.01)


def test_decode_rejects_garbage():
    with pytest.raises(audio.AudioError):
        audio.decode_audio(b"not audio at all")


# ---------------------------------------------------------------------------
# Training/serving parity. Needs the L2-ARCTIC clip the notebook printed.
# Export it in Colab with:
#   sf.write("ABA_arctic_a0003.wav", ds["train"][0]["audio"]["array"], 16000)
# and copy it to ml-service/tests/fixtures/.
# ---------------------------------------------------------------------------

# Printed by SoftEng_Pre_Processing.ipynb, cells 36 and 95, for ds["train"][0].
NOTEBOOK_TRAIN_0 = {
    "duration": 4.92,
    "pause_count": 0,
    "energy_mean": 0.063210,
    "energy_std": 0.041696,
    "energy_max": 0.172709,
    "pitch_mean": 151.07131396420655,
    "pitch_std": 96.68632090895362,
    "pitch_min": 94.43087500293495,
    "pitch_max": 593.2076777789923,
    "mfcc_1_mean": -277.646240234375,
    "mfcc_1_std": 77.83295440673828,
    "mfcc_2_mean": 118.9297866821289,
    "mfcc_2_std": 40.99984359741211,
    "mfcc_6_mean": -7.650053024291992,
}


@pytest.mark.skipif(
    not (FIXTURES / "ABA_arctic_a0003.wav").exists(), reason="parity fixture not exported yet"
)
def test_parity_with_notebook_train_0():
    y, sr = sf.read(FIXTURES / "ABA_arctic_a0003.wav", dtype="float32")
    assert sr == SR
    features = acoustic.extract_audio_features(y, sr)
    for name, expected in NOTEBOOK_TRAIN_0.items():
        assert features[name] == pytest.approx(expected, rel=1e-3, abs=1e-4), name


@pytest.mark.skipif(
    not (FIXTURES / "parity.csv").exists(), reason="parity.csv not exported yet"
)
def test_parity_with_feature_csv_rows():
    """parity.csv: a few rows of kezspeak_l2_arctic_*_features.csv, with a
    matching {speaker_id}_{utterance_id}.wav for each row in fixtures/."""
    rows = pd.read_csv(FIXTURES / "parity.csv")
    checked = 0
    for _, row in rows.iterrows():
        wav = FIXTURES / f"{row['speaker_id']}_{row['utterance_id']}.wav"
        if not wav.exists():
            continue
        y, sr = sf.read(wav, dtype="float32")
        features = acoustic.add_speech_rate(
            acoustic.extract_audio_features(y, sr), row["transcript_whisper"]
        )
        for name in acoustic.AUDIO_FEATURES:
            assert features[name] == pytest.approx(row[name], rel=1e-3, abs=1e-4), (wav.name, name)
        checked += 1
    assert checked > 0, "parity.csv has no rows with a matching wav"

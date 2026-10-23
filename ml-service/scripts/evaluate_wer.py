"""Word Error Rate of the speech-to-text component (research question 1, target <= 15%).

Put pairs of files in one folder:  clip1.wav + clip1.txt (the reference transcript).
Any format PyAV can read works (wav, webm, mp3, m4a).

Usage (from ml-service/):
    .venv\\Scripts\\python scripts\\evaluate_wer.py path\\to\\folder [--csv out.csv]

Reports two numbers:
  raw        jiwer.wer on the strings as-is (what the Colab notebook computed)
  normalized lower-case, punctuation removed, digits kept as written. Closer to
             how WER is usually reported, but "20th" vs "twentieth" still counts.
"""

import argparse
import csv
import re
import sys
from pathlib import Path

import jiwer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.pipeline import audio, stt  # noqa: E402

AUDIO_EXTENSIONS = {".wav", ".webm", ".mp3", ".m4a", ".ogg", ".flac"}
TARGET_WER = 0.15


def normalize(text: str) -> str:
    text = re.sub(r"[^\w\s']", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--csv", type=Path, help="write per-file results here")
    args = parser.parse_args()

    clips = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in AUDIO_EXTENSIONS)
    references, hypotheses, rows = [], [], []

    for clip in clips:
        reference_file = clip.with_suffix(".txt")
        if not reference_file.exists():
            print(f"skip {clip.name}: no {reference_file.name}")
            continue
        reference = reference_file.read_text(encoding="utf-8").strip()
        y, _sr = audio.decode_audio(clip.read_bytes())
        hypothesis = stt.transcribe(y)

        references.append(reference)
        hypotheses.append(hypothesis)
        row = {
            "file": clip.name,
            "reference": reference,
            "hypothesis": hypothesis,
            "wer_raw": jiwer.wer(reference, hypothesis),
            "wer_normalized": jiwer.wer(normalize(reference), normalize(hypothesis)),
        }
        rows.append(row)
        print(f"{clip.name}: raw {row['wer_raw']:.3f}  normalized {row['wer_normalized']:.3f}")

    if not rows:
        sys.exit("No audio + .txt pairs found.")

    corpus_raw = jiwer.wer(references, hypotheses)
    corpus_norm = jiwer.wer([normalize(r) for r in references], [normalize(h) for h in hypotheses])
    print(f"\nClips: {len(rows)}")
    print(f"Corpus WER (raw):        {corpus_raw:.2%}")
    print(f"Corpus WER (normalized): {corpus_norm:.2%}")
    print(f"Target <= {TARGET_WER:.0%}: {'MET' if corpus_norm <= TARGET_WER else 'NOT MET'} (normalized)")

    if args.csv:
        with args.csv.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        print(f"Saved {args.csv}")


if __name__ == "__main__":
    main()

"""The 15 linguistic features from the notebook (``extract_nlp_features``, cell 88).

The deployed model is audio-only, so these are stored and shown to tutors as
descriptive measures; they do not change the predicted score.
"""

import logging
import re
import threading

import numpy as np
import spacy

from app.config import settings

log = logging.getLogger(__name__)

NLP_FEATURES = [
    "word_count",
    "unique_words",
    "ttr",
    "mattr",
    "sentence_count",
    "avg_sentence_length",
    "avg_dependency_depth",
    "noun_count",
    "verb_count",
    "adj_count",
    "adv_count",
    "pronoun_count",
    "prep_count",
    "conj_count",
    "grammar_errors",
]

MATTR_WINDOW = 10

_nlp = None
_grammar_tool = None
_grammar_unavailable = False
_lock = threading.Lock()


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _get_grammar_tool():
    global _grammar_tool, _grammar_unavailable
    if not settings.enable_grammar or _grammar_unavailable:
        return None
    with _lock:
        if _grammar_tool is None:
            try:
                import language_tool_python

                _grammar_tool = language_tool_python.LanguageTool("en-US")
            except Exception as exc:
                log.warning("LanguageTool unavailable, grammar_errors will be null: %s", exc)
                _grammar_unavailable = True
                return None
    return _grammar_tool


def warm_up() -> None:
    _get_nlp()
    _get_grammar_tool()


def shutdown() -> None:
    """Stop the LanguageTool Java server (~400-650 MB). Without this every
    service restart or test run leaves an orphaned java.exe behind."""
    global _grammar_tool
    with _lock:
        if _grammar_tool is not None:
            try:
                _grammar_tool.close()
            except Exception as exc:
                log.warning("Could not stop LanguageTool cleanly: %s", exc)
            _grammar_tool = None


def extract_nlp_features(text: str) -> dict:
    features: dict = {}
    text = str(text).strip()

    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    word_count = len(words)
    unique_words = len(set(words))

    features["word_count"] = word_count
    features["unique_words"] = unique_words
    features["ttr"] = unique_words / word_count if word_count > 0 else 0

    if word_count < MATTR_WINDOW:
        features["mattr"] = unique_words / word_count if word_count > 0 else 0
    else:
        scores = [
            len(set(words[i : i + MATTR_WINDOW])) / MATTR_WINDOW
            for i in range(word_count - MATTR_WINDOW + 1)
        ]
        features["mattr"] = float(np.mean(scores))

    doc = _get_nlp()(text)
    sentences = list(doc.sents)
    features["sentence_count"] = len(sentences)

    sentence_lengths = []
    dependency_depths = []
    pos_counts: dict[str, int] = {}

    for sentence in sentences:
        tokens = [token for token in sentence if not token.is_punct]
        sentence_lengths.append(len(tokens))
        for token in tokens:
            pos_counts[token.pos_] = pos_counts.get(token.pos_, 0) + 1
            depth = 0
            current = token
            while current.head != current:
                depth += 1
                current = current.head
            dependency_depths.append(depth)

    features["avg_sentence_length"] = float(np.mean(sentence_lengths)) if sentence_lengths else 0
    features["avg_dependency_depth"] = float(np.mean(dependency_depths)) if dependency_depths else 0

    features["noun_count"] = pos_counts.get("NOUN", 0)
    features["verb_count"] = pos_counts.get("VERB", 0)
    features["adj_count"] = pos_counts.get("ADJ", 0)
    features["adv_count"] = pos_counts.get("ADV", 0)
    features["pronoun_count"] = pos_counts.get("PRON", 0)
    features["prep_count"] = pos_counts.get("ADP", 0)
    features["conj_count"] = pos_counts.get("CCONJ", 0)

    # The notebook stored 0 when the check failed; we store None so the UI can
    # say "not available" instead of claiming zero errors.
    tool = _get_grammar_tool()
    if tool is None or not text:
        features["grammar_errors"] = None if tool is None else 0
    else:
        try:
            features["grammar_errors"] = len(tool.check(text))
        except Exception as exc:
            log.warning("Grammar check failed: %s", exc)
            features["grammar_errors"] = None

    return features

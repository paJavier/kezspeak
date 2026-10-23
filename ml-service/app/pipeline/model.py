"""Load the production XGBoost model exported from Colab and score features."""

import json

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from app.config import settings
from app.pipeline.acoustic import AUDIO_FEATURES


class ModelNotReady(RuntimeError):
    pass


_model = None
_feature_order: list[str] | None = None


def _load_model():
    path = settings.model_path
    json_path = path.with_suffix(".json")
    # A model saved with save_model(".json") loads across XGBoost versions;
    # the joblib pickle only loads reliably on the version that trained it.
    if json_path.exists():
        model = XGBRegressor()
        model.load_model(json_path)
        return model
    if path.exists():
        return joblib.load(path)
    raise ModelNotReady(
        f"Model file not found at {path}. Copy kezspeak_production_xgboost.pkl "
        "(or a .json export) from Google Drive into ml-service/model/."
    )


def _load_feature_order() -> list[str]:
    if settings.features_path.exists():
        order = list(joblib.load(settings.features_path))
    else:
        order = list(AUDIO_FEATURES)
    if order != AUDIO_FEATURES:
        raise ModelNotReady(
            "Feature order saved with the model does not match acoustic.py:\n"
            f"model:   {order}\nservice: {AUDIO_FEATURES}"
        )
    return order


def _base_score(model) -> float:
    config = json.loads(model.get_booster().save_config())
    raw = str(config["learner"]["learner_model_param"]["base_score"])
    return float(raw.strip("[]").split(",")[0])


def load() -> None:
    global _model, _feature_order
    _feature_order = _load_feature_order()
    candidate = _load_model()
    # Targets are 0-100 with a mean near 84. XGBoost 2.x reads a 3.x pickle's
    # base_score as the 0.5 default, which silently drags every score to 0.
    base = _base_score(candidate)
    if base < 10:
        raise ModelNotReady(
            f"Model base_score loaded as {base}, expected about 84. The model was saved with a newer "
            "XGBoost than is installed. Upgrade xgboost (see requirements.txt) or export the model "
            "from Colab with save_model('kezspeak_production_xgboost.json')."
        )
    _model = candidate


def is_loaded() -> bool:
    return _model is not None


def predict(features: dict) -> float:
    if _model is None or _feature_order is None:
        load()
    row = pd.DataFrame([features])[_feature_order]
    # Same cleaning as clean_ml_data() in the notebook.
    row = row.replace([np.inf, -np.inf], np.nan).fillna(0)
    prediction = float(_model.predict(row)[0])
    return float(np.clip(prediction, 0, 100))


def describe() -> dict:
    return {
        "loaded": is_loaded(),
        "model_version": settings.model_version,
        "feature_version": settings.feature_version,
        "features": len(AUDIO_FEATURES),
    }

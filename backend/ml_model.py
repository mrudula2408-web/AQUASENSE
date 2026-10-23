"""
AquaSense - ML Model Inference and Management
Loads trained scikit-learn models (RandomForestRegressor and GaussianNB)
and serves predictions and evaluation metrics.
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import joblib

SAVED_MODELS_DIR = Path(__file__).resolve().parent / "saved_models"
RF_MODEL_PATH = SAVED_MODELS_DIR / "rainfall_rf_regressor.joblib"
NB_MODEL_PATH = SAVED_MODELS_DIR / "rainfall_nb_classifier.joblib"
METADATA_PATH = SAVED_MODELS_DIR / "model_metadata.json"

_rf_model = None
_nb_model = None
_metadata = None

def load_models_if_needed():
    """Load models and metadata from disk if available."""
    global _rf_model, _nb_model, _metadata
    if _rf_model is not None and _nb_model is not None and _metadata is not None:
        return True

    if RF_MODEL_PATH.exists() and NB_MODEL_PATH.exists() and METADATA_PATH.exists():
        try:
            _rf_model = joblib.load(RF_MODEL_PATH)
            _nb_model = joblib.load(NB_MODEL_PATH)
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                _metadata = json.load(f)
            return True
        except Exception as e:
            print(f"[AquaSense ML] Error loading models: {e}")
            return False
    return False

# Initial attempt to load models
load_models_if_needed()

def are_models_loaded() -> bool:
    return load_models_if_needed()

def get_model_metrics() -> Dict[str, Any]:
    if not load_models_if_needed():
        return {
            "status": "not_trained",
            "message": "Models are not trained yet. Run train_models.py to train using official IMD data.",
            "regression": {},
            "classification": {},
            "feature_info": {},
            "dataset_info": {},
            "limitations": "No models available."
        }
    return {
        "status": "loaded",
        "regression": _metadata.get("regression", {}),
        "classification": _metadata.get("classification", {}),
        "thresholds": _metadata.get("thresholds", {}),
        "climatology_monthly_mean_mm": _metadata.get("climatology_monthly_mean_mm", {}),
        "train_samples": _metadata.get("train_samples"),
        "test_samples": _metadata.get("test_samples"),
        "train_period": _metadata.get("train_period"),
        "test_period": _metadata.get("test_period"),
        "dataset_source": _metadata.get("dataset_source"),
        "limitations": _metadata.get("limitations")
    }

def classify_rainfall(rainfall_mm: float) -> Dict[str, Any]:
    if rainfall_mm < 0:
        raise ValueError("Rainfall cannot be negative.")

    if not load_models_if_needed():
        # Fallback domain threshold if model not loaded
        dry_thresh = 10.0
        heavy_thresh = 90.0
    else:
        dry_thresh = _metadata.get("thresholds", {}).get("dry_threshold_mm", 6.6)
        heavy_thresh = _metadata.get("thresholds", {}).get("heavy_threshold_mm", 93.4)

    if rainfall_mm < dry_thresh:
        cat = "Dry"
        expl = f"Rainfall ({rainfall_mm:.1f} mm) is below the dry threshold ({dry_thresh:.1f} mm), indicating dry season conditions."
    elif rainfall_mm < heavy_thresh:
        cat = "Normal"
        expl = f"Rainfall ({rainfall_mm:.1f} mm) is within the normal seasonal range ({dry_thresh:.1f} mm to {heavy_thresh:.1f} mm)."
    else:
        cat = "Heavy"
        expl = f"Rainfall ({rainfall_mm:.1f} mm) meets or exceeds the heavy threshold ({heavy_thresh:.1f} mm), typical of peak monsoon events."

    return {
        "rainfall_mm": round(rainfall_mm, 2),
        "category": cat,
        "thresholds": {
            "dry": f"< {dry_thresh:.1f} mm",
            "normal": f"{dry_thresh:.1f} mm to {heavy_thresh:.1f} mm",
            "heavy": f">= {heavy_thresh:.1f} mm"
        },
        "explanation": expl
    }

def predict_rainfall(target_year: int, target_month: int) -> Dict[str, Any]:
    """
    Predict next-month or future month rainfall using RandomForestRegressor
    and GaussianNB classification.
    """
    if not (1 <= target_month <= 12):
        raise ValueError("Target month must be between 1 and 12.")
    if target_year < 2024 or target_year > 2035:
        raise ValueError(f"Target year {target_year} is outside supported prediction horizon (2024-2035).")

    if not load_models_if_needed():
        raise RuntimeError("Trained models not found. Please run train_models.py before predicting.")

    # Feature representation
    sin_m = float(np.sin(2 * np.pi * target_month / 12.0))
    cos_m = float(np.cos(2 * np.pi * target_month / 12.0))

    # Retrieve climatological seasonal mean for lags
    clim_means = _metadata.get("climatology_monthly_mean_mm", {})
    def get_clim(m):
        m_norm = ((m - 1) % 12) + 1
        return float(clim_means.get(str(m_norm), 50.0))

    # Construct lags based on prior calendar months climatology
    lag_1 = get_clim(target_month - 1)
    lag_2 = get_clim(target_month - 2)
    lag_3 = get_clim(target_month - 3)
    lag_12 = get_clim(target_month)
    rolling_3 = (lag_1 + lag_2 + lag_3) / 3.0

    features = np.array([[target_month, sin_m, cos_m, lag_1, lag_2, lag_3, lag_12, rolling_3]])

    # Model A: RandomForestRegressor prediction
    pred_val = float(_rf_model.predict(features)[0])
    pred_rainfall_mm = max(0.0, round(pred_val, 2))

    # Model B: GaussianNB classification
    pred_cat = str(_nb_model.predict(features)[0])

    # Month names
    import calendar
    month_name = calendar.month_name[target_month]
    target_date_str = f"{month_name} {target_year}"

    eval_mae = _metadata.get("regression", {}).get("mae_mm")
    eval_rmse = _metadata.get("regression", {}).get("rmse_mm")

    explanation = (
        f"For {target_date_str}, AquaSense's Random Forest Regressor predicts approximately "
        f"{pred_rainfall_mm:.1f} mm of rainfall. Based on historical Hyderabad distribution, "
        f"this falls into the '{pred_cat}' category. "
        f"This prediction reflects historical cyclical monsoon and seasonal transitions."
    )

    return {
        "target_year": target_year,
        "target_month": target_month,
        "target_date_str": target_date_str,
        "predicted_rainfall_mm": pred_rainfall_mm,
        "rainfall_category": pred_cat,
        "model_name": "RandomForestRegressor + GaussianNB",
        "evaluation_mae": eval_mae,
        "evaluation_rmse": eval_rmse,
        "explanation": explanation,
        "limitations": _metadata.get("limitations", "")
    }

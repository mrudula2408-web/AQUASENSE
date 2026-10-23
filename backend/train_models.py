"""
AquaSense - ML Training Pipeline
Trains:
1. RandomForestRegressor for monthly rainfall regression.
2. GaussianNB for rainfall classification (Dry, Normal, Heavy).
Uses real IMD historical observations with strict chronological train/test split.
"""

import os
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, classification_report
import joblib

DATA_PATH = Path(__file__).resolve().parent / "data" / "rainfall.csv"
SAVED_MODELS_DIR = Path(__file__).resolve().parent / "saved_models"

def prepare_monthly_dataset(csv_path: Path):
    """Aggregate daily observations to monthly rainfall and build lag features."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Rainfall data not found at {csv_path}. Run preprocess_data.py first.")

    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])
    df = df.dropna(subset=['rainfall_mm'])

    if len(df) < 365:
        raise ValueError(f"Insufficient daily records ({len(df)}). At least 1 year of daily data required.")

    # Resample to monthly total rainfall
    df = df.set_index('date')
    monthly_df = df['rainfall_mm'].resample('MS').sum().reset_index()
    monthly_df['year'] = monthly_df['date'].dt.year
    monthly_df['month'] = monthly_df['date'].dt.month
    monthly_df['year_month'] = monthly_df['date'].dt.strftime('%Y-%m')

    # Construct features strictly using past lags (no future leakage)
    monthly_df['sin_month'] = np.sin(2 * np.pi * monthly_df['month'] / 12.0)
    monthly_df['cos_month'] = np.cos(2 * np.pi * monthly_df['month'] / 12.0)
    monthly_df['lag_1'] = monthly_df['rainfall_mm'].shift(1)
    monthly_df['lag_2'] = monthly_df['rainfall_mm'].shift(2)
    monthly_df['lag_3'] = monthly_df['rainfall_mm'].shift(3)
    monthly_df['lag_12'] = monthly_df['rainfall_mm'].shift(12)
    monthly_df['rolling_3'] = monthly_df['rainfall_mm'].shift(1).rolling(3).mean()

    # Drop rows with NaN from lags
    feature_df = monthly_df.dropna().copy().reset_index(drop=True)
    return feature_df, monthly_df

def train_and_evaluate():
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 65)
    print("AquaSense: Machine Learning Training Pipeline")
    print("=" * 65)

    feature_df, monthly_df = prepare_monthly_dataset(DATA_PATH)
    print(f"Total monthly records: {len(monthly_df)} ({monthly_df['year_month'].min()} to {monthly_df['year_month'].max()})")
    print(f"Usable feature records after 12-month lag: {len(feature_df)}")

    # Features and Target
    feature_cols = ['month', 'sin_month', 'cos_month', 'lag_1', 'lag_2', 'lag_3', 'lag_12', 'rolling_3']
    X = feature_df[feature_cols].values
    y = feature_df['rainfall_mm'].values

    # Chronological Train / Test Split (80% train, 20% test)
    split_idx = int(len(feature_df) * 0.80)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    train_dates = (feature_df['year_month'].iloc[0], feature_df['year_month'].iloc[split_idx - 1])
    test_dates = (feature_df['year_month'].iloc[split_idx], feature_df['year_month'].iloc[-1])

    print(f"\nChronological Split:")
    print(f"  Training set: {len(X_train)} samples ({train_dates[0]} to {train_dates[1]})")
    print(f"  Test set:     {len(X_test)} samples ({test_dates[0]} to {test_dates[1]})")

    # Define Rainfall Category Thresholds based on training data quantiles
    q33 = float(np.percentile(y_train, 33.3))
    q66 = float(np.percentile(y_train, 66.6))
    print(f"\nCategory Thresholds (based on training distribution):")
    print(f"  Dry:    < {q33:.1f} mm")
    print(f"  Normal: {q33:.1f} mm to {q66:.1f} mm")
    print(f"  Heavy:  >= {q66:.1f} mm")

    def categorize(vals):
        cats = []
        for v in vals:
            if v < q33:
                cats.append("Dry")
            elif v < q66:
                cats.append("Normal")
            else:
                cats.append("Heavy")
        return np.array(cats)

    y_train_cat = categorize(y_train)
    y_test_cat = categorize(y_test)

    # -------------------------------------------------------------
    # Model A: RandomForestRegressor
    # -------------------------------------------------------------
    print("\n--- Training Model A: RandomForestRegressor ---")
    rf_regressor = RandomForestRegressor(
        n_estimators=100,
        max_depth=5,
        min_samples_split=4,
        random_state=42
    )
    rf_regressor.fit(X_train, y_train)

    y_pred_reg = rf_regressor.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred_reg))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_reg)))
    r2 = float(r2_score(y_test, y_pred_reg))

    print(f"Held-out Test Evaluation:")
    print(f"  MAE:  {mae:.2f} mm")
    print(f"  RMSE: {rmse:.2f} mm")
    print(f"  R²:   {r2:.3f}")

    # -------------------------------------------------------------
    # Model B: GaussianNB
    # -------------------------------------------------------------
    print("\n--- Training Model B: GaussianNB Classifier ---")
    nb_classifier = GaussianNB()
    nb_classifier.fit(X_train, y_train_cat)

    y_pred_cat = nb_classifier.predict(X_test)
    accuracy = float(accuracy_score(y_test_cat, y_pred_cat))
    report_dict = classification_report(y_test_cat, y_pred_cat, output_dict=True, zero_division=0)

    print(f"Held-out Test Evaluation:")
    print(f"  Classification Accuracy: {accuracy * 100:.2f}%")

    # Compute monthly climatological averages for forward forecasting lags
    monthly_clim = monthly_df.groupby('month')['rainfall_mm'].mean().to_dict()
    # Also get the most recent 12 months from the dataset
    recent_12 = monthly_df.tail(12)[['year_month', 'month', 'rainfall_mm']].to_dict(orient='records')

    # Save models and metadata
    rf_path = SAVED_MODELS_DIR / "rainfall_rf_regressor.joblib"
    nb_path = SAVED_MODELS_DIR / "rainfall_nb_classifier.joblib"
    meta_path = SAVED_MODELS_DIR / "model_metadata.json"

    joblib.dump(rf_regressor, rf_path)
    joblib.dump(nb_classifier, nb_path)

    metadata = {
        "status": "trained",
        "model_version": "1.0",
        "dataset_source": "Official IMD 0.25° Gridded Rainfall (Hyderabad: Lat 17.5° N, Lon 78.5° E)",
        "features": feature_cols,
        "split_ratio": "80/20 chronological",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "train_period": f"{train_dates[0]} to {train_dates[1]}",
        "test_period": f"{test_dates[0]} to {test_dates[1]}",
        "thresholds": {
            "dry_threshold_mm": round(q33, 2),
            "heavy_threshold_mm": round(q66, 2),
            "formula": "33.3rd and 66.6th percentiles of historical training distribution"
        },
        "regression": {
            "model": "RandomForestRegressor",
            "parameters": {"n_estimators": 100, "max_depth": 5, "random_state": 42},
            "mae_mm": round(mae, 2),
            "rmse_mm": round(rmse, 2),
            "r2_score": round(r2, 3),
            "test_actual_mean_mm": round(float(np.mean(y_test)), 2),
            "test_predicted_mean_mm": round(float(np.mean(y_pred_reg)), 2)
        },
        "classification": {
            "model": "GaussianNB",
            "classes": ["Dry", "Normal", "Heavy"],
            "accuracy": round(accuracy, 4),
            "report": report_dict
        },
        "climatology_monthly_mean_mm": {str(k): round(v, 2) for k, v in monthly_clim.items()},
        "recent_12_months": recent_12,
        "limitations": (
            "These ML models provide statistical forecasts based strictly on historical rainfall patterns, "
            "seasonal calendar indicators, and lagged observations. They do not simulate dynamic atmospheric "
            "physics, cloud thermodynamics, or satellite radar imagery. Predictions should be interpreted as "
            "climatological estimates for rainwater harvesting planning, not as official short-term weather forecasts."
        )
    }

    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[SUCCESS] Saved models to {SAVED_MODELS_DIR.resolve()}")
    print(f"[SUCCESS] Saved metrics metadata to {meta_path.name}")

if __name__ == "__main__":
    train_and_evaluate()

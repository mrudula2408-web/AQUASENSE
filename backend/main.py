"""
AquaSense - Smart Rainwater Harvesting and Groundwater Recharge System
FastAPI Backend Application
"""

import os
import io
import csv
import datetime
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np

import database
import schemas
import water_service
import ml_model

DATA_PATH = Path(__file__).resolve().parent / "data" / "rainfall.csv"

# In-memory cache for historical rainfall summary
_rainfall_cache = None

def get_rainfall_summary():
    global _rainfall_cache
    if _rainfall_cache is not None:
        return _rainfall_cache

    if not DATA_PATH.exists():
        return {
            "total_valid": 0,
            "total_missing": 0,
            "start_date": "N/A",
            "end_date": "N/A",
            "latest_date": "N/A",
            "latest_rainfall": 0.0,
            "monthly_chart": []
        }

    df = pd.read_csv(DATA_PATH)
    df['date'] = pd.to_datetime(df['date'])
    total_valid = int(df['rainfall_mm'].notna().sum())
    total_missing = int(df['rainfall_mm'].isna().sum())

    sorted_df = df.sort_values('date')
    start_date = sorted_df['date'].min().strftime('%Y-%m-%d')
    end_date = sorted_df['date'].max().strftime('%Y-%m-%d')
    latest_row = sorted_df.iloc[-1]
    latest_date = latest_row['date'].strftime('%Y-%m-%d')
    latest_rainfall = float(latest_row['rainfall_mm']) if pd.notna(latest_row['rainfall_mm']) else 0.0

    # Monthly aggregation for charts
    df_clean = df.dropna(subset=['rainfall_mm']).copy()
    df_clean['year_month'] = df_clean['date'].dt.strftime('%Y-%m')
    monthly = df_clean.groupby('year_month')['rainfall_mm'].sum().reset_index()
    monthly_chart = [
        {
            "month": row['year_month'],
            "rainfall_mm": round(float(row['rainfall_mm']), 2)
        }
        for _, row in monthly.iterrows()
    ]

    _rainfall_cache = {
        "total_valid": total_valid,
        "total_missing": total_missing,
        "start_date": start_date,
        "end_date": end_date,
        "latest_date": latest_date,
        "latest_rainfall": latest_rainfall,
        "monthly_chart": monthly_chart
    }
    return _rainfall_cache

@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    ml_model.load_models_if_needed()
    # Pre-cache rainfall summary
    get_rainfall_summary()
    yield

app = FastAPI(
    title="AquaSense API",
    description="Smart Rainwater Harvesting and Groundwater Recharge System API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=schemas.HealthResponse, tags=["System"])
def health_check():
    """Check system operational health, database connectivity, and ML model status."""
    db_ok = False
    try:
        conn = database.get_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception:
        db_ok = False

    models_loaded = ml_model.are_models_loaded()

    return schemas.HealthResponse(
        status="healthy" if db_ok else "degraded",
        message="AquaSense Backend is running smoothly.",
        version="1.0.0",
        database_status="connected" if db_ok else "error",
        models_loaded=models_loaded,
        timestamp=datetime.datetime.now().isoformat()
    )

@app.get("/api/dashboard", response_model=schemas.DashboardSummaryResponse, tags=["Dashboard"])
def get_dashboard_summary():
    """Retrieve full dashboard statistics, historical rainfall series, and recent operations."""
    summary = get_rainfall_summary()
    recent = database.get_recent_history(limit=5)
    counts = database.get_history_counts()

    return schemas.DashboardSummaryResponse(
        project_name="AquaSense",
        description="Smart Rainwater Harvesting and Groundwater Recharge Decision Support System",
        total_valid_observations=summary["total_valid"],
        total_missing_observations=summary["total_missing"],
        historical_start_date=summary["start_date"],
        historical_end_date=summary["end_date"],
        latest_observation_date=summary["latest_date"],
        latest_observation_rainfall_mm=summary["latest_rainfall"],
        selected_grid="17.5° N, 78.5° E (Hyderabad, Telangana)",
        data_source="India Meteorological Department (IMD) 0.25° Daily Gridded Rainfall Dataset",
        is_historical_notice="Notice: The observations displayed are historical daily observational data from IMD Pune, not live telemetry or forecasts.",
        monthly_chart_data=summary["monthly_chart"],
        recent_predictions=recent["predictions"],
        recent_calculations=recent["calculations"],
        recent_recommendations=recent["recommendations"],
        counts=counts
    )

@app.post("/api/predict/rainfall", response_model=schemas.RainfallPredictResponse, tags=["ML Prediction"])
def predict_rainfall_endpoint(payload: schemas.RainfallPredictRequest):
    """Predict next-month rainfall using Random Forest Regressor and GaussianNB classifier."""
    try:
        result = ml_model.predict_rainfall(payload.target_year, payload.target_month)
        saved_id = database.save_prediction(
            target_year=result["target_year"],
            target_month=result["target_month"],
            predicted_rainfall_mm=result["predicted_rainfall_mm"],
            rainfall_category=result["rainfall_category"],
            model_name=result["model_name"],
            notes=result["explanation"]
        )
        result["saved_id"] = saved_id
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Prediction failed: {e}")

@app.post("/api/predict/classify", response_model=schemas.RainfallClassifyResponse, tags=["ML Prediction"])
def classify_rainfall_endpoint(payload: schemas.RainfallClassifyRequest):
    """Classify monthly rainfall into Dry, Normal, or Heavy based on verified IMD training quantiles."""
    try:
        return ml_model.classify_rainfall(payload.rainfall_mm)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@app.get("/api/models/metrics", response_model=schemas.ModelMetricsResponse, tags=["ML Prediction"])
def get_metrics_endpoint():
    """Retrieve actual measured regression and classification metrics evaluated on held-out test data."""
    metrics = ml_model.get_model_metrics()
    return schemas.ModelMetricsResponse(
        status=metrics.get("status", "unknown"),
        regression=metrics.get("regression", {}),
        classification=metrics.get("classification", {}),
        feature_info={
            "features": ["month", "sin_month", "cos_month", "lag_1", "lag_2", "lag_3", "lag_12", "rolling_3"],
            "description": "Calendar seasonality, cyclical sine/cosine encoders, 1-3 month autoregressive lags, 12-month annual lag, and 3-month moving average."
        },
        dataset_info={
            "source": metrics.get("dataset_source", "IMD 0.25° Gridded Dataset"),
            "train_samples": metrics.get("train_samples", 0),
            "test_samples": metrics.get("test_samples", 0),
            "train_period": metrics.get("train_period", ""),
            "test_period": metrics.get("test_period", "")
        },
        limitations=metrics.get("limitations", "")
    )

@app.post("/api/water/calculate", response_model=schemas.WaterCalculateResponse, tags=["Hydrology"])
def calculate_water_endpoint(payload: schemas.WaterCalculateRequest):
    """Calculate harvestable rainwater volume from roof catchment, rainfall depth, and runoff coefficient."""
    try:
        result = water_service.calculate_harvestable_water(
            roof_area_sqm=payload.roof_area_sqm,
            rainfall_mm=payload.rainfall_mm,
            runoff_coefficient=payload.runoff_coefficient
        )
        saved_id = database.save_water_calculation(
            roof_area_sqm=result["roof_area_sqm"],
            rainfall_mm=result["rainfall_mm"],
            runoff_coefficient=result["runoff_coefficient"],
            harvestable_litres=result["harvestable_litres"],
            harvestable_kilolitres=result["harvestable_kilolitres"],
            notes=result["formula_used"]
        )
        result["saved_id"] = saved_id
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/api/tank/recommend", response_model=schemas.TankRecommendResponse, tags=["Hydrology"])
def recommend_tank_endpoint(payload: schemas.TankRecommendRequest):
    """Evaluate tank storage, potential overflow, and generate actionable management recommendation."""
    try:
        result = water_service.evaluate_tank_recommendation(
            tank_capacity_l=payload.tank_capacity_l,
            current_water_l=payload.current_water_l,
            expected_rainfall_mm=payload.expected_rainfall_mm,
            roof_area_sqm=payload.roof_area_sqm,
            daily_demand_l=payload.daily_demand_l,
            runoff_coefficient=payload.runoff_coefficient
        )
        saved_id = database.save_tank_recommendation(result)
        result["saved_id"] = saved_id
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/api/history", response_model=schemas.HistoryResponse, tags=["History"])
def get_history_endpoint(limit: int = Query(20, ge=1, le=100)):
    """Retrieve saved operational history for predictions, water calculations, and tank recommendations."""
    recent = database.get_recent_history(limit=limit)
    counts = database.get_history_counts()
    return schemas.HistoryResponse(
        predictions=recent["predictions"],
        calculations=recent["calculations"],
        recommendations=recent["recommendations"],
        counts=counts
    )

@app.get("/api/history/export", tags=["History"])
def export_history_csv():
    """Export all saved historical operations as a downloadable CSV file."""
    events = database.get_all_history_for_export()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Event Type", "Timestamp", "Primary Value", "Status / Category", "Details", "Notes"])
    for ev in events:
        writer.writerow([
            ev.get("id"),
            ev.get("type"),
            ev.get("created_at"),
            ev.get("primary_value"),
            ev.get("status_or_category"),
            ev.get("details"),
            ev.get("notes")
        ])

    csv_data = output.getvalue()
    filename = f"aquasense_history_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

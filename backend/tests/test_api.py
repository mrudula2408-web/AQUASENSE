"""
Integration tests for FastAPI endpoints using TestClient.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database_status"] == "connected"
    assert "models_loaded" in data

def test_dashboard_endpoint():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["project_name"] == "AquaSense"
    assert data["total_valid_observations"] > 0
    assert "17.5° N, 78.5° E" in data["selected_grid"]
    assert "monthly_chart_data" in data
    assert len(data["monthly_chart_data"]) > 0

def test_predict_rainfall_success():
    payload = {"target_year": 2026, "target_month": 7}
    response = client.post("/api/predict/rainfall", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["target_year"] == 2026
    assert data["target_month"] == 7
    assert data["predicted_rainfall_mm"] >= 0.0
    assert data["rainfall_category"] in ["Dry", "Normal", "Heavy"]
    assert data["saved_id"] is not None

def test_predict_rainfall_validation_error():
    # Invalid month 13
    response = client.post("/api/predict/rainfall", json={"target_year": 2026, "target_month": 13})
    assert response.status_code == 422

    # Unsupported year outside range (e.g. 2010)
    response2 = client.post("/api/predict/rainfall", json={"target_year": 2010, "target_month": 5})
    assert response2.status_code == 422

def test_classify_rainfall_endpoint():
    # Dry test
    resp_dry = client.post("/api/predict/classify", json={"rainfall_mm": 2.5})
    assert resp_dry.status_code == 200
    assert resp_dry.json()["category"] == "Dry"

    # Heavy test
    resp_heavy = client.post("/api/predict/classify", json={"rainfall_mm": 200.0})
    assert resp_heavy.status_code == 200
    assert resp_heavy.json()["category"] == "Heavy"

def test_model_metrics_endpoint():
    response = client.get("/api/models/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "loaded"
    assert "mae_mm" in data["regression"]
    assert "rmse_mm" in data["regression"]
    assert "accuracy" in data["classification"]

def test_water_calculate_endpoint():
    payload = {
        "roof_area_sqm": 120.0,
        "rainfall_mm": 50.0,
        "runoff_coefficient": 0.8
    }
    response = client.post("/api/water/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["harvestable_litres"] == 4800.0
    assert data["harvestable_kilolitres"] == 4.8
    assert data["saved_id"] is not None

def test_water_calculate_validation_failure():
    # Negative roof area
    response = client.post("/api/water/calculate", json={"roof_area_sqm": -10.0, "rainfall_mm": 50.0, "runoff_coefficient": 0.8})
    assert response.status_code == 422

def test_tank_recommend_endpoint():
    payload = {
        "tank_capacity_l": 5000.0,
        "current_water_l": 4500.0,
        "expected_rainfall_mm": 50.0,
        "roof_area_sqm": 150.0,
        "daily_demand_l": 500.0,
        "runoff_coefficient": 0.8
    }
    response = client.post("/api/tank/recommend", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["recommendation"] == "Recharge"
    assert data["overflow_l"] > 0
    assert data["saved_id"] is not None

def test_history_and_export_endpoints():
    hist_resp = client.get("/api/history?limit=10")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert "predictions" in hist_data
    assert "calculations" in hist_data
    assert "recommendations" in hist_data

    export_resp = client.get("/api/history/export")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "attachment; filename=aquasense_history_" in export_resp.headers["content-disposition"]
    content = export_resp.text
    assert "ID,Event Type,Timestamp,Primary Value" in content

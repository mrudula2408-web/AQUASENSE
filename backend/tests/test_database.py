"""
Unit tests for database initialisation and SQLite CRUD operations.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import database

def test_database_initialisation():
    database.init_db()
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    assert "rainfall_predictions" in tables
    assert "water_calculations" in tables
    assert "tank_recommendations" in tables

def test_save_and_retrieve_history():
    p_id = database.save_prediction(2025, 7, 185.5, "Heavy", "TestModel", "Monsoon test")
    assert p_id > 0

    c_id = database.save_water_calculation(150.0, 45.0, 0.8, 5400.0, 5.4, "Test calculation")
    assert c_id > 0

    r_id = database.save_tank_recommendation({
        "tank_capacity_l": 6000.0,
        "current_water_l": 3000.0,
        "expected_rainfall_mm": 25.0,
        "roof_area_sqm": 120.0,
        "daily_demand_l": 400.0,
        "runoff_coefficient": 0.8,
        "fill_percentage": 50.0,
        "available_storage_l": 3000.0,
        "incoming_water_l": 2400.0,
        "water_entering_tank_l": 2400.0,
        "overflow_l": 0.0,
        "days_of_supply": 13.5,
        "recommendation": "Store",
        "rationale": "Ample capacity available."
    })
    assert r_id > 0

    history = database.get_recent_history(limit=5)
    assert len(history["predictions"]) > 0
    assert len(history["calculations"]) > 0
    assert len(history["recommendations"]) > 0

    counts = database.get_history_counts()
    assert counts["total_operations"] >= 3

    export_rows = database.get_all_history_for_export()
    assert len(export_rows) >= 3
    assert any(r["type"] == "Rainfall Prediction" for r in export_rows)

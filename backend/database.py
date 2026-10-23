"""
AquaSense - Database Module
SQLite database initialisation, table management, and CRUD helpers.
"""

import sqlite3
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import datetime

DB_FILE = Path(__file__).resolve().parent / "aquasense.db"

def get_connection():
    """Create and return a connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialise database tables automatically."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Rainfall predictions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rainfall_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_year INTEGER NOT NULL,
        target_month INTEGER NOT NULL,
        predicted_rainfall_mm REAL NOT NULL,
        rainfall_category TEXT NOT NULL,
        model_name TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    # 2. Water calculations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS water_calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roof_area_sqm REAL NOT NULL,
        rainfall_mm REAL NOT NULL,
        runoff_coefficient REAL NOT NULL,
        harvestable_litres REAL NOT NULL,
        harvestable_kilolitres REAL NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    # 3. Tank recommendations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tank_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tank_capacity_l REAL NOT NULL,
        current_water_l REAL NOT NULL,
        expected_rainfall_mm REAL NOT NULL,
        roof_area_sqm REAL NOT NULL,
        daily_demand_l REAL NOT NULL,
        runoff_coefficient REAL NOT NULL,
        fill_percentage REAL NOT NULL,
        available_storage_l REAL NOT NULL,
        incoming_water_l REAL NOT NULL,
        water_entering_tank_l REAL NOT NULL,
        overflow_l REAL NOT NULL,
        days_of_supply REAL NOT NULL,
        recommendation TEXT NOT NULL,
        rationale TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    conn.commit()
    conn.close()

def save_prediction(target_year: int, target_month: int, predicted_rainfall_mm: float, rainfall_category: str, model_name: str = "RandomForest+GaussianNB", notes: str = "") -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO rainfall_predictions (target_year, target_month, predicted_rainfall_mm, rainfall_category, model_name, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (target_year, target_month, round(predicted_rainfall_mm, 2), rainfall_category, model_name, notes))
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id

def save_water_calculation(roof_area_sqm: float, rainfall_mm: float, runoff_coefficient: float, harvestable_litres: float, harvestable_kilolitres: float, notes: str = "") -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO water_calculations (roof_area_sqm, rainfall_mm, runoff_coefficient, harvestable_litres, harvestable_kilolitres, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (roof_area_sqm, rainfall_mm, runoff_coefficient, round(harvestable_litres, 2), round(harvestable_kilolitres, 3), notes))
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id

def save_tank_recommendation(data: Dict[str, Any]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tank_recommendations (
            tank_capacity_l, current_water_l, expected_rainfall_mm, roof_area_sqm,
            daily_demand_l, runoff_coefficient, fill_percentage, available_storage_l,
            incoming_water_l, water_entering_tank_l, overflow_l, days_of_supply,
            recommendation, rationale
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['tank_capacity_l'], data['current_water_l'], data['expected_rainfall_mm'],
        data['roof_area_sqm'], data['daily_demand_l'], data['runoff_coefficient'],
        round(data['fill_percentage'], 1), round(data['available_storage_l'], 2),
        round(data['incoming_water_l'], 2), round(data['water_entering_tank_l'], 2),
        round(data['overflow_l'], 2), round(data['days_of_supply'], 1),
        data['recommendation'], data['rationale']
    ))
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id

def get_recent_history(limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    """Retrieve recent records across all three operational tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rainfall_predictions ORDER BY id DESC LIMIT ?", (limit,))
    predictions = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM water_calculations ORDER BY id DESC LIMIT ?", (limit,))
    calculations = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM tank_recommendations ORDER BY id DESC LIMIT ?", (limit,))
    recommendations = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return {
        "predictions": predictions,
        "calculations": calculations,
        "recommendations": recommendations
    }

def get_history_counts() -> Dict[str, int]:
    """Retrieve total count of records in each table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM rainfall_predictions")
    p_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM water_calculations")
    c_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM tank_recommendations")
    r_count = cursor.fetchone()[0]
    conn.close()
    return {
        "predictions_count": p_count,
        "calculations_count": c_count,
        "recommendations_count": r_count,
        "total_operations": p_count + c_count + r_count
    }

def get_all_history_for_export() -> List[Dict[str, Any]]:
    """Export all events combined with timestamp and type for CSV generation."""
    conn = get_connection()
    cursor = conn.cursor()
    events = []

    cursor.execute("SELECT * FROM rainfall_predictions ORDER BY created_at DESC")
    for row in cursor.fetchall():
        d = dict(row)
        events.append({
            "type": "Rainfall Prediction",
            "id": d["id"],
            "created_at": d["created_at"],
            "details": f"Target: {d['target_year']}-{d['target_month']:02d}, Predicted: {d['predicted_rainfall_mm']} mm, Category: {d['rainfall_category']}",
            "primary_value": d["predicted_rainfall_mm"],
            "status_or_category": d["rainfall_category"],
            "notes": d.get("notes", "")
        })

    cursor.execute("SELECT * FROM water_calculations ORDER BY created_at DESC")
    for row in cursor.fetchall():
        d = dict(row)
        events.append({
            "type": "Water Calculation",
            "id": d["id"],
            "created_at": d["created_at"],
            "details": f"Roof: {d['roof_area_sqm']} m², Rain: {d['rainfall_mm']} mm, Harvestable: {d['harvestable_litres']} L ({d['harvestable_kilolitres']} kL)",
            "primary_value": d["harvestable_litres"],
            "status_or_category": f"{d['harvestable_kilolitres']} kL",
            "notes": d.get("notes", "")
        })

    cursor.execute("SELECT * FROM tank_recommendations ORDER BY created_at DESC")
    for row in cursor.fetchall():
        d = dict(row)
        events.append({
            "type": "Tank Recommendation",
            "id": d["id"],
            "created_at": d["created_at"],
            "details": f"Capacity: {d['tank_capacity_l']} L, Fill: {d['fill_percentage']}%, Rec: {d['recommendation']}, Supply: {d['days_of_supply']} days, Overflow: {d['overflow_l']} L",
            "primary_value": d["water_entering_tank_l"],
            "status_or_category": d["recommendation"],
            "notes": d.get("rationale", "")
        })

    conn.close()
    # Sort descending by timestamp
    events.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return events

# Ensure DB initialised on import
init_db()

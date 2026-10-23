"""
Unit tests for water calculation and tank recommendation services.
"""

import pytest
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import water_service

def test_water_harvesting_calculation():
    # 100 m² * 50 mm * 0.8 = 4000 L = 4.0 kL
    res = water_service.calculate_harvestable_water(100.0, 50.0, 0.8)
    assert res["harvestable_litres"] == 4000.0
    assert res["harvestable_kilolitres"] == 4.0
    assert "4,000.0 Litres" in res["formula_used"]

def test_water_harvesting_validation():
    with pytest.raises(ValueError, match="Roof area must be greater than zero"):
        water_service.calculate_harvestable_water(0.0, 50.0, 0.8)

    with pytest.raises(ValueError, match="Rainfall cannot be negative"):
        water_service.calculate_harvestable_water(100.0, -10.0, 0.8)

    with pytest.raises(ValueError, match="Runoff coefficient must be between"):
        water_service.calculate_harvestable_water(100.0, 50.0, 1.5)

def test_tank_recommendation_store():
    # Large tank with low fill and good rain -> should Store
    res = water_service.evaluate_tank_recommendation(
        tank_capacity_l=10000.0,
        current_water_l=2000.0,
        expected_rainfall_mm=30.0,
        roof_area_sqm=100.0,
        daily_demand_l=500.0,
        runoff_coefficient=0.8
    )
    assert res["fill_percentage"] == 20.0
    assert res["available_storage_l"] == 8000.0
    assert res["incoming_water_l"] == 2400.0
    assert res["overflow_l"] == 0.0
    assert res["recommendation"] == "Store"

def test_tank_recommendation_recharge_on_overflow():
    # Nearly full tank with high expected rain -> should Recharge
    res = water_service.evaluate_tank_recommendation(
        tank_capacity_l=5000.0,
        current_water_l=4800.0,
        expected_rainfall_mm=60.0,
        roof_area_sqm=120.0,
        daily_demand_l=400.0,
        runoff_coefficient=0.8
    )
    # Incoming = 120 * 60 * 0.8 = 5760 L
    # Available = 200 L -> Overflow = 5560 L
    assert res["available_storage_l"] == 200.0
    assert res["incoming_water_l"] == 5760.0
    assert res["overflow_l"] == 5560.0
    assert res["recommendation"] == "Recharge"
    assert "recharge" in res["rationale"].lower()

def test_tank_recommendation_conserve():
    # Low water and negligible rain -> should Conserve
    res = water_service.evaluate_tank_recommendation(
        tank_capacity_l=5000.0,
        current_water_l=500.0,
        expected_rainfall_mm=2.0,
        roof_area_sqm=80.0,
        daily_demand_l=300.0,
        runoff_coefficient=0.8
    )
    assert res["fill_percentage"] == 10.0
    assert res["recommendation"] == "Conserve"
    assert "conserve" in res["rationale"].lower()

def test_tank_recommendation_validation():
    with pytest.raises(ValueError):
        water_service.evaluate_tank_recommendation(0, 100, 10, 50, 100)
    with pytest.raises(ValueError):
        water_service.evaluate_tank_recommendation(5000, 100, -5, 50, 100)

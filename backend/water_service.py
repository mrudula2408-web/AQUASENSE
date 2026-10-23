"""
AquaSense - Water Calculator and Tank Management Service
Deterministic hydrology calculations and transparent rule-based tank recommendations.
"""

from typing import Dict, Any

def calculate_harvestable_water(roof_area_sqm: float, rainfall_mm: float, runoff_coefficient: float = 0.8) -> Dict[str, Any]:
    """
    Calculate harvestable rainwater volume.
    Formula: Harvestable Water (L) = Roof Area (m²) × Rainfall (mm) × Runoff Coefficient
    Note: 1 mm depth over 1 m² = 1 Litre of liquid.
    """
    if roof_area_sqm <= 0:
        raise ValueError("Roof area must be greater than zero.")
    if rainfall_mm < 0:
        raise ValueError("Rainfall cannot be negative.")
    if not (0.0 < runoff_coefficient <= 1.0):
        raise ValueError("Runoff coefficient must be between 0.0 and 1.0.")

    litres = roof_area_sqm * rainfall_mm * runoff_coefficient
    kilolitres = litres / 1000.0

    formula_str = f"{roof_area_sqm} m² × {rainfall_mm} mm × {runoff_coefficient} = {litres:,.1f} Litres"
    explanation = (
        f"1 mm of rainfall deposited over 1 m² equals exactly 1 litre of rainwater. "
        f"With a roof catchment of {roof_area_sqm} m² and {rainfall_mm} mm of precipitation, "
        f"a total of {litres:,.1f} litres ({kilolitres:,.2f} kL) can be collected after applying "
        f"the surface runoff coefficient of {runoff_coefficient} to account for roof material retention and initial abstraction."
    )

    return {
        "roof_area_sqm": roof_area_sqm,
        "rainfall_mm": rainfall_mm,
        "runoff_coefficient": runoff_coefficient,
        "harvestable_litres": round(litres, 2),
        "harvestable_kilolitres": round(kilolitres, 3),
        "formula_used": formula_str,
        "explanation": explanation
    }

def evaluate_tank_recommendation(
    tank_capacity_l: float,
    current_water_l: float,
    expected_rainfall_mm: float,
    roof_area_sqm: float,
    daily_demand_l: float,
    runoff_coefficient: float = 0.8
) -> Dict[str, Any]:
    """
    Evaluate tank capacity, incoming rainwater, potential overflow,
    and generate rule-based operational recommendation (Store, Use, Recharge, Conserve).
    """
    if tank_capacity_l <= 0:
        raise ValueError("Tank capacity must be greater than zero.")
    if current_water_l < 0:
        raise ValueError("Current stored water cannot be negative.")
    if current_water_l > tank_capacity_l:
        current_water_l = tank_capacity_l  # Cap at max capacity if overfilled
    if expected_rainfall_mm < 0:
        raise ValueError("Expected rainfall cannot be negative.")
    if roof_area_sqm <= 0:
        raise ValueError("Roof area must be greater than zero.")
    if daily_demand_l <= 0:
        raise ValueError("Daily water demand must be greater than zero.")
    if not (0.0 < runoff_coefficient <= 1.0):
        raise ValueError("Runoff coefficient must be between 0.0 and 1.0.")

    fill_percentage = (current_water_l / tank_capacity_l) * 100.0
    available_storage_l = max(0.0, tank_capacity_l - current_water_l)

    # Hydrologic incoming harvestable volume
    incoming_water_l = roof_area_sqm * expected_rainfall_mm * runoff_coefficient

    # Water that physically fits inside the storage tank
    water_entering_tank_l = min(available_storage_l, incoming_water_l)

    # Overflow volume exceeding remaining tank space
    overflow_l = max(0.0, incoming_water_l - available_storage_l)

    projected_stored_water_l = current_water_l + water_entering_tank_l
    days_of_supply = projected_stored_water_l / daily_demand_l if daily_demand_l > 0 else 0.0

    # Rule-based decision logic
    recommendation = ""
    rationale = ""

    if overflow_l > 0.1 * tank_capacity_l or (fill_percentage >= 85.0 and incoming_water_l > 100):
        recommendation = "Recharge"
        rationale = (
            f"The tank is at {fill_percentage:.1f}% capacity with only {available_storage_l:,.0f} L of headroom. "
            f"Expected rainfall will generate {incoming_water_l:,.0f} L, resulting in {overflow_l:,.0f} L of surplus overflow. "
            f"Reroute overflow directly to a groundwater recharge pit or percolation shaft to replenish local aquifers."
        )
    elif fill_percentage < 30.0 and expected_rainfall_mm < 10.0:
        recommendation = "Conserve"
        rationale = (
            f"Conserve water reserves: Tank storage is critically low at {fill_percentage:.1f}% ({current_water_l:,.0f} L) "
            f"and upcoming rainfall is minimal ({expected_rainfall_mm} mm). Projected supply covers only {days_of_supply:.1f} days. "
            f"Restrict non-essential water usage and maintain emergency reserves until higher rainfall is observed."
        )
    elif fill_percentage >= 70.0 and available_storage_l < incoming_water_l:
        recommendation = "Use"
        rationale = (
            f"Tank is well-stocked at {fill_percentage:.1f}% capacity. Substantial rain ({expected_rainfall_mm} mm) is expected. "
            f"Utilise {current_water_l * 0.2:,.0f} L for domestic non-potable needs (gardening, cleaning) prior to the rain event "
            f"to create tank buffer and prevent avoidable overflow."
        )
    else:
        recommendation = "Store"
        rationale = (
            f"Tank has adequate capacity ({available_storage_l:,.0f} L available; {fill_percentage:.1f}% full). "
            f"All incoming rainwater ({incoming_water_l:,.0f} L) can be comfortably captured. "
            f"Keep intake filters clear and store the fresh harvest to extend domestic supply to {days_of_supply:.1f} days."
        )

    return {
        "tank_capacity_l": tank_capacity_l,
        "current_water_l": current_water_l,
        "expected_rainfall_mm": expected_rainfall_mm,
        "roof_area_sqm": roof_area_sqm,
        "daily_demand_l": daily_demand_l,
        "runoff_coefficient": runoff_coefficient,
        "fill_percentage": round(fill_percentage, 1),
        "available_storage_l": round(available_storage_l, 2),
        "incoming_water_l": round(incoming_water_l, 2),
        "water_entering_tank_l": round(water_entering_tank_l, 2),
        "overflow_l": round(overflow_l, 2),
        "days_of_supply": round(days_of_supply, 1),
        "recommendation": recommendation,
        "rationale": rationale
    }

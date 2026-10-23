"""
AquaSense - Pydantic Request & Response Schemas
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class HealthResponse(BaseModel):
    status: str
    message: str
    version: str
    database_status: str
    models_loaded: bool
    timestamp: str

class HistoricalRainfallPoint(BaseModel):
    month_str: str
    year: int
    month: int
    rainfall_mm: float

class DashboardSummaryResponse(BaseModel):
    project_name: str
    description: str
    total_valid_observations: int
    total_missing_observations: int
    historical_start_date: str
    historical_end_date: str
    latest_observation_date: str
    latest_observation_rainfall_mm: float
    selected_grid: str
    data_source: str
    is_historical_notice: str
    monthly_chart_data: List[Dict[str, Any]]
    recent_predictions: List[Dict[str, Any]]
    recent_calculations: List[Dict[str, Any]]
    recent_recommendations: List[Dict[str, Any]]
    counts: Dict[str, int]

class RainfallPredictRequest(BaseModel):
    target_year: int = Field(..., ge=2024, le=2035, description="Forecast target year")
    target_month: int = Field(..., ge=1, le=12, description="Forecast target month (1-12)")

class RainfallPredictResponse(BaseModel):
    target_year: int
    target_month: int
    target_date_str: str
    predicted_rainfall_mm: float
    rainfall_category: str
    model_name: str
    evaluation_mae: Optional[float] = None
    evaluation_rmse: Optional[float] = None
    explanation: str
    limitations: str
    saved_id: Optional[int] = None

class RainfallClassifyRequest(BaseModel):
    rainfall_mm: float = Field(..., ge=0.0, description="Monthly rainfall in mm to classify")

class RainfallClassifyResponse(BaseModel):
    rainfall_mm: float
    category: str
    thresholds: Dict[str, str]
    explanation: str

class ModelMetricsResponse(BaseModel):
    status: str
    regression: Dict[str, Any]
    classification: Dict[str, Any]
    feature_info: Dict[str, Any]
    dataset_info: Dict[str, Any]
    limitations: str

class WaterCalculateRequest(BaseModel):
    roof_area_sqm: float = Field(..., gt=0.0, le=100000.0, description="Roof area in square metres")
    rainfall_mm: float = Field(..., ge=0.0, le=5000.0, description="Rainfall depth in millimetres")
    runoff_coefficient: float = Field(0.8, gt=0.0, le=1.0, description="Runoff coefficient (default 0.8)")

class WaterCalculateResponse(BaseModel):
    roof_area_sqm: float
    rainfall_mm: float
    runoff_coefficient: float
    harvestable_litres: float
    harvestable_kilolitres: float
    formula_used: str
    explanation: str
    saved_id: Optional[int] = None

class TankRecommendRequest(BaseModel):
    tank_capacity_l: float = Field(..., gt=0.0, le=10000000.0, description="Total tank capacity in litres")
    current_water_l: float = Field(..., ge=0.0, description="Current stored water in litres")
    expected_rainfall_mm: float = Field(..., ge=0.0, le=5000.0, description="Expected rainfall in mm")
    roof_area_sqm: float = Field(..., gt=0.0, le=100000.0, description="Roof catchment area in sqm")
    daily_demand_l: float = Field(..., gt=0.0, le=500000.0, description="Daily household water demand in litres")
    runoff_coefficient: float = Field(0.8, gt=0.0, le=1.0, description="Catchment runoff coefficient")

class TankRecommendResponse(BaseModel):
    tank_capacity_l: float
    current_water_l: float
    fill_percentage: float
    available_storage_l: float
    incoming_water_l: float
    water_entering_tank_l: float
    overflow_l: float
    daily_demand_l: float
    days_of_supply: float
    recommendation: str
    rationale: str
    saved_id: Optional[int] = None

class HistoryResponse(BaseModel):
    predictions: List[Dict[str, Any]]
    calculations: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    counts: Dict[str, int]

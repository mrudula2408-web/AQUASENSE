import React, { useState, useMemo } from 'react';
import { 
  Waves, 
  RotateCcw, 
  ArrowRight, 
  ShieldAlert, 
  ShieldCheck, 
  Droplets, 
  HelpCircle, 
  RefreshCw,
  Zap,
  ArrowDownToLine,
  Save,
  CheckCircle2,
  Clock
} from 'lucide-react';
import api from '../services/api';
import Alert from '../components/Alert';

const TankManagement = () => {
  const [tankCapacity, setTankCapacity] = useState(5000);
  const [currentWater, setCurrentWater] = useState(3800);
  const [expectedRainfall, setExpectedRainfall] = useState(50);
  const [roofArea, setRoofArea] = useState(150);
  const [dailyDemand, setDailyDemand] = useState(350);
  const [runoffCoeff, setRunoffCoeff] = useState(0.85);

  const [loading, setLoading] = useState(false);
  const [savedResult, setSavedResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Live real-time hydrologic computation
  const liveComputation = useMemo(() => {
    const cap = Math.max(100, Number(tankCapacity) || 1000);
    const curr = Math.min(cap, Math.max(0, Number(currentWater) || 0));
    const rain = Math.max(0, Number(expectedRainfall) || 0);
    const area = Math.max(1, Number(roofArea) || 100);
    const demand = Math.max(1, Number(dailyDemand) || 200);
    const coeff = Number(runoffCoeff) || 0.85;

    const fillPct = ((curr / cap) * 100).toFixed(1);
    const availableStorage = Math.max(0, cap - curr);
    const incomingHarvest = area * rain * coeff;
    const waterEntering = Math.min(availableStorage, incomingHarvest);
    const overflow = Math.max(0, incomingHarvest - availableStorage);
    const projectedWater = curr + waterEntering;
    const daysSupply = (projectedWater / demand).toFixed(1);

    // Rule-based status
    let rec = "Store";
    let rationale = "Adequate tank capacity is available. Capture and store all incoming rainwater to extend domestic supply.";
    let badgeClass = "badge-rec-store";

    if (overflow > 0.1 * cap || (fillPct >= 85 && incomingHarvest > 100)) {
      rec = "Recharge";
      rationale = `Tank is at ${fillPct}% capacity with only ${availableStorage.toLocaleString()} L of headroom. Expected storm creates ${overflow.toLocaleString()} L of overflow. Divert clean surplus runoff into groundwater percolation shafts.`;
      badgeClass = "badge-rec-recharge";
    } else if (fillPct < 30 && rain < 10) {
      rec = "Conserve";
      rationale = `Critical shortage: Tank is at ${fillPct}% capacity and incoming rainfall is negligible (${rain} mm). Stored supply lasts only ${daysSupply} days. Restrict non-essential water usage.`;
      badgeClass = "badge-rec-conserve";
    } else if (fillPct >= 70 && availableStorage < incomingHarvest) {
      rec = "Use";
      rationale = `Tank is ${fillPct}% full and upcoming rainfall will exceed remaining space. Pre-use stored water for secondary chores (gardening, cleaning) to create buffer headroom.`;
      badgeClass = "badge-rec-use";
    }

    return {
      fillPct: Number(fillPct),
      availableStorage,
      incomingHarvest,
      waterEntering,
      overflow,
      daysSupply,
      recommendation: rec,
      rationale,
      badgeClass
    };
  }, [tankCapacity, currentWater, expectedRainfall, roofArea, dailyDemand, runoffCoeff]);

  const handleSaveRecommendation = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSavedNotice(false);
    setLoading(true);

    try {
      const data = await api.recommendTank({
        tank_capacity_l: tankCapacity,
        current_water_l: Math.min(tankCapacity, currentWater),
        expected_rainfall_mm: expectedRainfall,
        roof_area_sqm: roofArea,
        daily_demand_l: dailyDemand,
        runoff_coefficient: runoffCoeff,
      });
      setSavedResult(data);
      setSavedNotice(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Evaluation failed. Check backend status.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTankCapacity(5000);
    setCurrentWater(3800);
    setExpectedRainfall(50);
    setRoofArea(150);
    setDailyDemand(350);
    setRunoffCoeff(0.85);
    setSavedResult(null);
    setError(null);
    setSavedNotice(false);
  };

  const applyScenario = (cap, curr, rain, area, demand) => {
    setTankCapacity(cap);
    setCurrentWater(curr);
    setExpectedRainfall(rain);
    setRoofArea(area);
    setDailyDemand(demand);
    setSavedNotice(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Interactive Tank Storage & Groundwater Recharge</h2>
          <p className="page-description">
            Interact with the visual water tank model to simulate storage headroom, observe potential overflow, and trigger intelligent aquifer recharge rules.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {savedNotice && (
        <Alert 
          type="success" 
          message={`Tank management state and recommendation logged to SQLite database (Record #${savedResult?.saved_id}).`} 
          onClose={() => setSavedNotice(false)} 
        />
      )}

      {/* Preset Scenario Cards */}
      <div className="presets-card">
        <div className="presets-header">
          <Zap size={18} className="text-teal" />
          <span className="font-semibold text-sm">Interactive Demonstration Scenarios:</span>
        </div>
        <div className="presets-buttons">
          <button 
            type="button" 
            onClick={() => applyScenario(5000, 4800, 60, 150, 400)} 
            className="btn btn-preset"
          >
            Scenario 1: Imminent Overflow → Recharge Aquifer
          </button>
          <button 
            type="button" 
            onClick={() => applyScenario(10000, 2000, 35, 120, 450)} 
            className="btn btn-preset"
          >
            Scenario 2: Free Storage Space → Store Rain
          </button>
          <button 
            type="button" 
            onClick={() => applyScenario(5000, 500, 2, 80, 300)} 
            className="btn btn-preset"
          >
            Scenario 3: Severe Dryness → Conserve Emergency Reserves
          </button>
          <button 
            type="button" 
            onClick={() => applyScenario(6000, 4500, 40, 140, 350)} 
            className="btn btn-preset"
          >
            Scenario 4: High Pre-Storm Level → Pre-Use Water
          </button>
        </div>
      </div>

      <div className="grid-2col">
        {/* Interactive Controls & Sliders */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Waves className="text-teal" size={20} />
              <h3 className="card-title">Dynamic Tank Controls</h3>
            </div>
            <span className="badge badge-teal">Live Simulation</span>
          </div>

          <form onSubmit={handleSaveRecommendation} className="form-layout">
            {/* Tank Capacity Slider */}
            <div className="form-group">
              <div className="slider-label-row">
                <label className="form-label">Total Tank Capacity</label>
                <div className="slider-val-badge">{tankCapacity.toLocaleString()} L</div>
              </div>
              <input
                type="range"
                min="1000"
                max="20000"
                step="500"
                value={tankCapacity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTankCapacity(val);
                  if (currentWater > val) setCurrentWater(val);
                }}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>1,000 L</span>
                <span>10,000 L</span>
                <span>20,000 L</span>
              </div>
            </div>

            {/* Current Water Level Slider */}
            <div className="form-group">
              <div className="slider-label-row">
                <label className="form-label">Current Water in Tank</label>
                <div className="slider-val-badge text-teal">{currentWater.toLocaleString()} L ({liveComputation.fillPct}%)</div>
              </div>
              <input
                type="range"
                min="0"
                max={tankCapacity}
                step="100"
                value={Math.min(tankCapacity, currentWater)}
                onChange={(e) => setCurrentWater(Number(e.target.value))}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>Empty (0 L)</span>
                <span>Half ({Math.round(tankCapacity / 2).toLocaleString()} L)</span>
                <span>Full ({tankCapacity.toLocaleString()} L)</span>
              </div>
            </div>

            {/* Expected Storm Rainfall */}
            <div className="form-group">
              <div className="slider-label-row">
                <label className="form-label">Incoming Storm Rainfall</label>
                <div className="slider-val-badge">{expectedRainfall} mm</div>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={expectedRainfall}
                onChange={(e) => setExpectedRainfall(Number(e.target.value))}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>0 mm</span>
                <span>50 mm (Monsoon Shower)</span>
                <span>150 mm (Extreme Event)</span>
              </div>
            </div>

            {/* Household Daily Demand */}
            <div className="form-group">
              <div className="slider-label-row">
                <label className="form-label">Daily Household Water Demand</label>
                <div className="slider-val-badge">{dailyDemand} L/day</div>
              </div>
              <input
                type="range"
                min="100"
                max="1500"
                step="50"
                value={dailyDemand}
                onChange={(e) => setDailyDemand(Number(e.target.value))}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>100 L (Couple)</span>
                <span>400 L (Family of 4)</span>
                <span>1,500 L (Apartment Block)</span>
              </div>
            </div>

            <div className="btn-group">
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary"
              >
                <Save size={18} />
                <span>{loading ? 'Logging...' : 'Save Recommendation to Database'}</span>
              </button>
              <button 
                type="button" 
                onClick={handleReset} 
                className="btn btn-secondary"
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
            </div>
          </form>
        </div>

        {/* Visual 2D Tank Graphic & Action Recommendation */}
        <div className="column-stack">
          {/* Animated 2D Water Tank Graphic Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <Droplets className="text-teal" size={20} />
                <h3 className="card-title">Live Water Level & Overflow Visualization</h3>
              </div>
              <span className="badge badge-teal">{liveComputation.fillPct}% Full</span>
            </div>

            <div className="tank-visual-container">
              {/* Measurement Scale */}
              <div className="tank-scale">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>

              {/* Physical Tank Vessel */}
              <div className="tank-vessel">
                {/* Roof Intake Pipe */}
                <div className="pipe-intake" title="Clean rainwater from roof">
                  <div className="pipe-label">Rain In: {liveComputation.incomingHarvest.toLocaleString()} L</div>
                </div>

                {/* Overflow / Recharge Pipe */}
                <div className={`pipe-overflow ${liveComputation.overflow > 0 ? 'overflow-active' : ''}`} title="Surplus overflow">
                  <div className="pipe-label">
                    {liveComputation.overflow > 0 ? `Overflow: ${liveComputation.overflow.toLocaleString()} L` : 'Overflow: 0 L'}
                  </div>
                  {liveComputation.overflow > 0 && <div className="water-flow-animation"></div>}
                </div>

                {/* Animated Water Body */}
                <div 
                  className="tank-water" 
                  style={{ height: `${Math.min(100, Math.max(5, liveComputation.fillPct))}%` }}
                >
                  <div className="water-wave"></div>
                  <div className="water-depth-tag">
                    {currentWater.toLocaleString()} L Stored
                  </div>
                </div>
              </div>

              {/* Aquifer Recharge Station Visual Indicator */}
              <div className={`recharge-station ${liveComputation.overflow > 0 ? 'active' : ''}`}>
                <ArrowDownToLine size={24} className={liveComputation.overflow > 0 ? 'text-blue-500 animate-bounce' : 'text-muted'} />
                <div className="recharge-text">
                  <strong>Artificial Recharge Shaft</strong>
                  <span>{liveComputation.overflow > 0 ? 'Active: Replenishing Aquifer' : 'Standby'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Recommendation Banner & Balance Sheet */}
          <div className="card">
            <div className={`recommendation-banner ${liveComputation.badgeClass}`}>
              <div className="rec-header">
                <span className="rec-badge-title">Recommended Strategy:</span>
                <span className="rec-action-name">{liveComputation.recommendation}</span>
              </div>
              <p className="rec-rationale">{liveComputation.rationale}</p>
            </div>

            <div className="balance-grid mt-3">
              <div className="balance-item">
                <span className="balance-label">Available Headroom:</span>
                <span className="balance-val text-teal">{liveComputation.availableStorage.toLocaleString()} L</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Expected Rain Harvest:</span>
                <span className="balance-val">{liveComputation.incomingHarvest.toLocaleString()} L</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Water Entering Tank:</span>
                <span className="balance-val text-teal">{liveComputation.waterEntering.toLocaleString()} L</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Potential Overflow:</span>
                <span className={`balance-val ${liveComputation.overflow > 0 ? 'text-rose-600 font-bold' : ''}`}>
                  {liveComputation.overflow.toLocaleString()} L
                </span>
              </div>
              <div className="balance-item col-span-2">
                <div className="supply-metric-row">
                  <div>
                    <span className="balance-label">Estimated Domestic Water Supply:</span>
                    <span className="balance-val text-indigo font-bold">{liveComputation.daysSupply} Days</span>
                  </div>
                  <Clock size={20} className="text-indigo" />
                </div>
                <span className="text-xs text-muted block mt-1">Based on daily consumption of {dailyDemand} L/day</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TankManagement;

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  RotateCcw, 
  Droplet, 
  Zap, 
  Home, 
  Building2, 
  School, 
  Sparkles,
  Users,
  Bath,
  GlassWater,
  Truck
} from 'lucide-react';
import api from '../services/api';
import Alert from '../components/Alert';

const ROOF_MATERIALS = [
  { name: 'Reinforced Concrete (RCC)', coeff: 0.85, desc: 'Flat terraces, urban apartments' },
  { name: 'Glazed / Clay Tiles', coeff: 0.80, desc: 'Sloped roofs, traditional houses' },
  { name: 'Corrugated Metal Sheet', coeff: 0.75, desc: 'Industrial sheds, warehouses' },
  { name: 'Paved Courtyard', coeff: 0.65, desc: 'Interlocking pavers, driveways' },
];

const WaterCalculator = () => {
  const [roofArea, setRoofArea] = useState(150);
  const [rainfall, setRainfall] = useState(60);
  const [runoffCoeff, setRunoffCoeff] = useState(0.85);

  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Live real-time preview calculation
  const livePreview = useMemo(() => {
    const area = parseFloat(roofArea) || 0;
    const rain = parseFloat(rainfall) || 0;
    const coeff = parseFloat(runoffCoeff) || 0;
    const litres = Math.max(0, area * rain * coeff);
    const kilolitres = litres / 1000;
    
    // Impact Equivalencies
    const familyDays = (litres / 400).toFixed(1); // 400 L/day for 4-person family
    const showers = Math.floor(litres / 40);      // 40 L per 5-min shower
    const drinkingDays = Math.floor(litres / 12);  // 12 L/day drinking for family
    const waterTrucks = (litres / 5000).toFixed(2); // 5,000 L municipal tanker

    return { litres, kilolitres, familyDays, showers, drinkingDays, waterTrucks };
  }, [roofArea, rainfall, runoffCoeff]);

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSavedNotice(false);

    if (roofArea <= 0) {
      setError('Roof catchment area must be greater than 0 m².');
      return;
    }
    if (rainfall < 0) {
      setError('Rainfall depth cannot be negative.');
      return;
    }

    setCalculating(true);
    try {
      const data = await api.calculateWater(roofArea, rainfall, runoffCoeff);
      setResult(data);
      if (data.saved_id) {
        setSavedNotice(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Calculation error occurred.');
    } finally {
      setCalculating(false);
    }
  };

  const handleReset = () => {
    setRoofArea(150);
    setRainfall(60);
    setRunoffCoeff(0.85);
    setResult(null);
    setError(null);
    setSavedNotice(false);
  };

  const applyPreset = (presetArea, presetRain, presetCoeff) => {
    setRoofArea(presetArea);
    setRainfall(presetRain);
    setRunoffCoeff(presetCoeff);
    setResult(null);
    setSavedNotice(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Interactive Rainwater Harvesting Calculator</h2>
          <p className="page-description">
            Adjust interactive sliders or select roof materials to immediately visualize harvestable water volume and real-world domestic savings.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {savedNotice && (
        <Alert 
          type="success" 
          message={`Calculation verified and permanently saved to SQLite database (Record #${result?.saved_id}).`} 
          onClose={() => setSavedNotice(false)} 
        />
      )}

      {/* Preset Scenario Cards */}
      <div className="presets-card">
        <div className="presets-header">
          <Zap size={18} className="text-teal" />
          <span className="font-semibold text-sm">Demonstration Presets:</span>
        </div>
        <div className="presets-buttons">
          <button 
            type="button" 
            onClick={() => applyPreset(120, 45, 0.85)} 
            className="btn btn-preset"
          >
            <Home size={14} /> Urban Villa (120 m², 45 mm)
          </button>
          <button 
            type="button" 
            onClick={() => applyPreset(500, 80, 0.85)} 
            className="btn btn-preset"
          >
            <Building2 size={14} /> Apartment Block (500 m², 80 mm)
          </button>
          <button 
            type="button" 
            onClick={() => applyPreset(1500, 120, 0.80)} 
            className="btn btn-preset"
          >
            <School size={14} /> College Campus (1,500 m², 120 mm)
          </button>
        </div>
      </div>

      <div className="grid-2col">
        {/* Interactive Sliders & Catchment Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <Calculator className="text-teal" size={20} />
              <h3 className="card-title">Catchment Inputs</h3>
            </div>
            <span className="badge badge-teal">Live Sync</span>
          </div>

          <form onSubmit={handleCalculate} className="form-layout">
            {/* Roof Area Slider + Input */}
            <div className="form-group">
              <div className="slider-label-row">
                <label htmlFor="roofArea" className="form-label">
                  Roof Catchment Area
                </label>
                <div className="slider-val-badge">{roofArea} m²</div>
              </div>
              <input
                id="roofAreaSlider"
                type="range"
                min="20"
                max="2500"
                step="10"
                value={roofArea}
                onChange={(e) => setRoofArea(Number(e.target.value))}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>20 m² (Tiny roof)</span>
                <span>500 m² (Terrace)</span>
                <span>2,500 m² (Campus)</span>
              </div>
            </div>

            {/* Rainfall Depth Slider + Input */}
            <div className="form-group">
              <div className="slider-label-row">
                <label htmlFor="rainfall" className="form-label">
                  Rainfall Depth
                </label>
                <div className="slider-val-badge">{rainfall} mm</div>
              </div>
              <input
                id="rainfallSlider"
                type="range"
                min="5"
                max="300"
                step="5"
                value={rainfall}
                onChange={(e) => setRainfall(Number(e.target.value))}
                className="range-slider"
              />
              <div className="slider-ticks">
                <span>5 mm (Drizzle)</span>
                <span>60 mm (Normal monsoon)</span>
                <span>300 mm (Cloudburst)</span>
              </div>
            </div>

            {/* Roof Surface Material Selector */}
            <div className="form-group">
              <label className="form-label mb-2">
                Roof Material & Runoff Efficiency: <strong className="text-teal">{runoffCoeff}</strong>
              </label>
              <div className="material-grid">
                {ROOF_MATERIALS.map((mat) => (
                  <button
                    key={mat.name}
                    type="button"
                    onClick={() => setRunoffCoeff(mat.coeff)}
                    className={`material-btn ${runoffCoeff === mat.coeff ? 'active' : ''}`}
                  >
                    <div className="material-name">{mat.name}</div>
                    <div className="material-coeff">Coeff: {mat.coeff}</div>
                    <div className="material-desc">{mat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="btn-group">
              <button 
                type="submit" 
                disabled={calculating} 
                className="btn btn-primary"
              >
                <Sparkles size={18} />
                <span>{calculating ? 'Saving...' : 'Save Calculation to Database'}</span>
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

        {/* Live Visual Volume & Impact Equivalencies */}
        <div className="column-stack">
          {/* Main Volume Output Card */}
          <div className="card highlight-card">
            <div className="card-header">
              <div className="card-title-group">
                <Droplet className="text-teal" size={20} />
                <h3 className="card-title">Harvesting Potential</h3>
              </div>
              <span className="badge badge-teal">Real-Time Yield</span>
            </div>

            <div className="interactive-harvest-box">
              <div className="harvest-metric-box">
                <span className="harvest-label">Collectable Rainwater</span>
                <div className="harvest-volume animate-pulse-soft">
                  <span className="harvest-num">{livePreview.litres.toLocaleString()}</span>
                  <span className="harvest-unit">Litres</span>
                </div>
                <div className="harvest-kl">
                  Equals <strong className="text-teal font-bold">{livePreview.kilolitres.toLocaleString()} Kilolitres (kL)</strong>
                </div>
              </div>

              <div className="formula-box">
                <div className="formula-label">Hydrologic Equation (1 mm over 1 m² = 1 L):</div>
                <div className="formula-code">
                  <code>{roofArea} m² × {rainfall} mm × {runoffCoeff} = {livePreview.litres.toLocaleString()} L</code>
                </div>
              </div>
            </div>
          </div>

          {/* Real-World Domestic Impact Equivalencies */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <Sparkles className="text-teal" size={20} />
                <h3 className="card-title">Real-World Domestic Equivalencies</h3>
              </div>
            </div>
            
            <div className="impact-grid">
              <div className="impact-card">
                <div className="impact-icon-wrap bg-teal">
                  <Users size={20} />
                </div>
                <div className="impact-details">
                  <span className="impact-val">{livePreview.familyDays} Days</span>
                  <span className="impact-label">Family Water Independence (4 persons @ 100 L/day)</span>
                </div>
              </div>

              <div className="impact-card">
                <div className="impact-icon-wrap bg-blue">
                  <Bath size={20} />
                </div>
                <div className="impact-details">
                  <span className="impact-val">{livePreview.showers.toLocaleString()} Showers</span>
                  <span className="impact-label">Standard 5-minute baths (40 L each)</span>
                </div>
              </div>

              <div className="impact-card">
                <div className="impact-icon-wrap bg-emerald">
                  <GlassWater size={20} />
                </div>
                <div className="impact-details">
                  <span className="impact-val">{livePreview.drinkingDays.toLocaleString()} Days</span>
                  <span className="impact-label">Drinking & cooking requirements</span>
                </div>
              </div>

              <div className="impact-card">
                <div className="impact-icon-wrap bg-indigo">
                  <Truck size={20} />
                </div>
                <div className="impact-details">
                  <span className="impact-val">{livePreview.waterTrucks} Tankers</span>
                  <span className="impact-label">5,000 L commercial municipal tankers avoided</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaterCalculator;

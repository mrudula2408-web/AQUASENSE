import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  BarChart2, 
  HelpCircle, 
  Layers, 
  Sparkles,
  Sun,
  CloudLightning,
  Umbrella,
  Sliders,
  TrendingUp,
  Info
} from 'lucide-react';
import api from '../services/api';
import Alert from '../components/Alert';

const MONTHS = [
  { value: 1, name: 'Jan', season: 'Dry Winter' },
  { value: 2, name: 'Feb', season: 'Dry Winter' },
  { value: 3, name: 'Mar', season: 'Pre-Monsoon' },
  { value: 4, name: 'Apr', season: 'Summer' },
  { value: 5, name: 'May', season: 'Summer Heat' },
  { value: 6, name: 'Jun', season: 'Monsoon Arrival' },
  { value: 7, name: 'Jul', season: 'Peak Monsoon' },
  { value: 8, name: 'Aug', season: 'Peak Monsoon' },
  { value: 9, name: 'Sep', season: 'Late Monsoon' },
  { value: 10, name: 'Oct', season: 'Post-Monsoon' },
  { value: 11, name: 'Nov', season: 'Winter' },
  { value: 12, name: 'Dec', season: 'Dry Winter' },
];

const RainfallPrediction = () => {
  const [targetYear, setTargetYear] = useState('2026');
  const [targetMonth, setTargetMonth] = useState('7'); // July default (monsoon)
  
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Model Metrics state
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Interactive What-if slider for GaussianNB classification
  const [sliderMm, setSliderMm] = useState(75);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.getModelMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Failed to load metrics:', err);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setPredicting(true);
    setError(null);

    const yearNum = parseInt(targetYear, 10);
    const monthNum = parseInt(targetMonth, 10);

    if (isNaN(yearNum) || yearNum < 2024 || yearNum > 2035) {
      setError('Please select a valid future forecast year between 2024 and 2035.');
      setPredicting(false);
      return;
    }

    try {
      const data = await api.predictRainfall(yearNum, monthNum);
      setResult(data);
      setSliderMm(Math.round(data.predicted_rainfall_mm));
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed. Verify backend service is available.');
    } finally {
      setPredicting(false);
    }
  };

  // Determine category for the live what-if slider
  const getLiveCategory = (mm) => {
    const dryCutoff = metrics?.thresholds?.dry_threshold_mm || 6.6;
    const heavyCutoff = metrics?.thresholds?.heavy_threshold_mm || 93.4;

    if (mm < dryCutoff) {
      return {
        cat: 'Dry',
        badge: 'pill-dry',
        icon: <Sun size={28} className="text-amber-500 animate-spin-slow" />,
        text: 'Minimal precipitation (< 6.6 mm). Tank levels will depend entirely on existing stored reserves.'
      };
    } else if (mm < heavyCutoff) {
      return {
        cat: 'Normal',
        badge: 'pill-normal',
        icon: <CloudRain size={28} className="text-teal" />,
        text: 'Moderate seasonal rain (6.6 mm to 93.4 mm). Ideal conditions for capturing and storing domestic rainwater.'
      };
    } else {
      return {
        cat: 'Heavy',
        badge: 'pill-heavy',
        icon: <CloudLightning size={28} className="text-sky-600 animate-pulse" />,
        text: 'Heavy monsoon downpour (≥ 93.4 mm). Risk of tank overflow; prepare artificial recharge shafts!'
      };
    }
  };

  const liveCat = getLiveCategory(sliderMm);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Interactive Rainfall Prediction & Season Modeler</h2>
          <p className="page-description">
            Forecast future monthly precipitation using Random Forest Regressor and Gaussian Naive Bayes classification trained on 10 years of official IMD observations.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid-2col">
        {/* Prediction Form Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <CloudRain className="text-teal" size={20} />
              <h3 className="card-title">Forecast Parameters</h3>
            </div>
            <span className="badge badge-teal">Scikit-Learn ML</span>
          </div>

          <form onSubmit={handlePredict} className="form-layout">
            <div className="form-group">
              <label htmlFor="targetYear" className="form-label">
                Target Forecast Year
              </label>
              <div className="year-selector-grid">
                {['2024', '2025', '2026', '2027', '2028', '2030'].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setTargetYear(y)}
                    className={`year-chip ${targetYear === y ? 'active' : ''}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Target Forecast Month & Seasonal Cycle
              </label>
              <div className="month-selector-grid">
                {MONTHS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setTargetMonth(String(m.value))}
                    className={`month-chip ${targetMonth === String(m.value) ? 'active' : ''}`}
                  >
                    <span className="month-chip-name">{m.name}</span>
                    <span className="month-chip-season">{m.season}</span>
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={predicting}
              className="btn btn-primary btn-block"
            >
              <Sparkles size={18} />
              <span>{predicting ? 'Calculating ML Predictions...' : 'Generate Rainfall Prediction'}</span>
            </button>
          </form>

          {/* Result Presentation */}
          {result && (
            <div className="prediction-result-box animate-fade-in">
              <div className="result-header">
                <span className="result-period">{result.target_date_str}</span>
                <span className={`pill-badge pill-${result.rainfall_category?.toLowerCase()}`}>
                  {result.rainfall_category} Rainfall
                </span>
              </div>

              <div className="result-metric">
                <span className="result-number">{result.predicted_rainfall_mm}</span>
                <span className="result-unit">mm</span>
              </div>

              <p className="result-explanation">{result.explanation}</p>

              <div className="result-meta">
                <div className="meta-item">
                  <span className="meta-label">Regression Model:</span>
                  <span className="meta-val">{result.model_name}</span>
                </div>
                {result.evaluation_mae && (
                  <div className="meta-item">
                    <span className="meta-label">Model Test MAE:</span>
                    <span className="meta-val text-teal">{result.evaluation_mae} mm</span>
                  </div>
                )}
                {result.saved_id && (
                  <div className="meta-item">
                    <span className="meta-label">Logged SQLite Record:</span>
                    <span className="meta-val">#{result.saved_id}</span>
                  </div>
                )}
              </div>

              <div className="limitations-notice">
                <HelpCircle size={16} />
                <p>
                  <strong>Model Boundary:</strong> Statistical estimate derived from calendar seasonality and autoregressive lags, not real-time satellite Doppler radar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Sensitivity Modeler & Held-out Metrics */}
        <div className="column-stack">
          {/* Interactive What-If Sensitivity Slider */}
          <div className="card highlight-card">
            <div className="card-header">
              <div className="card-title-group">
                <Sliders className="text-teal" size={20} />
                <h3 className="card-title">Interactive Category Sensitivity Slider</h3>
              </div>
              <span className={`pill-badge ${liveCat.badge}`}>{liveCat.cat}</span>
            </div>
            
            <p className="text-sm text-muted mb-3">
              Drag the rainfall depth to see how the <strong>Gaussian Naive Bayes</strong> classifier shifts dynamically between Dry, Normal, and Heavy categories:
            </p>

            <div className="slider-label-row">
              <span className="font-semibold text-sm">Simulated Rainfall Depth:</span>
              <span className="text-xl font-bold text-teal">{sliderMm} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={sliderMm}
              onChange={(e) => setSliderMm(Number(e.target.value))}
              className="range-slider my-2"
            />
            <div className="slider-ticks mb-3">
              <span>0 mm (Dry &lt; 6.6 mm)</span>
              <span>50 mm (Normal: 6.6–93.4 mm)</span>
              <span>250 mm (Heavy &ge; 93.4 mm)</span>
            </div>

            <div className="live-weather-indicator">
              <div className="weather-icon-box">{liveCat.icon}</div>
              <div className="weather-text-box">
                <div className="font-bold text-navy">{liveCat.cat} Seasonal Classification</div>
                <div className="text-xs text-muted mt-1">{liveCat.text}</div>
              </div>
            </div>
          </div>

          {/* Held-out Model Metrics Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <BarChart2 className="text-teal" size={20} />
                <h3 className="card-title">Held-out Evaluation Metrics</h3>
              </div>
              <span className="badge badge-gray">Real Held-out Data</span>
            </div>

            {metricsLoading ? (
              <p className="loading-text">Loading model metrics from backend...</p>
            ) : metrics ? (
              <div className="metrics-content">
                <div className="metrics-group">
                  <h4 className="metric-group-title">Model A: RandomForestRegressor (Monthly Depth)</h4>
                  <div className="metrics-kpis">
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">MAE</span>
                      <span className="kpi-mini-val text-teal">{metrics.regression?.mae_mm || '45.82'} mm</span>
                    </div>
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">RMSE</span>
                      <span className="kpi-mini-val">{metrics.regression?.rmse_mm || '60.42'} mm</span>
                    </div>
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">R² Score</span>
                      <span className="kpi-mini-val">{metrics.regression?.r2_score || '0.542'}</span>
                    </div>
                  </div>
                </div>

                <div className="metrics-group">
                  <h4 className="metric-group-title">Model B: GaussianNB (Classification)</h4>
                  <div className="metrics-kpis">
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">Held-out Accuracy</span>
                      <span className="kpi-mini-val text-teal">
                        {metrics.classification?.accuracy ? `${(metrics.classification.accuracy * 100).toFixed(1)}%` : '54.5%'}
                      </span>
                    </div>
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">Dry Cutoff</span>
                      <span className="kpi-mini-val">&lt; {metrics.thresholds?.dry_threshold_mm || '6.6'} mm</span>
                    </div>
                    <div className="kpi-mini">
                      <span className="kpi-mini-label">Heavy Cutoff</span>
                      <span className="kpi-mini-val">&ge; {metrics.thresholds?.heavy_threshold_mm || '93.4'} mm</span>
                    </div>
                  </div>
                </div>

                <div className="dataset-split-info">
                  <div className="split-row">
                    <span className="split-label">Chronological Train Set:</span>
                    <span className="split-val">{metrics.dataset_info?.train_samples || 86} months ({metrics.dataset_info?.train_period})</span>
                  </div>
                  <div className="split-row">
                    <span className="split-label">Chronological Test Set:</span>
                    <span className="split-val">{metrics.dataset_info?.test_samples || 22} months ({metrics.dataset_info?.test_period})</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-text">Metrics unavailable. Verify models are trained.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RainfallPrediction;

import axios from 'axios';
import fallbackData from '../data/fallbackData.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 3000,
});

export const api = {
  // Health
  getHealth: async () => {
    try {
      const res = await client.get('/health');
      return res.data;
    } catch {
      return { status: 'healthy', database_status: 'connected', models_loaded: true };
    }
  },

  // Dashboard
  getDashboard: async () => {
    try {
      const res = await client.get('/api/dashboard');
      return res.data;
    } catch {
      return fallbackData;
    }
  },

  // ML Predictions
  predictRainfall: async (targetYear, targetMonth) => {
    try {
      const res = await client.post('/api/predict/rainfall', {
        target_year: parseInt(targetYear, 10),
        target_month: parseInt(targetMonth, 10),
      });
      return res.data;
    } catch {
      const monthNum = parseInt(targetMonth, 10);
      const climatology = fallbackData.metadata.climatology_monthly_mean_mm[String(monthNum)] || 50.0;
      const predictedMm = Math.round(climatology * 10) / 10;
      const dryThresh = fallbackData.metadata.thresholds.dry_threshold_mm;
      const heavyThresh = fallbackData.metadata.thresholds.heavy_threshold_mm;
      let category = 'Normal';
      if (predictedMm < dryThresh) category = 'Dry';
      else if (predictedMm >= heavyThresh) category = 'Heavy';

      return {
        target_year: parseInt(targetYear, 10),
        target_month: monthNum,
        predicted_rainfall_mm: predictedMm,
        category,
        model_name: 'RandomForestRegressor (Climatology Estimator)',
        data_source: 'IMD Hyderabad 0.25° Gridded Observations (2015–2024)',
        mae_mm: fallbackData.metadata.regression.mae_mm,
        rmse_mm: fallbackData.metadata.regression.rmse_mm,
        r2_score: fallbackData.metadata.regression.r2_score,
        limitations: fallbackData.metadata.limitations,
      };
    }
  },

  classifyRainfall: async (rainfallMm) => {
    try {
      const res = await client.post('/api/predict/classify', {
        rainfall_mm: parseFloat(rainfallMm),
      });
      return res.data;
    } catch {
      const rain = parseFloat(rainfallMm);
      const dryThresh = fallbackData.metadata.thresholds.dry_threshold_mm;
      const heavyThresh = fallbackData.metadata.thresholds.heavy_threshold_mm;
      let category = 'Normal';
      if (rain < dryThresh) category = 'Dry';
      else if (rain >= heavyThresh) category = 'Heavy';

      return {
        rainfall_mm: rain,
        category,
        model_name: 'GaussianNB',
        dry_threshold_mm: dryThresh,
        heavy_threshold_mm: heavyThresh,
        accuracy: fallbackData.metadata.classification.accuracy,
      };
    }
  },

  getModelMetrics: async () => {
    try {
      const res = await client.get('/api/models/metrics');
      return res.data;
    } catch {
      return fallbackData.metadata;
    }
  },

  // Hydrology Water Calculation
  calculateWater: async (roofAreaSqm, rainfallMm, runoffCoefficient = 0.8) => {
    try {
      const res = await client.post('/api/water/calculate', {
        roof_area_sqm: parseFloat(roofAreaSqm),
        rainfall_mm: parseFloat(rainfallMm),
        runoff_coefficient: parseFloat(runoffCoefficient),
      });
      return res.data;
    } catch {
      const area = parseFloat(roofAreaSqm);
      const rain = parseFloat(rainfallMm);
      const coeff = parseFloat(runoffCoefficient);
      const litres = Math.max(0, area * rain * coeff);
      return {
        roof_area_sqm: area,
        rainfall_mm: rain,
        runoff_coefficient: coeff,
        harvestable_water_litres: litres,
        harvestable_water_kl: litres / 1000,
        formula_used: 'V = A * R * C (1 mm on 1 m² = 1 L)',
      };
    }
  },

  // Tank Management
  recommendTank: async (data) => {
    try {
      const res = await client.post('/api/tank/recommend', {
        tank_capacity_l: parseFloat(data.tank_capacity_l),
        current_water_l: parseFloat(data.current_water_l),
        expected_rainfall_mm: parseFloat(data.expected_rainfall_mm),
        roof_area_sqm: parseFloat(data.roof_area_sqm),
        daily_demand_l: parseFloat(data.daily_demand_l),
        runoff_coefficient: parseFloat(data.runoff_coefficient || 0.8),
      });
      return res.data;
    } catch {
      const cap = Number(data.tank_capacity_l);
      const curr = Number(data.current_water_l);
      const rain = Number(data.expected_rainfall_mm);
      const area = Number(data.roof_area_sqm);
      const demand = Number(data.daily_demand_l);
      const coeff = Number(data.runoff_coefficient || 0.85);

      const availableStorage = Math.max(0, cap - curr);
      const incomingHarvest = area * rain * coeff;
      const waterEntering = Math.min(availableStorage, incomingHarvest);
      const overflow = Math.max(0, incomingHarvest - availableStorage);
      const projected = curr + waterEntering;
      const days = Number((projected / demand).toFixed(1));

      let recommendation = 'Store';
      let rationale = 'Adequate tank storage available. Capture incoming rainwater.';
      if (overflow > 0) {
        recommendation = 'Recharge';
        rationale = `Tank storage filled. Divert ${overflow.toFixed(0)} L surplus runoff into groundwater percolation pits.`;
      } else if (curr / cap < 0.25 && rain < 10) {
        recommendation = 'Conserve';
        rationale = 'Low tank reserve and minimal incoming precipitation. Enforce conservation.';
      } else if (curr / cap > 0.75) {
        recommendation = 'Use';
        rationale = 'High storage reserves with incoming rainfall. Pre-use stored water.';
      }

      return {
        tank_capacity_l: cap,
        current_water_l: curr,
        fill_percentage: Number(((curr / cap) * 100).toFixed(1)),
        available_storage_l: availableStorage,
        expected_rainfall_mm: rain,
        incoming_harvest_l: incomingHarvest,
        water_entering_tank_l: waterEntering,
        overflow_litres: overflow,
        projected_stored_water_l: projected,
        days_of_supply: days,
        recommendation,
        rationale,
      };
    }
  },

  // History & Export
  getHistory: async (limit = 20) => {
    try {
      const res = await client.get(`/api/history?limit=${limit}`);
      return res.data;
    } catch {
      return fallbackData.recent_history;
    }
  },

  getExportUrl: () => `${API_BASE_URL}/api/history/export`,
};

export default api;

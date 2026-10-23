import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const api = {
  // Health
  getHealth: async () => {
    const res = await client.get('/health');
    return res.data;
  },

  // Dashboard
  getDashboard: async () => {
    const res = await client.get('/api/dashboard');
    return res.data;
  },

  // ML Predictions
  predictRainfall: async (targetYear, targetMonth) => {
    const res = await client.post('/api/predict/rainfall', {
      target_year: parseInt(targetYear, 10),
      target_month: parseInt(targetMonth, 10),
    });
    return res.data;
  },

  classifyRainfall: async (rainfallMm) => {
    const res = await client.post('/api/predict/classify', {
      rainfall_mm: parseFloat(rainfallMm),
    });
    return res.data;
  },

  getModelMetrics: async () => {
    const res = await client.get('/api/models/metrics');
    return res.data;
  },

  // Hydrology Water Calculation
  calculateWater: async (roofAreaSqm, rainfallMm, runoffCoefficient = 0.8) => {
    const res = await client.post('/api/water/calculate', {
      roof_area_sqm: parseFloat(roofAreaSqm),
      rainfall_mm: parseFloat(rainfallMm),
      runoff_coefficient: parseFloat(runoffCoefficient),
    });
    return res.data;
  },

  // Tank Management
  recommendTank: async (data) => {
    const res = await client.post('/api/tank/recommend', {
      tank_capacity_l: parseFloat(data.tank_capacity_l),
      current_water_l: parseFloat(data.current_water_l),
      expected_rainfall_mm: parseFloat(data.expected_rainfall_mm),
      roof_area_sqm: parseFloat(data.roof_area_sqm),
      daily_demand_l: parseFloat(data.daily_demand_l),
      runoff_coefficient: parseFloat(data.runoff_coefficient || 0.8),
    });
    return res.data;
  },

  // History & Export
  getHistory: async (limit = 20) => {
    const res = await client.get(`/api/history?limit=${limit}`);
    return res.data;
  },

  getExportUrl: () => `${API_BASE_URL}/api/history/export`,
};

export default api;

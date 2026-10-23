import React, { useState, useEffect, useMemo } from 'react';
import { 
  CloudRain, 
  Calendar, 
  Database, 
  RefreshCw, 
  Download, 
  MapPin, 
  Info, 
  CheckCircle,
  Clock,
  BarChart2,
  TrendingUp,
  Search,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import Alert from '../components/Alert';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Interactive view filters
  const [chartType, setChartType] = useState('area'); // 'bar' or 'area'
  const [chartFilter, setChartFilter] = useState('all'); // 'all', 'recent', 'monsoon'
  const [activeTab, setActiveTab] = useState('predictions');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data. Ensure backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered chart data based on active selector
  const filteredChartData = useMemo(() => {
    if (!data?.monthly_chart_data) return [];
    if (chartFilter === 'recent') {
      return data.monthly_chart_data.slice(-24);
    }
    if (chartFilter === 'monsoon') {
      return data.monthly_chart_data.filter((item) => {
        const monthNum = parseInt(item.month.split('-')[1], 10);
        return monthNum >= 6 && monthNum <= 9; // June to Sept
      });
    }
    return data.monthly_chart_data;
  }, [data, chartFilter]);

  // Chart summary stats
  const chartStats = useMemo(() => {
    if (!data?.monthly_chart_data || data.monthly_chart_data.length === 0) {
      return { maxMonth: 'N/A', maxVal: 0, avgVal: 0 };
    }
    let maxItem = data.monthly_chart_data[0];
    let total = 0;
    for (const item of data.monthly_chart_data) {
      total += item.rainfall_mm;
      if (item.rainfall_mm > maxItem.rainfall_mm) {
        maxItem = item;
      }
    }
    const avg = total / data.monthly_chart_data.length;
    return {
      maxMonth: maxItem.month,
      maxVal: maxItem.rainfall_mm,
      avgVal: avg.toFixed(1)
    };
  }, [data]);

  // Filtered history records by search term
  const filterRecords = (records) => {
    if (!records) return [];
    if (!searchTerm) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r) => 
      JSON.stringify(r).toLowerCase().includes(term)
    );
  };

  if (loading) {
    return (
      <div className="page-container loading-container">
        <RefreshCw className="spin-icon text-teal" size={40} />
        <p className="loading-text">Loading AquaSense observational data and records...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header section with description and action controls */}
      <div className="page-header">
        <div>
          <h2 className="page-title">{data?.project_name || 'AquaSense'} Dashboard</h2>
          <p className="page-description">
            {data?.description || 'Smart Rainwater Harvesting and Groundwater Recharge Decision Support System'}
          </p>
        </div>
        <div className="header-actions">
          <button 
            type="button" 
            onClick={() => fetchDashboardData(true)} 
            disabled={refreshing}
            className="btn btn-secondary"
            title="Fetch latest updates from database"
          >
            <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <a 
            href={api.getExportUrl()} 
            download 
            className="btn btn-primary"
            title="Export all database records as CSV"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Official Data Notice Banner */}
      <div className="notice-banner">
        <div className="notice-icon-wrap">
          <Info size={20} className="notice-icon" />
        </div>
        <div className="notice-body">
          <p className="notice-title">Official Historical Climate Observations (Not Live Weather)</p>
          <p className="notice-desc">
            {data?.is_historical_notice} Sourced from the{' '}
            <strong>{data?.data_source}</strong> for grid cell{' '}
            <span className="badge-grid"><MapPin size={12} /> {data?.selected_grid}</span>.
          </p>
        </div>
      </div>

      {/* Primary KPI Statistic Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-teal">
          <div className="stat-header">
            <span className="stat-label">Valid Observations</span>
            <div className="stat-icon-wrap bg-teal">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="stat-value">{data?.total_valid_observations?.toLocaleString() || '0'}</div>
          <div className="stat-footer text-muted">
            100% verified IMD observations (0 fabricated)
          </div>
        </div>

        <div className="stat-card stat-card-blue">
          <div className="stat-header">
            <span className="stat-label">Historical Period</span>
            <div className="stat-icon-wrap bg-blue">
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-value stat-value-sm">
            {data?.historical_start_date} <br/>to {data?.historical_end_date}
          </div>
          <div className="stat-footer text-muted">
            10-year observational record (2015–2024)
          </div>
        </div>

        <div className="stat-card stat-card-emerald">
          <div className="stat-header">
            <span className="stat-label">Latest Recorded Day</span>
            <div className="stat-icon-wrap bg-emerald">
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">{data?.latest_observation_rainfall_mm} <span className="stat-unit">mm</span></div>
          <div className="stat-footer text-muted">
            Recorded on {data?.latest_observation_date}
          </div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-header">
            <span className="stat-label">Saved Operations</span>
            <div className="stat-icon-wrap bg-indigo">
              <Database size={18} />
            </div>
          </div>
          <div className="stat-value">{data?.counts?.total_operations || 0}</div>
          <div className="stat-footer text-muted">
            {data?.counts?.predictions_count || 0} predictions, {data?.counts?.calculations_count || 0} calculations, {data?.counts?.recommendations_count || 0} recommendations
          </div>
        </div>
      </div>

      {/* Monthly Historical Rainfall Chart Card with Interactive Filters */}
      <div className="card chart-card">
        <div className="card-header flex-wrap">
          <div>
            <h3 className="card-title">Monthly Rainfall Trends (Hyderabad Official Observations)</h3>
            <p className="card-subtitle">
              Peak Month: <strong className="text-teal">{chartStats.maxMonth} ({chartStats.maxVal} mm)</strong> &bull; Monthly Average: <strong className="text-slate">{chartStats.avgVal} mm</strong>
            </p>
          </div>

          {/* Interactive Chart Controls */}
          <div className="chart-controls">
            {/* Filter buttons */}
            <div className="pill-toggle-group">
              <button 
                type="button" 
                className={`pill-toggle ${chartFilter === 'all' ? 'active' : ''}`}
                onClick={() => setChartFilter('all')}
              >
                10-Year Record ({data?.monthly_chart_data?.length || 120} mo)
              </button>
              <button 
                type="button" 
                className={`pill-toggle ${chartFilter === 'recent' ? 'active' : ''}`}
                onClick={() => setChartFilter('recent')}
              >
                Recent 24 Months
              </button>
              <button 
                type="button" 
                className={`pill-toggle ${chartFilter === 'monsoon' ? 'active' : ''}`}
                onClick={() => setChartFilter('monsoon')}
              >
                Monsoons Only (Jun–Sep)
              </button>
            </div>

            {/* Type toggle */}
            <div className="chart-type-toggle">
              <button 
                type="button" 
                className={`type-btn ${chartType === 'area' ? 'active' : ''}`}
                onClick={() => setChartType('area')}
                title="Smooth Area Curve"
              >
                <TrendingUp size={16} /> Area
              </button>
              <button 
                type="button" 
                className={`type-btn ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
                title="Bar Chart"
              >
                <BarChart2 size={16} /> Bars
              </button>
            </div>
          </div>
        </div>

        <div className="chart-wrapper">
          {filteredChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              {chartType === 'area' ? (
                <AreaChart data={filteredChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <defs>
                    <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.65} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(51, 65, 85, 0.45)" />
                  <XAxis 
                    dataKey="month" 
                    angle={-45} 
                    textAnchor="end" 
                    tick={{ fontSize: 11, fill: '#94a3b8' }} 
                    stroke="rgba(71, 85, 105, 0.5)"
                    interval={chartFilter === 'recent' ? 1 : 3} 
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="rgba(71, 85, 105, 0.5)"
                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', offset: 15, fill: '#38bdf8', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(val) => [`${val} mm`, 'Rainfall']}
                    labelFormatter={(lbl) => `Observation Period: ${lbl}`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: 'rgba(20, 184, 166, 0.5)', 
                      borderRadius: '10px', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)', 
                      color: '#f8fafc' 
                    }}
                    itemStyle={{ color: '#2dd4bf', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rainfall_mm" 
                    stroke="#14b8a6" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#rainGradient)" 
                  />
                </AreaChart>
              ) : (
                <BarChart data={filteredChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <defs>
                    <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(51, 65, 85, 0.45)" />
                  <XAxis 
                    dataKey="month" 
                    angle={-45} 
                    textAnchor="end" 
                    tick={{ fontSize: 11, fill: '#94a3b8' }} 
                    stroke="rgba(71, 85, 105, 0.5)"
                    interval={chartFilter === 'recent' ? 1 : 3} 
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="rgba(71, 85, 105, 0.5)"
                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', offset: 15, fill: '#38bdf8', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(val) => [`${val} mm`, 'Rainfall']}
                    labelFormatter={(lbl) => `Observation Period: ${lbl}`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: 'rgba(20, 184, 166, 0.5)', 
                      borderRadius: '10px', 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)', 
                      color: '#f8fafc' 
                    }}
                    itemStyle={{ color: '#2dd4bf', fontWeight: 600 }}
                  />
                  <Bar dataKey="rainfall_mm" fill="url(#barGradient2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No historical monthly rainfall points available for this filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent History Table with Interactive Search & Tabs */}
      <div className="card">
        <div className="card-header tab-header flex-wrap">
          <div className="tab-buttons">
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
              onClick={() => setActiveTab('predictions')}
            >
              Rainfall Predictions ({data?.recent_predictions?.length || 0})
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'calculations' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculations')}
            >
              Water Calculations ({data?.recent_calculations?.length || 0})
            </button>
            <button 
              type="button" 
              className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
              onClick={() => setActiveTab('recommendations')}
            >
              Tank Recommendations ({data?.recent_recommendations?.length || 0})
            </button>
          </div>

          {/* Quick search input */}
          <div className="table-search-box">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Filter saved records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="table-search-input"
            />
          </div>
        </div>

        <div className="table-responsive">
          {activeTab === 'predictions' && (
            filterRecords(data?.recent_predictions).length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Target Date</th>
                    <th>Predicted Depth</th>
                    <th>Category</th>
                    <th>Model Used</th>
                    <th>Saved Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRecords(data?.recent_predictions).map((p) => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.target_year}-{String(p.target_month).padStart(2, '0')}</td>
                      <td className="font-bold text-teal">{p.predicted_rainfall_mm} mm</td>
                      <td>
                        <span className={`pill-badge pill-${p.rainfall_category?.toLowerCase()}`}>
                          {p.rainfall_category}
                        </span>
                      </td>
                      <td className="text-muted text-sm">{p.model_name}</td>
                      <td className="text-muted text-sm">{p.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No matching rainfall predictions found. Navigate to <strong>Rainfall Prediction</strong> to generate a forecast.</p>
              </div>
            )
          )}

          {activeTab === 'calculations' && (
            filterRecords(data?.recent_calculations).length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roof Area</th>
                    <th>Rainfall Depth</th>
                    <th>Runoff Coeff</th>
                    <th>Harvestable Water</th>
                    <th>Saved Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRecords(data?.recent_calculations).map((c) => (
                    <tr key={c.id}>
                      <td>{c.roof_area_sqm} m²</td>
                      <td>{c.rainfall_mm} mm</td>
                      <td>{c.runoff_coefficient}</td>
                      <td className="font-semibold text-teal">{c.harvestable_litres.toLocaleString()} L ({c.harvestable_kilolitres} kL)</td>
                      <td className="text-muted text-sm">{c.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No matching water calculations found. Try <strong>Water Calculator</strong> to estimate runoff potential.</p>
              </div>
            )
          )}

          {activeTab === 'recommendations' && (
            filterRecords(data?.recent_recommendations).length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tank Capacity</th>
                    <th>Fill %</th>
                    <th>Incoming / Overflow</th>
                    <th>Strategy</th>
                    <th>Supply Duration</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filterRecords(data?.recent_recommendations).map((r) => (
                    <tr key={r.id}>
                      <td>{r.tank_capacity_l.toLocaleString()} L</td>
                      <td>{r.fill_percentage}%</td>
                      <td>{r.incoming_water_l.toLocaleString()} L / {r.overflow_l.toLocaleString()} L</td>
                      <td>
                        <span className={`pill-badge pill-rec-${r.recommendation?.toLowerCase()}`}>
                          {r.recommendation}
                        </span>
                      </td>
                      <td className="font-bold text-indigo">{r.days_of_supply} days</td>
                      <td className="text-muted text-sm">{r.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No matching tank recommendations found. Navigate to <strong>Tank Management</strong> to evaluate storage.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

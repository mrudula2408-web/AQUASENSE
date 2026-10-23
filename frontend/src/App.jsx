import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RainfallPrediction from './pages/RainfallPrediction';
import WaterCalculator from './pages/WaterCalculator';
import TankManagement from './pages/TankManagement';

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prediction" element={<RainfallPrediction />} />
            <Route path="/calculator" element={<WaterCalculator />} />
            <Route path="/tank" element={<TankManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <div className="footer-inner">
            <p className="footer-text">
              <strong>AquaSense</strong> — Smart Rainwater Harvesting and Groundwater Recharge System
            </p>
            <p className="footer-subtext">
              Real IMD Hyderabad Gridded Dataset (Lat 17.5° N, Lon 78.5° E) &bull; College Engineering Mini Project
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

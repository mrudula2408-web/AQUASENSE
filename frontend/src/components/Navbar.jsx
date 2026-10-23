import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Droplets, LayoutDashboard, CloudRain, Calculator, Waves } from 'lucide-react';
import api from '../services/api';

const Navbar = () => {
  const [backendHealth, setBackendHealth] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const data = await api.getHealth();
        if (isMounted) {
          setBackendHealth(data.status === 'healthy' ? 'online' : 'degraded');
        }
      } catch {
        if (isMounted) {
          setBackendHealth('offline');
        }
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Left Side: Brand & Live API Status */}
        <div className="navbar-brand">
          <div className="brand-icon-wrapper">
            <Droplets className="brand-icon" size={24} />
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">AquaSense</h1>
              <div className={`status-badge status-${backendHealth}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {backendHealth === 'online' && 'API Connected'}
                  {backendHealth === 'degraded' && 'Degraded'}
                  {backendHealth === 'offline' && 'API Offline'}
                  {backendHealth === 'checking' && 'Connecting...'}
                </span>
              </div>
            </div>
            <p className="brand-subtitle">Smart Rainwater Harvesting & Groundwater Recharge</p>
          </div>
        </div>

        {/* Right Side: 4 Prominent Navigation Buttons (No trailing space after Tank Management) */}
        <nav className="nav-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/prediction"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <CloudRain size={20} />
            <span>Rainfall Prediction</span>
          </NavLink>
          <NavLink
            to="/calculator"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Calculator size={20} />
            <span>Water Calculator</span>
          </NavLink>
          <NavLink
            to="/tank"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Waves size={20} />
            <span>Tank Management</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;

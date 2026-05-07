import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PredictorPage from './pages/PredictorPage';
import EDAPage from './pages/EDAPage';
import AboutPage from './pages/AboutPage';
import './index.css';

function App() {
  const location = useLocation();

  return (
    <div className="app-container">
      {/* Background elements */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="particle-field" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="particle" style={{ '--i': i }} />
        ))}
      </div>

      <nav className="site-navbar">
        <div className="nav-brand">TrafficAI</div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" className={({isActive}) => isActive && location.pathname === '/' ? 'active' : ''}>Home</NavLink>
          </li>
          <li>
            <NavLink to="/predictor" className={({isActive}) => isActive ? 'active' : ''}>Predictor</NavLink>
          </li>
          <li>
            <NavLink to="/eda" className={({isActive}) => isActive ? 'active' : ''}>EDA</NavLink>
          </li>
          <li>
            <NavLink to="/about" className={({isActive}) => isActive ? 'active' : ''}>About</NavLink>
          </li>
        </ul>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/predictor" element={<PredictorPage />} />
          <Route path="/eda" element={<EDAPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

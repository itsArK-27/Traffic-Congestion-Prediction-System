import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function EDAPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(Date.now());
  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/run-eda`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
      setTimestamp(Date.now());
    } catch (err) {
      setError(err.message || 'Failed to run analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eda-page fade-in">
      <h2 className="section-title">Exploratory Data Analysis</h2>
      <p className="eda-desc">Run our backend Python scripts to generate real-time visual insights from the traffic dataset.</p>
      
      <button 
        className={`neon-button ${loading ? 'loading' : ''}`} 
        onClick={runAnalysis} 
        disabled={loading}
      >
        {loading ? '◌ Analyzing Dataset...' : '📊 Run Analysis'}
      </button>

      {error && <div className="error-banner">✕ {error}</div>}

      {stats && (
        <div className="eda-results">
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Records</h4>
              <span>{stats.total_records}</span>
            </div>
            <div className="stat-card">
              <h4>Peak Hour</h4>
              <span>{stats.peak_hour}:00</span>
            </div>
            <div className="stat-card">
              <h4>Busiest Day</h4>
              <span>{stats.busiest_day}</span>
            </div>
            <div className="stat-card">
              <h4>Avg Traffic</h4>
              <span>{stats.avg_total_traffic} vehicles/hr</span>
            </div>
            <div className="stat-card">
              <h4>Most Common Situation</h4>
              <span className="capitalize">{stats.most_common_situation}</span>
            </div>
          </div>

          <div className="plots-grid">
            <div className="plot-card">
              <h3>Hourly Traffic Volume</h3>
              <img src={`${API_URL}/plots/hourly.png?t=${timestamp}`} alt="Hourly Traffic" />
            </div>
            <div className="plot-card">
              <h3>Daily Traffic Volume</h3>
              <img src={`${API_URL}/plots/daily.png?t=${timestamp}`} alt="Daily Traffic" />
            </div>
            <div className="plot-card">
              <h3>Traffic Situation Distribution</h3>
              <img src={`${API_URL}/plots/situation.png?t=${timestamp}`} alt="Situation Distribution" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EDAPage;

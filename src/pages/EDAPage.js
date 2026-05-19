import React, { useState, useCallback } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ── per-chart analysis state ─────────────────────────────────────── */
function usePlotAnalysis() {
  const [analyses, setAnalyses] = useState({});   // key → { text, loading, error }

  const fetchAnalysis = useCallback(async (plot) => {
    const { key, title, context } = plot;
    setAnalyses(prev => ({ ...prev, [key]: { text: null, loading: true, error: null } }));
    try {
      const res  = await fetch(`${API_URL}/explain-chart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalyses(prev => ({ ...prev, [key]: { text: data.analysis, loading: false, error: null } }));
    } catch (err) {
      setAnalyses(prev => ({ ...prev, [key]: { text: null, loading: false, error: err.message } }));
    }
  }, []);

  return { analyses, fetchAnalysis };
}

/* ── individual plot card ─────────────────────────────────────────── */
function PlotCard({ plot, timestamp, analyses, fetchAnalysis }) {
  const { key, file, title } = plot;
  const state = analyses[key];
  const analysed = state && (state.text || state.loading || state.error);

  return (
    <div className="eda-plot-card">
      <div className="eda-plot-header">
        <h3 className="eda-plot-title">{title}</h3>
        {!analysed && (
          <button
            className="eda-analyse-btn"
            onClick={() => fetchAnalysis(plot)}
            title="Get AI analysis of this chart"
          >
            ✦ AI Analysis
          </button>
        )}
      </div>

      <img
        src={`${API_URL}/plots/${file}?t=${timestamp}`}
        alt={title}
        className={`eda-plot-img${key === 'situation' ? ' eda-img-donut' : ''}`}
      />

      {analysed && (
        <div className="eda-analysis-panel">
          <div className="eda-analysis-label">
            <span className="eda-analysis-icon">✦</span> AI Analysis
          </div>
          {state.loading && (
            <div className="ai-shimmer">
              <div className="shimmer-line" />
              <div className="shimmer-line short" />
              <div className="shimmer-line" />
            </div>
          )}
          {state.error && (
            <p className="eda-analysis-error">⚠ {state.error}</p>
          )}
          {state.text && (
            <p className="eda-analysis-text">{state.text}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main page ────────────────────────────────────────────────────── */
function EDAPage() {
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState(null);
  const [error,     setError]     = useState(null);
  const [timestamp, setTimestamp] = useState(Date.now());

  const { analyses, fetchAnalysis } = usePlotAnalysis();

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_URL}/run-eda`, { method: 'POST' });
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
      <p className="eda-desc">
        Run our backend Python scripts to generate real-time visual insights from the traffic dataset.
        Each chart can be individually analysed by the AI.
      </p>

      <button
        className={`neon-button ${loading ? 'loading' : ''}`}
        onClick={runAnalysis}
        disabled={loading}
        style={{ maxWidth: '320px', margin: '0 auto' }}
      >
        {loading ? '◌ Analysing Dataset...' : '📊 Run Analysis'}
      </button>

      {error && <div className="error-banner">✕ {error}</div>}

      {stats && (
        <div className="eda-results">

          {/* ── Stats strip ─────────────────────────────────────────── */}
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Records</h4>
              <span>{stats.total_records.toLocaleString()}</span>
            </div>
            <div className="stat-card">
              <h4>Peak Hour</h4>
              <span>{String(stats.peak_hour).padStart(2,'0')}:00</span>
            </div>
            <div className="stat-card">
              <h4>Busiest Day</h4>
              <span>{stats.busiest_day}</span>
            </div>
            <div className="stat-card">
              <h4>Avg Traffic / hr</h4>
              <span>{stats.avg_total_traffic}</span>
            </div>
            <div className="stat-card">
              <h4>Most Common Situation</h4>
              <span className="capitalize">{stats.most_common_situation}</span>
            </div>
          </div>

          {/* ── Plot grid ───────────────────────────────────────────── */}
          <div className="eda-plots-grid">
            {(stats.plots || []).map(plot => (
              <PlotCard
                key={plot.key}
                plot={plot}
                timestamp={timestamp}
                analyses={analyses}
                fetchAnalysis={fetchAnalysis}
              />
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

export default EDAPage;

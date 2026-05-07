import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../index.css';

const VEHICLE_TYPES = [
  { key: 'CarCount',   label: 'Cars',   cls: 'bar-car'   },
  { key: 'BikeCount',  label: 'Bikes',  cls: 'bar-bike'  },
  { key: 'BusCount',   label: 'Buses',  cls: 'bar-bus'   },
  { key: 'TruckCount', label: 'Trucks', cls: 'bar-truck' },
];

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getSituationClass(situation) {
  const s = (situation || '').toLowerCase();
  if (s === 'heavy' || s === 'high') return 'heavy';
  if (s === 'medium') return 'medium';
  return 'low';
}

function getSuggestion(situation) {
  const s = (situation || '').toLowerCase();
  if (s === 'heavy' || s === 'high')
    return { text: '⚠ Peak traffic predicted — consider an alternative route or traveling off-peak.', cls: 'danger' };
  if (s === 'medium')
    return { text: '🟡 Moderate congestion expected. Allow extra travel time.', cls: '' };
  return { text: '✓ Traffic looks clear. Safe travels!', cls: 'safe' };
}

function ClockDial({ hour, onChange }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);

  const angleFromHour = (h) => (h / 24) * 360 - 90;
  const hourAngle = angleFromHour(hour);

  const getHourFromEvent = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return hour;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    return Math.round((angle / 360) * 24) % 24;
  }, [hour]);

  const onMouseDown = (e) => { dragging.current = true; e.preventDefault(); };
  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    onChange(getHourFromEvent(e));
  }, [getHourFromEvent, onChange]);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onMouseMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const r = 80;
  const cx = 100;
  const cy = 100;
  const handLen = 60;
  const handRad = (hourAngle * Math.PI) / 180;
  const hx = cx + handLen * Math.cos(handRad);
  const hy = cy + handLen * Math.sin(handRad);

  const amPm = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const sweepAngle = (hour / 24) * 360;
  const sweepRad = (sweepAngle - 90) * Math.PI / 180;
  const arcX = cx + r * Math.cos(sweepRad);
  const arcY = cy + r * Math.sin(sweepRad);
  const largeArc = sweepAngle > 180 ? 1 : 0;

  const tickMarks = Array.from({ length: 24 }, (_, i) => {
    const a = ((i / 24) * 360 - 90) * Math.PI / 180;
    const inner = i % 6 === 0 ? 66 : 72;
    const outer = 80;
    return {
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      major: i % 6 === 0,
    };
  });

  return (
    <div className="clock-dial-wrapper">
      <div className="clock-label-row">
        <span className="input-label-text">Hour of Day</span>
        <span className="clock-value-badge">
          {String(displayHour).padStart(2, '0')}:00 <span className="ampm">{amPm}</span>
        </span>
      </div>
      <div className="clock-outer-ring">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className="clock-svg"
          onMouseDown={onMouseDown}
          onTouchStart={(e) => { dragging.current = true; onChange(getHourFromEvent(e)); }}
        >
          <defs>
            <radialGradient id="dialGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,243,255,0.04)" />
              <stop offset="100%" stopColor="rgba(0,243,255,0.01)" />
            </radialGradient>
            <filter id="neonBlur">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <circle cx={cx} cy={cy} r={r} fill="url(#dialGrad)" stroke="rgba(0,243,255,0.12)" strokeWidth="1.5" />

          {tickMarks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? 'rgba(0,243,255,0.5)' : 'rgba(0,243,255,0.18)'}
              strokeWidth={t.major ? 1.5 : 0.8} strokeLinecap="round" />
          ))}

          {sweepAngle > 0 && (
            <path
              d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`}
              fill="none"
              stroke="rgba(0,243,255,0.35)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#neonBlur)"
            />
          )}

          <line
            x1={cx} y1={cy}
            x2={hx} y2={hy}
            stroke="var(--cyan)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#neonBlur)"
          />
          <circle cx={cx} cy={cy} r="5" fill="var(--cyan)" filter="url(#neonBlur)" />

          <circle
            cx={hx} cy={hy} r="9"
            fill="rgba(0,0,0,0.7)"
            stroke="var(--cyan)"
            strokeWidth="2"
            filter="url(#neonBlur)"
            style={{ cursor: 'grab' }}
          />
          <circle cx={hx} cy={hy} r="4" fill="var(--cyan)" />
        </svg>
      </div>
      <p className="clock-hint">Drag the handle to set the hour</p>
    </div>
  );
}

function DayPicker({ day, onChange }) {
  return (
    <div className="day-picker-wrapper">
      <span className="input-label-text">Day of Week</span>
      <div className="day-pills">
        {DAY_LABELS.map((d, i) => (
          <button
            key={i}
            type="button"
            className={`day-pill${day === i ? ' active' : ''}`}
            onClick={() => onChange(i)}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function NeonSlider({ id, label, value, min, max, step = 1, unit, icon, onChange, color = 'cyan' }) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="neon-slider-wrapper">
      <div className="slider-label-row">
        <span className="input-label-text">{icon} {label}</span>
        <span className={`slider-value-badge color-${color}`}>
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
          <span className="slider-unit"> {unit}</span>
        </span>
      </div>
      <div className="slider-track-container">
        <div className="slider-track-bg">
          <div
            className={`slider-track-fill color-${color}`}
            style={{ width: `${pct}%` }}
          />
          <div
            className={`slider-thumb color-${color}`}
            style={{ left: `calc(${pct}% - 12px)` }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-native"
        />
      </div>
      <div className="slider-minmax">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function PredictorPage() {
  const [formData, setFormData] = useState({ time: 8, day: 0, rain: 0, clouds: 20 });
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explaining, setExplaining]   = useState(false);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setExplanation(null);

    const hour = Number(formData.time);
    const isPeak = [7, 8, 9, 17, 18, 19, 20].includes(hour);
    const estimatedPrevTraffic = isPeak ? 150 : 50;
    const payload = { ...formData, prev_traffic: estimatedPrevTraffic };

    try {
      const res = await fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      setExplaining(true);
      try {
        const explainRes = await fetch('http://localhost:5000/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...data }),
        });
        const explainData = await explainRes.json();
        setExplanation(explainData.explanation || null);
      } catch (_) {
        setExplanation(null);
      } finally {
        setExplaining(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const situationCls = result ? getSituationClass(result.TrafficSituation) : '';
  const suggestion   = result ? getSuggestion(result.TrafficSituation) : null;
  const maxCount     = result
    ? Math.max(...VEHICLE_TYPES.map((v) => Number(result[v.key]) || 0), 1)
    : 1;

  return (
    <>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="particle-field" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="particle" style={{ '--i': i }} />
        ))}
      </div>

      <div className={`app-wrapper${mounted ? ' mounted' : ''}`}>

        <header className="site-header">
          <span className="eyebrow">AI-Powered Analytics</span>
          <h1>Traffic Congestion<br />Predictor</h1>
          <p className="subtitle">
            Real-time predictions using machine learning — configure conditions below.
          </p>
        </header>

        <div className="main-card">
          <form onSubmit={handleSubmit}>
            <div className="section-title">Input Parameters</div>

            <div className="controls-layout">
              <div className="controls-top-row">
                <ClockDial
                  hour={formData.time}
                  onChange={(h) => setFormData((f) => ({ ...f, time: h }))}
                />
                <DayPicker
                  day={formData.day}
                  onChange={(d) => setFormData((f) => ({ ...f, day: d }))}
                />
              </div>

              <div className="sliders-row">
                <NeonSlider
                  id="rain"
                  label="Rainfall"
                  value={formData.rain}
                  min={0}
                  max={50}
                  step={0.5}
                  unit="mm"
                  icon="🌧"
                  color="blue"
                  onChange={(v) => setFormData((f) => ({ ...f, rain: v }))}
                />
                <NeonSlider
                  id="clouds"
                  label="Cloud Cover"
                  value={formData.clouds}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  icon="☁"
                  color="purple"
                  onChange={(v) => setFormData((f) => ({ ...f, clouds: v }))}
                />
              </div>
            </div>

            <button
              id="predict-btn"
              type="submit"
              className={`neon-button${loading ? ' loading' : ''}`}
              disabled={loading}
            >
              {loading ? '◌  Analysing...' : '⚡  Run Prediction'}
            </button>
          </form>

          {error && (
            <div className="error-banner" role="alert">
              ✕ {error}
            </div>
          )}

          {result && !error && (
            <div className="results-card">
              <div className="section-title">Prediction Results</div>

              <div className="situation-row">
                <span className={`situation-badge ${situationCls}`}>
                  <span className="situation-dot" />
                  {result.TrafficSituation}
                </span>
                <p className={`suggestion-text ${suggestion.cls}`}>
                  {suggestion.text}
                </p>
              </div>

              <div className="section-title">Vehicle Breakdown</div>
              <div className="bars-section">
                {VEHICLE_TYPES.map(({ key, label, cls }) => {
                  const count = Number(result[key]) || 0;
                  const pct   = Math.min((count / maxCount) * 100, 100);
                  return (
                    <div key={key} className={`bar-row ${cls}`}>
                      <span className="bar-label">{label}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="bar-count">{count}</span>
                    </div>
                  );
                })}
              </div>

              {(explaining || explanation) && (
                <div className="ai-analysis-panel">
                  <div className="section-title ai-section-title">AI Analysis</div>
                  {explaining ? (
                    <div className="ai-shimmer">
                      <div className="shimmer-line" />
                      <div className="shimmer-line short" />
                      <div className="shimmer-line" />
                    </div>
                  ) : (
                    <p className="ai-explanation">{explanation}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="footer-line">Traffic Congestion Prediction System &nbsp;·&nbsp; INT428</p>
      </div>
    </>
  );
}

export default PredictorPage;

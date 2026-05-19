import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../index.css';

const VEHICLE_TYPES = [
  { key: 'CarCount',   label: 'Cars',   cls: 'bar-car'   },
  { key: 'BikeCount',  label: 'Bikes',  cls: 'bar-bike'  },
  { key: 'BusCount',   label: 'Buses',  cls: 'bar-bus'   },
  { key: 'TruckCount', label: 'Trucks', cls: 'bar-truck' },
];

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_NAMES  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const EVENT_OPTIONS = ['None', 'Concert', 'Sports Game', 'Roadwork', 'Accident'];
const EVENT_ICONS   = { None: '📍', Concert: '🎵', 'Sports Game': '🏟', Roadwork: '🚧', Accident: '⚠️' };

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
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

function situationColor(s) {
  const lower = (s || '').toLowerCase();
  if (lower === 'heavy') return '#ff4d4d';
  if (lower === 'high')  return '#ff9900';
  if (lower === 'normal')return '#f5c842';
  return '#00f3ff';
}

/* Converts a "HH:MM" 24h string (returned by the backend) to "h:MM AM/PM" */
function fmt12(timeStr) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

/* ─── sub-components ──────────────────────────────────────────────────────── */
function ClockDial({ hour, onChange }) {
  const svgRef  = useRef(null);
  const dragging = useRef(false);
  const angleFromHour = (h) => (h / 24) * 360 - 90;
  const hourAngle = angleFromHour(hour);

  const getHourFromEvent = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return hour;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    return Math.round((angle / 360) * 24) % 24;
  }, [hour]);

  const onMouseDown = (e) => { dragging.current = true; e.preventDefault(); };
  const onMouseMove = useCallback((e) => { if (!dragging.current) return; onChange(getHourFromEvent(e)); }, [getHourFromEvent, onChange]);
  const onMouseUp   = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    window.addEventListener('touchmove', onMouseMove, { passive: false });
    window.addEventListener('touchend',  onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend',  onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const r = 80, cx = 100, cy = 100, handLen = 60;
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
    return { x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a), x2: cx + r * Math.cos(a), y2: cy + r * Math.sin(a), major: i % 6 === 0 };
  });

  return (
    <div className="clock-dial-wrapper">
      <div className="clock-label-row">
        <span className="input-label-text">Hour of Day</span>
        <span className="clock-value-badge">{String(displayHour).padStart(2, '0')}:00 <span className="ampm">{amPm}</span></span>
      </div>
      <div className="clock-outer-ring">
        <svg ref={svgRef} viewBox="0 0 200 200" className="clock-svg"
          onMouseDown={onMouseDown}
          onTouchStart={(e) => { dragging.current = true; onChange(getHourFromEvent(e)); }}>
          <defs>
            <radialGradient id="dialGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(0,243,255,0.04)" />
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
            <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`}
              fill="none" stroke="rgba(0,243,255,0.35)" strokeWidth="4" strokeLinecap="round" filter="url(#neonBlur)" />
          )}
          <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" filter="url(#neonBlur)" />
          <circle cx={cx} cy={cy} r="5" fill="var(--cyan)" filter="url(#neonBlur)" />
          <circle cx={hx} cy={hy} r="9" fill="rgba(0,0,0,0.7)" stroke="var(--cyan)" strokeWidth="2" filter="url(#neonBlur)" style={{ cursor: 'grab' }} />
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
          <button key={i} type="button" className={`day-pill${day === i ? ' active' : ''}`} onClick={() => onChange(i)}>
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
          <div className={`slider-track-fill color-${color}`} style={{ width: `${pct}%` }} />
          <div className={`slider-thumb color-${color}`} style={{ left: `calc(${pct}% - 12px)` }} />
        </div>
        <input id={id} type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))} className="slider-native" />
      </div>
      <div className="slider-minmax"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );
}

function EventPicker({ value, onChange }) {
  return (
    <div className="event-picker-wrapper">
      <span className="input-label-text">📅 Local Events / Anomalies</span>
      <div className="event-pills">
        {EVENT_OPTIONS.map((opt) => (
          <button key={opt} type="button"
            className={`event-pill${value === opt ? ' active' : ''}`}
            onClick={() => onChange(opt)}>
            {EVENT_ICONS[opt]} {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── shared conditions panel ─────────────────────────────────────────────── */
function ConditionsPanel({ formData, setFormData }) {
  return (
    <div className="conditions-panel">
      <div className="section-title">Conditions</div>
      <div className="controls-layout">
        <div className="controls-top-row">
          <ClockDial hour={formData.time} onChange={(h) => setFormData((f) => ({ ...f, time: h }))} />
          <DayPicker day={formData.day}   onChange={(d) => setFormData((f) => ({ ...f, day: d }))} />
        </div>
        <div className="sliders-row">
          <NeonSlider id="rain"   label="Rainfall"    value={formData.rain}   min={0} max={50}  step={0.5} unit="mm" icon="🌧" color="blue"   onChange={(v) => setFormData((f) => ({ ...f, rain: v }))} />
          <NeonSlider id="clouds" label="Cloud Cover" value={formData.clouds} min={0} max={100} step={1}   unit="%" icon="☁" color="purple" onChange={(v) => setFormData((f) => ({ ...f, clouds: v }))} />
        </div>
        <EventPicker value={formData.event_type} onChange={(v) => setFormData((f) => ({ ...f, event_type: v }))} />
      </div>
    </div>
  );
}

/* ─── TAB: Traffic Predictor ──────────────────────────────────────────────── */
function PredictorTab({ formData, setFormData }) {
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explaining,  setExplaining]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null); setExplanation(null);

    const hour = Number(formData.time);
    const isPeak = [7, 8, 9, 17, 18, 19, 20].includes(hour);
    const estimatedPrevTraffic = isPeak ? 150 : 50;
    const payload = { ...formData, prev_traffic: estimatedPrevTraffic };

    try {
      const res  = await fetch(`${API_URL}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      setExplaining(true);
      try {
        const explainRes  = await fetch(`${API_URL}/explain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...data }) });
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
  const maxCount     = result ? Math.max(...VEHICLE_TYPES.map((v) => Number(result[v.key]) || 0), 1) : 1;

  return (
    <form onSubmit={handleSubmit}>
      <ConditionsPanel formData={formData} setFormData={setFormData} />

      <button id="predict-btn" type="submit" className={`neon-button${loading ? ' loading' : ''}`} disabled={loading}>
        {loading ? '◌  Analysing...' : '⚡  Run Prediction'}
      </button>

      {error && <div className="error-banner" role="alert">✕ {error}</div>}

      {result && !error && (
        <div className="results-card">
          <div className="section-title">Prediction Results</div>

          <div className="situation-row">
            <span className={`situation-badge ${situationCls}`}>
              <span className="situation-dot" />
              {result.TrafficSituation}
            </span>
            <p className={`suggestion-text ${suggestion.cls}`}>{suggestion.text}</p>
          </div>

          <div className="section-title">Vehicle Breakdown</div>
          <div className="bars-section">
            {VEHICLE_TYPES.map(({ key, label, cls }) => {
              const count = Number(result[key]) || 0;
              const pct   = Math.min((count / maxCount) * 100, 100);
              return (
                <div key={key} className={`bar-row ${cls}`}>
                  <span className="bar-label">{label}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
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
                  <div className="shimmer-line" /><div className="shimmer-line short" /><div className="shimmer-line" />
                </div>
              ) : (
                <p className="ai-explanation">{explanation}</p>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

/* ─── TAB: Smart Departure ────────────────────────────────────────────────── */
function SmartDepartureTab({ formData, setFormData }) {
  const [arrivalHour,   setArrivalHour]   = useState(18);
  const [travelTime,    setTravelTime]    = useState(30);
  const [options,       setOptions]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  const amPm = (h) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}`;

  const handleCalculate = async () => {
    setLoading(true); setOptions(null); setError(null);
    try {
      const res  = await fetch(`${API_URL}/smart-departure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desired_arrival_time: arrivalHour,
          expected_travel_time_mins: travelTime,
          day:        formData.day,
          rain:       formData.rain,
          clouds:     formData.clouds,
          event_type: formData.event_type,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOptions(data.options);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* ── Primary: Trip Details ── */}
      <div className="section-title">Trip Details</div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', margin: '-8px 0 20px' }}>
        Tell us when you need to arrive and how long the drive normally takes.
      </p>
      <div className="departure-fields-row">
        <div className="departure-field">
          <span className="input-label-text">🏁 Desired Arrival</span>
          <div className="departure-field-display">{amPm(arrivalHour)}</div>
          <div className="slider-track-container" style={{ marginTop: '8px' }}>
            <div className="slider-track-bg">
              <div className="slider-track-fill color-cyan" style={{ width: `${(arrivalHour / 23) * 100}%` }} />
              <div className="slider-thumb color-cyan"      style={{ left: `calc(${(arrivalHour / 23) * 100}% - 12px)` }} />
            </div>
            <input type="range" min={0} max={23} step={1} value={arrivalHour}
              onChange={(e) => setArrivalHour(Number(e.target.value))} className="slider-native" />
          </div>
          <div className="slider-minmax"><span>12:00 AM</span><span>11:00 PM</span></div>
        </div>

        <div className="departure-field">
          <span className="input-label-text">🚗 Normal Travel Time</span>
          <div className="departure-field-display">
            {travelTime} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>mins</span>
          </div>
          <div className="slider-track-container" style={{ marginTop: '8px' }}>
            <div className="slider-track-bg">
              <div className="slider-track-fill color-purple" style={{ width: `${((travelTime - 5) / 295) * 100}%` }} />
              <div className="slider-thumb color-purple"      style={{ left: `calc(${((travelTime - 5) / 295) * 100}% - 12px)` }} />
            </div>
            <input type="range" min={5} max={300} step={5} value={travelTime}
              onChange={(e) => setTravelTime(Number(e.target.value))} className="slider-native" />
          </div>
          <div className="slider-minmax"><span>5 min</span><span>5 hrs</span></div>
        </div>
      </div>

      {/* ── Secondary: Contextual Conditions ── */}
      <div className="section-title" style={{ marginTop: '32px' }}>Contextual Conditions</div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', margin: '-8px 0 20px' }}>
        These affect how traffic behaves during your window — they are factored into the recommendation.
      </p>

      <DayPicker day={formData.day} onChange={(d) => setFormData((f) => ({ ...f, day: d }))} />

      <div className="sliders-row" style={{ marginTop: '16px' }}>
        <NeonSlider id="dep-rain"   label="Rainfall"    value={formData.rain}   min={0} max={50}  step={0.5} unit="mm" icon="🌧" color="blue"   onChange={(v) => setFormData((f) => ({ ...f, rain: v }))} />
        <NeonSlider id="dep-clouds" label="Cloud Cover" value={formData.clouds} min={0} max={100} step={1}   unit="%" icon="☁"  color="purple" onChange={(v) => setFormData((f) => ({ ...f, clouds: v }))} />
      </div>

      <div style={{ marginTop: '16px' }}>
        <EventPicker value={formData.event_type} onChange={(v) => setFormData((f) => ({ ...f, event_type: v }))} />
      </div>

      <button type="button" className={`neon-button${loading ? ' loading' : ''}`} onClick={handleCalculate} disabled={loading} style={{ marginTop: '28px' }}>
        {loading ? '◌  Calculating...' : '🕒  Find Best Departure Time'}
      </button>

      {error && <div className="error-banner" role="alert">✕ {error}</div>}

      {options && (
        <div className="results-card">
          <div className="section-title">Departure Windows</div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: '18px' }}>
            Based on predicted congestion for {DAY_NAMES[formData.day]}{formData.event_type !== 'None' ? ` with a nearby ${formData.event_type}` : ''}.
          </p>
          <div className="departure-options-list">
            {options.map((opt, i) => {
              const sColor = situationColor(opt.traffic_situation);
              return (
                <div key={i} className={`departure-option-card${opt.is_optimal ? ' optimal' : ''}`}>
                  {opt.is_optimal && <div className="optimal-badge">⭐ Recommended</div>}
                  <div className="departure-option-main">
                    <div className="departure-time-block">
                      <div className="dep-label">Depart</div>
                      <div className="dep-time">{fmt12(opt.departure_time)}</div>
                    </div>
                    <div className="departure-arrow">→</div>
                    <div className="departure-time-block">
                      <div className="dep-label">Arrive ~</div>
                      <div className="dep-time">{fmt12(opt.arrival_time)}</div>
                    </div>
                    <div className="departure-meta">
                      <div style={{ color: sColor, fontWeight: 700, fontSize: '0.85rem' }}>
                        {opt.traffic_situation}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>
                        {opt.adjusted_travel_time_mins} mins in traffic
                      </div>
                    </div>
                  </div>
                  <div className="departure-option-bar">
                    <div style={{ width: `${Math.min((opt.adjusted_travel_time_mins / 180) * 100, 100)}%`, height: '3px', background: sColor, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TAB: Fleet Routing ────────────────────────────────────────────────── */
function FleetRoutingTab({ formData, setFormData }) {
  const [startHour, setStartHour] = useState(8);
  const [deliveries, setDeliveries] = useState([
    { id: 1, name: 'Stop A', duration: 45, travel_time: 20, event_type: 'None' },
    { id: 2, name: 'Stop B', duration: 20, travel_time: 15, event_type: 'None' },
    { id: 3, name: 'Stop C', duration: 60, travel_time: 30, event_type: 'None' }
  ]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explaining, setExplaining] = useState(false);

  const handleAddStop = () => {
    setDeliveries([...deliveries, { id: Date.now(), name: `Stop ${String.fromCharCode(65 + deliveries.length)}`, duration: 30, travel_time: 15, event_type: 'None' }]);
  };

  const handleUpdateStop = (id, field, value) => {
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleRemoveStop = (id) => {
    setDeliveries(deliveries.filter(d => d.id !== id));
  };

  const handleCalculate = async () => {
    setLoading(true); setResult(null); setError(null); setExplanation(null);
    try {
      const res = await fetch(`${API_URL}/fleet-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startHour,
          day: formData.day,
          rain: formData.rain,
          clouds: formData.clouds,
          deliveries: deliveries
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      setExplaining(true);
      try {
        const explainRes = await fetch(`${API_URL}/explain-fleet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
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

  const amPm = (h) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}`;

  return (
    <div>
      <div className="section-title">Fleet Dispatch Planner</div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', margin: '-8px 0 20px' }}>
        Optimize delivery routes based on predicted congestion. Add multiple stops to find the best order.
      </p>

      <div className="departure-fields-row">
        <div className="departure-field" style={{ width: '100%', flex: 'none' }}>
          <span className="input-label-text">🕒 Dispatch Time</span>
          <div className="departure-field-display">{amPm(startHour)}</div>
          <div className="slider-track-container" style={{ marginTop: '8px' }}>
            <div className="slider-track-bg">
              <div className="slider-track-fill color-cyan" style={{ width: `${(startHour / 23) * 100}%` }} />
              <div className="slider-thumb color-cyan"      style={{ left: `calc(${(startHour / 23) * 100}% - 12px)` }} />
            </div>
            <input type="range" min={0} max={23} step={1} value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))} className="slider-native" />
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: '32px' }}>Delivery Stops</div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', margin: '-8px 0 12px' }}>
        For each stop, specify the base travel time to reach it, any local anomalies affecting the route, and the service time (unloading).
      </p>
      
      <div className="stops-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {deliveries.map((stop, i) => {
          const travelPct = ((stop.travel_time - 5) / 115) * 100;
          const servicePct = ((stop.duration - 5) / 115) * 100;
          return (
            <div key={stop.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: 'rgba(0,243,255,0.15)', border: '1px solid rgba(0,243,255,0.3)', color: 'var(--cyan)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}</span>
                <input type="text" value={stop.name} onChange={(e) => handleUpdateStop(stop.id, 'name', e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: '600', outline: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px' }} placeholder="e.g. Warehouse A" />
                <button type="button" onClick={() => handleRemoveStop(stop.id)}
                  style={{ background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.3)', color: '#ff4d4d', cursor: 'pointer', fontSize: '1rem', padding: '4px 10px', borderRadius: '6px', flexShrink: 0 }}>✕</button>
              </div>

              {/* Sliders row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Travel time slider */}
                <div className="neon-slider-wrapper">
                  <div className="slider-label-row">
                    <span className="input-label-text">🚗 Travel To</span>
                    <span className="slider-value-badge color-cyan">{stop.travel_time}<span className="slider-unit"> min</span></span>
                  </div>
                  <div className="slider-track-container">
                    <div className="slider-track-bg">
                      <div className="slider-track-fill color-cyan" style={{ width: `${travelPct}%` }} />
                      <div className="slider-thumb color-cyan" style={{ left: `calc(${travelPct}% - 12px)` }} />
                    </div>
                    <input type="range" min={5} max={120} step={5} value={stop.travel_time}
                      onChange={(e) => handleUpdateStop(stop.id, 'travel_time', Number(e.target.value))} className="slider-native" />
                  </div>
                  <div className="slider-minmax"><span>5 min</span><span>2 hrs</span></div>
                </div>

                {/* Service time slider */}
                <div className="neon-slider-wrapper">
                  <div className="slider-label-row">
                    <span className="input-label-text">📦 Service Time</span>
                    <span className="slider-value-badge color-purple">{stop.duration}<span className="slider-unit"> min</span></span>
                  </div>
                  <div className="slider-track-container">
                    <div className="slider-track-bg">
                      <div className="slider-track-fill color-purple" style={{ width: `${servicePct}%` }} />
                      <div className="slider-thumb color-purple" style={{ left: `calc(${servicePct}% - 12px)` }} />
                    </div>
                    <input type="range" min={5} max={120} step={5} value={stop.duration}
                      onChange={(e) => handleUpdateStop(stop.id, 'duration', Number(e.target.value))} className="slider-native" />
                  </div>
                  <div className="slider-minmax"><span>5 min</span><span>2 hrs</span></div>
                </div>

              </div>

              {/* Route event pills */}
              <div className="event-picker-wrapper" style={{ marginTop: '-4px' }}>
                <span className="input-label-text">📍 Route Event on This Leg</span>
                <div className="event-pills">
                  {EVENT_OPTIONS.map(opt => (
                    <button key={opt} type="button"
                      className={`event-pill${stop.event_type === opt ? ' active' : ''}`}
                      onClick={() => handleUpdateStop(stop.id, 'event_type', opt)}>
                      {EVENT_ICONS[opt]} {opt}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
        <button type="button" onClick={handleAddStop}
          style={{ background: 'rgba(0,243,255,0.08)', color: 'var(--cyan)', border: '1px dashed rgba(0,243,255,0.3)', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', letterSpacing: '0.03em', transition: 'all 0.2s' }}>
          ＋ Add Another Stop
        </button>
      </div>

      <div className="section-title" style={{ marginTop: '32px' }}>Global Conditions</div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', margin: '-8px 0 12px' }}>
        These weather patterns apply across all legs of the route.
      </p>
      <DayPicker day={formData.day} onChange={(d) => setFormData((f) => ({ ...f, day: d }))} />
      <div className="sliders-row" style={{ marginTop: '16px' }}>
        <NeonSlider id="fleet-rain" label="Rainfall" value={formData.rain} min={0} max={50} step={0.5} unit="mm" icon="🌧" color="blue" onChange={(v) => setFormData((f) => ({ ...f, rain: v }))} />
        <NeonSlider id="fleet-clouds" label="Cloud Cover" value={formData.clouds} min={0} max={100} step={1} unit="%" icon="☁" color="purple" onChange={(v) => setFormData((f) => ({ ...f, clouds: v }))} />
      </div>

      <button type="button" className={`neon-button${loading ? ' loading' : ''}`} onClick={handleCalculate} disabled={loading || deliveries.length === 0} style={{ marginTop: '28px' }}>
        {loading ? '◌  Optimizing...' : '🚚  Optimize Route'}
      </button>

      {error && <div className="error-banner" role="alert">✕ {error}</div>}

      {result && (
        <div className="results-card" style={{ marginTop: '24px' }}>
          <div className="section-title">Optimized Itinerary</div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(0,255,136,0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Optimized Time</div>
              <div style={{ fontSize: '1.8rem', color: '#00ff88', fontWeight: 'bold' }}>{result.total_optimized_time} <span style={{ fontSize: '1rem' }}>mins</span></div>
            </div>
            {result.time_saved > 0 && (
              <div style={{ flex: 1, background: 'rgba(0,243,255,0.1)', border: '1px solid rgba(0,243,255,0.3)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(0,243,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>Time Saved</div>
                <div style={{ fontSize: '1.8rem', color: '#00f3ff', fontWeight: 'bold' }}>{result.time_saved} <span style={{ fontSize: '1rem' }}>mins</span></div>
              </div>
            )}
            {result.time_saved <= 0 && (
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>Time Saved</div>
                <div style={{ fontSize: '1.8rem', color: '#aaa', fontWeight: 'bold' }}>0 <span style={{ fontSize: '1rem' }}>mins</span></div>
              </div>
            )}
          </div>

          <div className="departure-options-list">
            {result.optimized_timeline.map((leg, i) => {
              const sColor = situationColor(leg.traffic_situation);
              return (
                <div key={i} className="departure-option-card">
                  <div className="departure-option-main">
                    <div className="departure-time-block">
                      <div className="dep-label">Task</div>
                      <div className="dep-time" style={{ fontSize: '1.1rem', color: '#fff' }}>{leg.name}</div>
                    </div>
                    <div className="departure-time-block" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div className="dep-label">Window</div>
                      <div className="dep-time" style={{ fontSize: '0.9rem' }}>{fmt12(leg.departure_time)} – {fmt12(leg.arrival_time)}</div>
                    </div>
                    <div className="departure-meta" style={{ minWidth: '120px' }}>
                      <div style={{ color: sColor, fontWeight: 700, fontSize: '0.85rem' }}>{leg.traffic_situation}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>{leg.adjusted_duration} mins</div>
                    </div>
                  </div>
                  <div className="departure-option-bar">
                    <div style={{ width: `${Math.min((leg.adjusted_duration / 120) * 100, 100)}%`, height: '3px', background: sColor, borderRadius: '2px' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {(explaining || explanation) && (
            <div className="ai-analysis-panel" style={{ marginTop: '24px' }}>
              <div className="section-title ai-section-title">AI Route Analysis</div>
              {explaining ? (
                <div className="ai-shimmer">
                  <div className="shimmer-line" /><div className="shimmer-line short" /><div className="shimmer-line" />
                </div>
              ) : (
                <p className="ai-explanation">{explanation}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
function PredictorPage() {
  const [activeTab, setActiveTab] = useState('predictor');
  const [formData,  setFormData]  = useState({ time: 8, day: 0, rain: 0, clouds: 20, event_type: 'None' });
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const tabs = [
    { id: 'predictor',      label: '⚡ Traffic Predictor' },
    { id: 'smartdeparture', label: '🕒 Smart Departure'   },
    { id: 'fleetrouting',   label: '🚚 Fleet Routing'     },
  ];

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
          <p className="subtitle">Real-time predictions using machine learning — configure conditions below.</p>
        </header>

        {/* ── tab navigation ── */}
        <div className="tool-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tool-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="main-card">
          {activeTab === 'predictor'      && <PredictorTab      formData={formData} setFormData={setFormData} />}
          {activeTab === 'smartdeparture' && <SmartDepartureTab formData={formData} setFormData={setFormData} />}
          {activeTab === 'fleetrouting'   && <FleetRoutingTab   formData={formData} setFormData={setFormData} />}
        </div>

        <p className="footer-line">Traffic Congestion Prediction System &nbsp;·&nbsp; INT428</p>
      </div>
    </>
  );
}

export default PredictorPage;

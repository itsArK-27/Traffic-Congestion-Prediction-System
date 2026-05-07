import React from 'react';
import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="home-page fade-in">
      <section className="hero-section">
        <h1 className="hero-title">Intelligent Traffic<br/>Congestion Prediction</h1>
        <p className="hero-subtitle">
          Leverage advanced Machine Learning models to predict and analyze traffic congestion in real-time. Plan your routes better, avoid delays, and save time.
        </p>
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-value">98%</span>
            <span className="stat-label">Prediction Accuracy</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">&lt;1s</span>
            <span className="stat-label">Analysis Time</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">24/7</span>
            <span className="stat-label">Real-time Insights</span>
          </div>
        </div>
        <Link to="/predictor" className="neon-button cta-btn">
          Start Prediction
        </Link>
      </section>

      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-container">
          <div className="step-card">
            <div className="step-icon">🕒</div>
            <h3>1. Input Conditions</h3>
            <p>Select the time, day, and weather conditions for your journey.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">🧠</div>
            <h3>2. ML Analysis</h3>
            <p>Our ensemble models process the data using historical traffic patterns.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">📊</div>
            <h3>3. Get Insights</h3>
            <p>Receive detailed breakdown of expected vehicles and a traffic situation forecast.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

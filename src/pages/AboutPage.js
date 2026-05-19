import React from 'react';

function AboutPage() {
  return (
    <div className="about-page fade-in">
      <h2 className="section-title">About the Project</h2>
      
      <div className="about-content">
        <section className="about-card">
          <h3>Course & Developer</h3>
          <p><strong>Course:</strong> INT428</p>
          <p><strong>Project:</strong> Traffic Congestion Prediction System</p>
          <p>Developed as a comprehensive domain-specific Generative AI Chatbot and ML solution to predict urban traffic situations.</p>
        </section>

        <section className="about-card">
          <h3>Tech Stack</h3>
          <ul>
            <li><strong>Frontend:</strong> React, React Router, Vanilla CSS</li>
            <li><strong>Backend:</strong> Node.js, Express</li>
            <li><strong>Machine Learning:</strong> Python, scikit-learn (HistGradientBoosting, ExtraTrees, RandomForest), Pandas</li>
            <li><strong>Generative AI:</strong> Groq API (Llama 3) for domain-specific traffic explanations</li>
            <li><strong>Data Visualization:</strong> Matplotlib, Seaborn</li>
          </ul>
        </section>

        <section className="about-card">
          <h3>Architecture</h3>
          <p>
            The system employs a dual-model approach. A regression model estimates individual vehicle counts (cars, bikes, buses, trucks), 
            and a classification model categorizes the overall situation (Low, Normal, High, Heavy).
            A Node.js backend serves predictions and interfaces with a Generative AI model to provide human-readable reasoning.
          </p>
        </section>
      </div>
    </div>
  );
}

export default AboutPage;

# Future Enhancements & TODOs

This document tracks major feature additions and architectural shifts planned for the Traffic Congestion Prediction System to elevate it from a basic ML project to a production-grade application.

## 1. Event & Anomaly Impact (Predicting the "Why") [IN PROGRESS]
**Goal:** Shift from predicting baseline traffic to predicting the *multiplier effect* of anomalies.
*   **Action Items:**
    *   Integrate Event APIs (e.g., PredictHQ, Ticketmaster) or local event datasets.
    *   Feed event data (concerts, sports, accidents, extreme weather warnings) into the ML model.
    *   Adjust the ML model to output a "Congestion Multiplier" or "Anomaly Severity Score" rather than just raw volume.
    *   Update the frontend to show *why* traffic is bad (e.g., "Heavy traffic due to severe rainstorm and local concert").

## 2. Smart Departure Time Engine [IN PROGRESS]
**Goal:** Provide actionable decisions for users rather than just data visualization.
*   **Action Items:**
    *   Create a backend endpoint that takes `destination`, `desired_arrival_time`, and `current_location`.
    *   Use the predictive model to calculate travel times for various departure windows (e.g., leaving now vs. in 30 mins vs. in 1 hr).
    *   Recommend the optimal departure time to guarantee a high probability of arriving on time.
    *   Build a "Smart Commute Planner" UI component on the frontend.

## 3. B2B Fleet Logistics Dashboard [PLANNED]
**Goal:** Pivot the application use-case towards small businesses (delivery, plumbing, etc.) who need route optimization based on predictive traffic.
*   **Action Items:**
    *   Create a bulk-upload feature (CSV) for multiple delivery addresses.
    *   Implement an algorithm that uses the predictive ML model to optimize the *order* of stops based on expected future congestion.
    *   Develop a separate dashboard view ("Fleet Mode") focused on dispatching and route planning.

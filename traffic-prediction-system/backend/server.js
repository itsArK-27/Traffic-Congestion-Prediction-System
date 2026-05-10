require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function runMLPrediction(time, day, rain, clouds, prev_traffic) {
    return new Promise((resolve, reject) => {
        const pythonPath = process.env.PYTHON_PATH || 'python';
        const proc = spawn(pythonPath, ['ml/predict.py', time, day, rain, clouds, prev_traffic]);
        let out = '';
        proc.stdout.on('data', d => out += d.toString());
        proc.stderr.on('data', d => console.error(`Python Error: ${d}`));
        proc.on('close', () => {
            try { resolve(JSON.parse(out)); }
            catch (e) { reject(new Error('Failed to parse ML output')); }
        });
    });
}

function applyConditionsAdjustment(baseResult, rain, clouds, eventType) {
    const rainVal = parseFloat(rain) || 0;
    const cloudsVal = parseFloat(clouds) || 0;

    let eventFactor = 1.0;
    if (eventType === 'Concert') eventFactor = 1.4;
    else if (eventType === 'Sports Game') eventFactor = 1.5;
    else if (eventType === 'Accident') eventFactor = 1.8;
    else if (eventType === 'Roadwork') eventFactor = 1.3;

    if (rainVal === 0 && cloudsVal === 0 && eventFactor === 1.0) return baseResult;

    const rainFactor = 1 + (rainVal * 0.08);
    const cloudFactor = 1 + (cloudsVal * 0.003);
    const combinedFactor = rainFactor * cloudFactor * eventFactor;

    const bikePenalty = Math.max(0.15, 1 - (rainVal * 0.12) - (cloudsVal * 0.002));

    const adjusted = { ...baseResult };
    adjusted.CarCount = Math.round(baseResult.CarCount * combinedFactor);
    adjusted.BusCount = Math.round(baseResult.BusCount * combinedFactor * 0.95);
    adjusted.TruckCount = Math.round(baseResult.TruckCount * combinedFactor * 0.9);
    adjusted.BikeCount = Math.max(1, Math.round(baseResult.BikeCount * bikePenalty));

    const total = adjusted.CarCount + adjusted.BikeCount + adjusted.BusCount + adjusted.TruckCount;

    if (total > 250 || rainVal > 8 || eventFactor >= 1.5) {
        adjusted.TrafficSituation = 'Heavy';
    } else if (total > 180 || rainVal > 4 || eventFactor >= 1.3) {
        adjusted.TrafficSituation = 'High';
    } else if (total > 90) {
        adjusted.TrafficSituation = 'Normal';
    } else {
        adjusted.TrafficSituation = 'Low';
    }

    return adjusted;
}

app.post('/predict', async (req, res) => {
    const { time, day, rain, clouds, prev_traffic, event_type } = req.body;

    try {
        const baseResult = await runMLPrediction(time, day, 0, 0, prev_traffic);

        if (baseResult.error) return res.json(baseResult);

        const finalResult = applyConditionsAdjustment(baseResult, rain, clouds, event_type);
        res.json(finalResult);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Smart Departure Engine ──────────────────────────────────────────────────
app.post('/smart-departure', async (req, res) => {
    const { desired_arrival_time, expected_travel_time_mins, day, rain, clouds, event_type } = req.body;

    if (desired_arrival_time === undefined || !expected_travel_time_mins) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Evaluate departure times: -60m, -30m, 0m (optimal baseline), +30m
    const options = [-60, -30, 0, 30];
    const results = [];

    try {
        for (let offset of options) {
            // Calculate hypothetical departure time
            let arrivalHour = parseInt(desired_arrival_time);
            let totalTravelMins = expected_travel_time_mins;
            
            // Adjust departure time backwards from arrival time
            let depHourStr = arrivalHour;
            let depMinStr = 60 - totalTravelMins + offset; // rough approx
            
            // For ML model we just need the hour
            let testHour = Math.floor(arrivalHour - (totalTravelMins - offset) / 60);
            if (testHour < 0) testHour += 24;
            if (testHour > 23) testHour -= 24;

            const isPeak = [7, 8, 9, 17, 18, 19, 20].includes(testHour);
            const prev_traffic = isPeak ? 150 : 50;

            const baseResult = await runMLPrediction(testHour, day, 0, 0, prev_traffic);
            if (baseResult.error) continue;

            const finalResult = applyConditionsAdjustment(baseResult, rain, clouds, event_type);
            
            // Calculate travel time multiplier based on traffic
            let travelMultiplier = 1.0;
            if (finalResult.TrafficSituation === 'Heavy') travelMultiplier = 1.8;
            else if (finalResult.TrafficSituation === 'High') travelMultiplier = 1.4;
            else if (finalResult.TrafficSituation === 'Low') travelMultiplier = 0.9;

            let adjustedTravelTime = Math.round(expected_travel_time_mins * travelMultiplier);
            
            // Recommended departure time (string format HH:MM)
            let actualArrivalMins = arrivalHour * 60 + offset;
            let recommendedDepMins = actualArrivalMins - adjustedTravelTime;
            
            let depH = Math.floor(recommendedDepMins / 60);
            let depM = recommendedDepMins % 60;
            if (depH < 0) depH += 24;
            if (depM < 0) { depM += 60; depH -= 1; }
            
            let arrH = Math.floor(actualArrivalMins / 60);
            let arrM = actualArrivalMins % 60;
            if (arrH < 0) arrH += 24;
            if (arrM < 0) { arrM += 60; arrH -= 1; }

            results.push({
                offset_mins: offset,
                departure_time: `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`,
                arrival_time: `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`,
                adjusted_travel_time_mins: adjustedTravelTime,
                traffic_situation: finalResult.TrafficSituation,
                is_optimal: false // will set later
            });
        }

        // Determine optimal (closest to desired arrival time without being late, shortest travel time)
        results.sort((a, b) => a.adjusted_travel_time_mins - b.adjusted_travel_time_mins);
        results[0].is_optimal = true;
        
        // Sort back by departure time
        results.sort((a, b) => a.offset_mins - b.offset_mins);

        res.json({ options: results });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── B2B Fleet Routing Engine ──────────────────────────────────────────────────
app.post('/fleet-routing', async (req, res) => {
    const { start_time, day, rain, clouds, deliveries } = req.body;

    if (start_time === undefined || !deliveries || !Array.isArray(deliveries)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const basePredictions = {};
        for (let i = 0; i < 12; i++) {
            let hour = (parseInt(start_time) + i) % 24;
            const isPeak = [7, 8, 9, 17, 18, 19, 20].includes(hour);
            const prev_traffic = isPeak ? 150 : 50;
            const baseResult = await runMLPrediction(hour, day, 0, 0, prev_traffic);
            basePredictions[hour] = baseResult;
        }

        function calculateTimeline(order) {
            let currentMins = parseInt(start_time) * 60;
            let totalAdjusted = 0;
            const timeline = [];

            for (let stop of order) {
                let depH = Math.floor(currentMins / 60) % 24;
                let depM = currentMins % 60;

                let travelHour = Math.floor(currentMins / 60) % 24;
                let baseResult = basePredictions[travelHour];
                
                let situation = 'Normal';
                let multiplier = 1.0;
                
                if (baseResult && !baseResult.error) {
                    const finalResult = applyConditionsAdjustment(baseResult, rain, clouds, stop.event_type || 'None');
                    situation = finalResult.TrafficSituation;
                    if (situation === 'Heavy') multiplier = 1.8;
                    else if (situation === 'High') multiplier = 1.4;
                    else if (situation === 'Low') multiplier = 0.9;
                }
                
                let adjustedTravel = Math.round((stop.travel_time || 15) * multiplier);
                
                currentMins += adjustedTravel;
                currentMins += stop.duration; // Service time is NOT affected by traffic

                let arrH = Math.floor(currentMins / 60) % 24;
                let arrM = currentMins % 60;
                let legTotal = adjustedTravel + stop.duration;

                timeline.push({
                    ...stop,
                    departure_time: `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`,
                    arrival_time: `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`,
                    adjusted_duration: legTotal,
                    traffic_situation: situation,
                    travel_time_adjusted: adjustedTravel
                });
                totalAdjusted += legTotal;
            }
            return { timeline, totalAdjusted };
        }

        let bestOrder = null;
        let bestTime = Infinity;
        let bestTimeline = null;
        
        const getPermutations = (arr) => {
            if (arr.length <= 1) return [arr];
            const result = [];
            for (let i = 0; i < arr.length; i++) {
                const rest = getPermutations(arr.slice(0, i).concat(arr.slice(i + 1)));
                for (let j = 0; j < rest.length; j++) {
                    result.push([arr[i]].concat(rest[j]));
                }
            }
            return result;
        };

        let perms = [];
        if (deliveries.length <= 6) {
            perms = getPermutations(deliveries);
        } else {
            perms = [deliveries];
        }

        for (let perm of perms) {
            const { timeline, totalAdjusted } = calculateTimeline(perm);
            if (totalAdjusted < bestTime) {
                bestTime = totalAdjusted;
                bestOrder = perm;
                bestTimeline = timeline;
            }
        }
        
        const original = calculateTimeline(deliveries);

        res.json({
            optimized_timeline: bestTimeline,
            total_optimized_time: bestTime,
            original_time: original.totalAdjusted,
            time_saved: original.totalAdjusted - bestTime
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/run-eda', (req, res) => {
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const proc = spawn(pythonPath, ['ml/eda.py']);
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => console.error(`EDA Python Error: ${d}`));
    proc.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'EDA script failed to run' });
        }
        try {
            const fs = require('fs');
            const path = require('path');
            const statsPath = path.join(__dirname, 'public', 'plots', 'stats.json');
            const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            res.json(stats);
        } catch (e) {
            res.status(500).json({ error: 'Failed to read EDA output' });
        }
    });
});

// ─── Groq Explain Endpoint ──────────────────────────────────────────────────
app.post('/explain', async (req, res) => {
    const { time, day, rain, clouds, CarCount, BikeCount, BusCount, TruckCount, TrafficSituation } = req.body;

    const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const dayName = DAY_NAMES[Number(day)] ?? 'Unknown';
    const totalVehicles = Number(CarCount) + Number(BikeCount) + Number(BusCount) + Number(TruckCount);

    const systemPrompt = `You are a traffic analysis assistant for an urban traffic congestion prediction system. Focus strictly on traffic engineering reasoning — do not discuss anything outside of traffic and transportation analysis.`;

    const userPrompt = `Analyze the following prediction output and provide a single, concise paragraph (3-4 sentences) explaining why the traffic situation is "${TrafficSituation}" given the conditions.

Input conditions:
- Time of day: ${time}:00
- Day: ${dayName}
- Rainfall: ${rain} mm
- Cloud cover: ${clouds}%

Predicted vehicle counts:
- Cars: ${CarCount}
- Bikes: ${BikeCount}
- Buses: ${BusCount}
- Trucks: ${TruckCount}
- Total vehicles: ${totalVehicles}
- Traffic situation: ${TrafficSituation}

Provide only the explanatory paragraph. Do not use bullet points, headings, or any markdown formatting.`;

    try {
        console.log('[API REQUEST] Sending request to Groq API...');
        console.log(`  Model      : llama-3.3-70b-versatile`);
        console.log(`  Temperature: 0.7`);
        console.log(`  Top-p      : 0.9`);
        console.log(`  Max Tokens : 200`);

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                top_p: 0.9,
                max_tokens: 200,
            }),
        });

        const data = await groqRes.json();

        if (!groqRes.ok) throw new Error(data.error?.message || 'Groq API request failed');

        const text = data.choices?.[0]?.message?.content || '';

        console.log(`[API RESPONSE] Status: ${groqRes.status} OK`);
        console.log(`  Model Used    : ${data.model}`);
        console.log(`  Prompt Tokens : ${data.usage?.prompt_tokens}`);
        console.log(`  Response Tokens: ${data.usage?.completion_tokens}`);
        console.log(`  Explanation   : "${text.trim().slice(0, 120)}..."`);

        res.json({ explanation: text.trim() });
    } catch (err) {
        console.error('Groq error:', err.message);
        res.status(500).json({ error: 'Failed to generate explanation.' });
    }
});

// ─── Groq Fleet Routing Explanation Endpoint ────────────────────────────────
app.post('/explain-fleet', async (req, res) => {
    const { optimized_timeline, total_optimized_time, time_saved } = req.body;
    
    if (!optimized_timeline || !Array.isArray(optimized_timeline)) {
        return res.status(400).json({ error: 'Missing optimized_timeline' });
    }

    const systemPrompt = `You are an expert logistics and traffic dispatch assistant. Keep your response to a single, concise paragraph (3-4 sentences). Focus strictly on how the route timing avoids peak congestion.`;

    const summaryStr = optimized_timeline.map(leg => `${leg.name}: ${leg.departure_time}-${leg.arrival_time} (${leg.traffic_situation})`).join(', ');

    const userPrompt = `Explain why this delivery itinerary is optimal.
Total optimized time: ${total_optimized_time} mins. Time saved vs original order: ${time_saved} mins.
Timeline: ${summaryStr}.
Write a single paragraph explaining how rearranging the stops minimized exposure to heavy traffic. No markdown formatting.`;

    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                top_p: 0.9,
                max_tokens: 200,
            }),
        });

        const data = await groqRes.json();
        if (!groqRes.ok) throw new Error(data.error?.message || 'Groq API request failed');
        const text = data.choices?.[0]?.message?.content || '';
        res.json({ explanation: text.trim() });
    } catch (err) {
        console.error('Groq fleet explain error:', err.message);
        res.status(500).json({ error: 'Failed to generate explanation.' });
    }
});

// ─── Groq Chart Analysis Endpoint ────────────────────────────────────────────
app.post('/explain-chart', async (req, res) => {
    const { title, context } = req.body;
    if (!title || !context) return res.status(400).json({ error: 'Missing title or context' });

    const systemPrompt = `You are a data analyst specialising in urban traffic engineering. Provide clear, insightful analysis of traffic charts. Focus strictly on what the data reveals about traffic patterns — no generic filler, no markdown formatting.`;

    const userPrompt = `Analyse the following traffic dataset chart and write a concise paragraph (3-4 sentences) explaining the key insight it reveals, any notable patterns or anomalies, and what it means for urban traffic management.

Chart: ${title}
Data summary: ${context}

Write only the analysis paragraph. No bullet points, no headings, no markdown.`;

    try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt   },
                ],
                temperature: 0.65,
                top_p: 0.9,
                max_tokens: 220,
            }),
        });

        const data = await groqRes.json();
        if (!groqRes.ok) throw new Error(data.error?.message || 'Groq API request failed');
        const text = data.choices?.[0]?.message?.content || '';
        console.log(`[CHART ANALYSIS] "${title}" → ${text.trim().slice(0, 80)}...`);
        res.json({ analysis: text.trim() });
    } catch (err) {
        console.error('Chart explain error:', err.message);
        res.status(500).json({ error: 'Failed to generate chart analysis.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

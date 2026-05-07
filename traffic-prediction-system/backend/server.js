require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function runMLPrediction(time, day, rain, clouds, prev_traffic) {
    return new Promise((resolve, reject) => {
        const pythonPath = 'C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
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

function applyWeatherAdjustment(baseResult, rain, clouds) {
    const rainVal = parseFloat(rain) || 0;
    const cloudsVal = parseFloat(clouds) || 0;

    if (rainVal === 0 && cloudsVal === 0) return baseResult;

    const rainFactor = 1 + (rainVal * 0.08);
    const cloudFactor = 1 + (cloudsVal * 0.003);
    const combinedFactor = rainFactor * cloudFactor;

    const bikePenalty = Math.max(0.15, 1 - (rainVal * 0.12) - (cloudsVal * 0.002));

    const adjusted = { ...baseResult };
    adjusted.CarCount = Math.round(baseResult.CarCount * combinedFactor);
    adjusted.BusCount = Math.round(baseResult.BusCount * combinedFactor * 0.95);
    adjusted.TruckCount = Math.round(baseResult.TruckCount * combinedFactor * 0.9);
    adjusted.BikeCount = Math.max(1, Math.round(baseResult.BikeCount * bikePenalty));

    const total = adjusted.CarCount + adjusted.BikeCount + adjusted.BusCount + adjusted.TruckCount;

    if (total > 250 || rainVal > 8) {
        adjusted.TrafficSituation = 'Heavy';
    } else if (total > 180 || rainVal > 4) {
        adjusted.TrafficSituation = 'High';
    } else if (total > 90) {
        adjusted.TrafficSituation = 'Normal';
    } else {
        adjusted.TrafficSituation = 'Low';
    }

    return adjusted;
}

app.post('/predict', async (req, res) => {
    const { time, day, rain, clouds, prev_traffic } = req.body;

    try {
        const baseResult = await runMLPrediction(time, day, 0, 0, prev_traffic);

        if (baseResult.error) return res.json(baseResult);

        const finalResult = applyWeatherAdjustment(baseResult, rain, clouds);
        res.json(finalResult);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/run-eda', (req, res) => {
    const pythonPath = 'C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
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

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

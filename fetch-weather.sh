#!/bin/bash

echo "🌤️  Fetching historical weather data for Dubai (Dec 2023)..."

# The API URL with our specific query parameters
API_URL="https://archive-api.open-meteo.com/v1/archive?latitude=25.2048&longitude=55.2708&start_date=2023-12-01&end_date=2023-12-31&hourly=precipitation,cloud_cover&timezone=auto"

# Use curl to download the data silently (-s) and save it to a JSON file
curl -s -o dubai_weather.json "$API_URL"

echo "✅ Success! Data saved to dubai_weather.json"

echo "Here is a sneak peek of the data:"
head -n 15 dubai_weather.json
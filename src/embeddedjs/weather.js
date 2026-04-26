/** weather.js - Fetch weather data via phone proxy and cache results */

import Location from "embedded:sensor/Location";

const CACHE_KEY_TEMP = "weather_temp";
const CACHE_KEY_TIME = "weather_time";
const CACHE_KEY_UNIT = "weather_unit";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let currentTemp = null;
let currentUnit = "C";
let onUpdate = null;
let refreshTimer = null;

function getCachedWeather() {
    const temp = localStorage.getItem(CACHE_KEY_TEMP);
    const time = localStorage.getItem(CACHE_KEY_TIME);
    const unit = localStorage.getItem(CACHE_KEY_UNIT);
    if (temp !== null && time !== null) {
        const age = Date.now() - parseInt(time, 10);
        if (age < REFRESH_INTERVAL_MS) {
            return { temp: parseFloat(temp), unit: unit || "C", age: age };
        }
    }
    return null;
}

function cacheWeather(temp, unit) {
    localStorage.setItem(CACHE_KEY_TEMP, String(temp));
    localStorage.setItem(CACHE_KEY_TIME, String(Date.now()));
    localStorage.setItem(CACHE_KEY_UNIT, unit);
}

function celsiusToFahrenheit(c) {
    return Math.round((c * 9 / 5) + 32);
}

export async function fetchWeather(useFahrenheit) {
    if (!watch.connected.pebblekit) {
        console.log("Weather: phone proxy not ready, using cache");
        const cached = getCachedWeather();
        if (cached) {
            currentTemp = cached.temp;
            currentUnit = cached.unit;
            if (onUpdate) onUpdate();
        }
        return;
    }

    try {
        const location = new Location({
            onSample() {
                const sample = this.sample();
                this.close();
                fetchFromAPI(sample.latitude, sample.longitude, useFahrenheit);
            }
        });
    } catch (e) {
        console.log("Weather: location error: " + e);
        const cached = getCachedWeather();
        if (cached) {
            currentTemp = cached.temp;
            currentUnit = cached.unit;
            if (onUpdate) onUpdate();
        }
    }
}

async function fetchFromAPI(lat, lon, useFahrenheit) {
    try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.search = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon),
            current: "temperature_2m"
        });

        const response = await fetch(url);
        if (!response.ok) throw new Error("HTTP " + response.status);

        const data = await response.json();
        const tempC = data.current.temperature_2m;
        const temp = useFahrenheit ? celsiusToFahrenheit(tempC) : Math.round(tempC);
        const unit = useFahrenheit ? "F" : "C";

        currentTemp = temp;
        currentUnit = unit;
        cacheWeather(temp, unit);

        if (onUpdate) onUpdate();

        // Schedule next refresh
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => fetchWeather(useFahrenheit), REFRESH_INTERVAL_MS);
    } catch (e) {
        console.log("Weather: fetch error: " + e);
        const cached = getCachedWeather();
        if (cached) {
            currentTemp = cached.temp;
            currentUnit = cached.unit;
            if (onUpdate) onUpdate();
        }
    }
}

export function getCurrentTemp() {
    return currentTemp;
}

export function getCurrentUnit() {
    return currentUnit;
}

export function setOnUpdate(callback) {
    onUpdate = callback;
}

export function initWeather(useFahrenheit) {
    const cached = getCachedWeather();
    if (cached) {
        currentTemp = cached.temp;
        currentUnit = cached.unit;
    }
    fetchWeather(useFahrenheit);
}

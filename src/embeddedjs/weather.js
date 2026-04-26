/** weather.js - Weather data via app messages to phone PKJS */

const CACHE_KEY_TEMP = "weather_temp";
const CACHE_KEY_TIME = "weather_time";
const CACHE_KEY_UNIT = "weather_unit";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let currentTemp = null;
let currentUnit = "C";
let onUpdate = null;

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

export function setWeatherData(temp, unit) {
    currentTemp = temp;
    currentUnit = unit;
    cacheWeather(temp, unit);
    if (onUpdate) onUpdate();
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
    // Load cached weather if available
    const cached = getCachedWeather();
    if (cached) {
        currentTemp = cached.temp;
        currentUnit = cached.unit;
    }

    // Request fresh weather from phone via app message
    if (globalThis.watch && globalThis.watch.connected && globalThis.watch.connected.app) {
        requestWeatherFromPhone(useFahrenheit);
    }
}

function requestWeatherFromPhone(useFahrenheit) {
    try {
        // Send request to PKJS via app message
        const msg = new (require("pebble/message"))({
            keys: ["WeatherRequest", "WeatherTemp", "WeatherUnit"]
        });
        if (msg.writable) {
            msg.write(new Map([["WeatherRequest", useFahrenheit ? 1 : 0]]));
        }
    } catch (e) {
        console.log("Weather request error: " + e);
    }
}

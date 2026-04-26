/** main.js - ModernClassic analog watchface (single file) */

import Poco from "commodetto/Poco";
import Message from "pebble/message";

console.log("main.js loading");

// ===== SETTINGS =====
const DEFAULTS = {
    BackgroundColor: "#000000",
    DialColor: "#AAAAAA",
    NumberColor: "#FFFFFF",
    HourHandColor: "#FFFFFF",
    MinuteHandColor: "#DDDDDD",
    DateColor: "#FFFFFF",
    ComplicationColor: "#888888",
    UseFahrenheit: false
};

function hexToRgb(hex) {
    if (typeof hex === "number") {
        const val = hex & 0xFFFFFF;
        return {
            r: (val >> 16) & 0xFF,
            g: (val >> 8) & 0xFF,
            b: val & 0xFF
        };
    }
    const str = String(hex).replace("#", "");
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(str);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function loadSettings() {
    const settings = {};
    for (const key in DEFAULTS) {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            settings[key] = key === "UseFahrenheit" ? stored === "true" : stored;
        } else {
            settings[key] = DEFAULTS[key];
        }
    }
    return settings;
}

function saveSettings(settings) {
    for (const key in settings) {
        localStorage.setItem(key, key === "UseFahrenheit" ? String(settings[key]) : settings[key]);
    }
}

function parseColor(render, hex) {
    const rgb = hexToRgb(hex);
    return render.makeColor(rgb.r, rgb.g, rgb.b);
}

function applySettingsFromMessage(msg) {
    const settings = loadSettings();
    msg.forEach((value, key) => {
        if (key in DEFAULTS) settings[key] = value;
    });
    saveSettings(settings);
    return settings;
}

// ===== BATTERY =====
let batteryPercent = 100;
let isCharging = false;
let isPlugged = false;

function getArcColor(render) {
    if (batteryPercent > 50) return render.makeColor(0, 200, 0);
    if (batteryPercent > 20) return render.makeColor(220, 200, 0);
    return render.makeColor(220, 0, 0);
}

function getArcAngles() {
    return { start: 0, end: Math.floor(batteryPercent * 3.6) };
}

// ===== WEATHER =====
let currentTemp = null;
let currentUnit = "C";

function setWeatherData(temp, unit) {
    currentTemp = temp;
    currentUnit = unit;
    localStorage.setItem("weather_temp", String(temp));
    localStorage.setItem("weather_time", String(Date.now()));
    localStorage.setItem("weather_unit", unit);
}

function loadCachedWeather() {
    const temp = localStorage.getItem("weather_temp");
    const time = localStorage.getItem("weather_time");
    const unit = localStorage.getItem("weather_unit");
    if (temp !== null && time !== null) {
        const age = Date.now() - parseInt(time, 10);
        if (age < 30 * 60 * 1000) {
            currentTemp = parseFloat(temp);
            currentUnit = unit || "C";
        }
    }
}

function requestWeatherFromPhone(useFahrenheit) {
    try {
        const msg = new Message({
            keys: ["WeatherRequest", "WeatherTemp", "WeatherUnit"]
        });
        if (msg.writable) {
            msg.write(new Map([["WeatherRequest", useFahrenheit ? 1 : 0]]));
        }
    } catch (e) {
        console.log("Weather request error: " + e);
    }
}

// ===== RENDERER =====
const render = new Poco(screen);
const CX = Math.floor(render.width / 2);
const CY = Math.floor(render.height / 2);
const DIAL_RADIUS = Math.min(CX, CY) - 8;

let numFont, dateFont, compFont;
try {
    numFont = new render.Font("Leco-Regular", 20);
    dateFont = new render.Font("Gothic-Regular", 14);
    compFont = new render.Font("Gothic-Regular", 14);
    console.log("Fonts OK");
} catch (e) {
    console.log("Font error: " + e);
}

let settings = loadSettings();
console.log("Settings loaded");

function color(hex) {
    return parseColor(render, hex);
}

function drawDial() {
    const dialColor = color(settings.DialColor);
    const bgColor = color(settings.BackgroundColor);
    const numColor = color(settings.NumberColor);

    render.fillRectangle(bgColor, 0, 0, render.width, render.height);
    render.drawCircle(dialColor, CX, CY, DIAL_RADIUS, 0, 360);

    for (let i = 0; i < 60; i++) {
        const angle = (i * 6) - 90;
        const radians = angle * Math.PI / 180;
        const isHour = (i % 5 === 0);
        const tickLen = isHour ? 12 : 6;
        const tickWidth = isHour ? 2 : 1;
        const innerR = DIAL_RADIUS - tickLen;
        const outerR = DIAL_RADIUS - 2;

        const x1 = CX + Math.cos(radians) * innerR;
        const y1 = CY + Math.sin(radians) * innerR;
        const x2 = CX + Math.cos(radians) * outerR;
        const y2 = CY + Math.sin(radians) * outerR;

        render.drawLine(x1, y1, x2, y2, dialColor, tickWidth);
    }

    const numRadius = DIAL_RADIUS - 28;
    for (let n = 1; n <= 12; n++) {
        const angle = (n * 30) - 90;
        const radians = angle * Math.PI / 180;
        const nx = CX + Math.cos(radians) * numRadius;
        const ny = CY + Math.sin(radians) * numRadius;

        const numStr = String(n);
        const tw = render.getTextWidth(numStr, numFont);
        const th = numFont.height;
        render.drawText(numStr, numFont, numColor, nx - tw / 2, ny - th / 2);
    }
}

function drawDate() {
    const now = new Date();
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = monthNames[now.getMonth()] + " " + now.getDate();
    const dateColor = color(settings.DateColor);
    const tw = render.getTextWidth(dateStr, dateFont);
    const y = CY - DIAL_RADIUS + 45;
    render.drawText(dateStr, dateFont, dateColor, CX - tw / 2, y);
}

function drawHands(date) {
    const hourColor = color(settings.HourHandColor);
    const minuteColor = color(settings.MinuteHandColor);
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const hourAngle = (hours * 30 + minutes * 0.5) - 90;
    const minuteAngle = (minutes * 6) - 90;

    const hourRad = hourAngle * Math.PI / 180;
    const hourLen = Math.floor(DIAL_RADIUS * 0.45);
    render.drawLine(CX, CY,
        CX + Math.cos(hourRad) * hourLen,
        CY + Math.sin(hourRad) * hourLen,
        hourColor, 5);

    const minRad = minuteAngle * Math.PI / 180;
    const minLen = Math.floor(DIAL_RADIUS * 0.70);
    render.drawLine(CX, CY,
        CX + Math.cos(minRad) * minLen,
        CY + Math.sin(minRad) * minLen,
        minuteColor, 3);

    render.drawCircle(color(settings.DialColor), CX, CY, 4, 0, 360);
}

function drawComplications() {
    const compColor = color(settings.ComplicationColor);
    const textColor = color(settings.NumberColor);
    const compRadius = 22;

    // Weather (left)
    const weatherX = CX - Math.floor(DIAL_RADIUS * 0.55);
    const weatherY = CY;
    render.drawCircle(compColor, weatherX, weatherY, compRadius, 0, 360);
    if (currentTemp !== null) {
        const tempStr = currentTemp + "°" + currentUnit;
        const tw = render.getTextWidth(tempStr, compFont);
        render.drawText(tempStr, compFont, textColor, weatherX - tw / 2, weatherY - compFont.height / 2);
    } else {
        const dash = "--";
        const tw = render.getTextWidth(dash, compFont);
        render.drawText(dash, compFont, textColor, weatherX - tw / 2, weatherY - compFont.height / 2);
    }

    // Battery (right)
    const batteryX = CX + Math.floor(DIAL_RADIUS * 0.55);
    const batteryY = CY;
    const arcColor = getArcColor(render);
    const angles = getArcAngles();

    render.drawCircle(compColor, batteryX, batteryY, compRadius, 0, 360);
    render.drawCircle(arcColor, batteryX, batteryY, compRadius - 4, angles.start - 90, angles.end - 90);

    const battStr = batteryPercent + "%";
    const bw = render.getTextWidth(battStr, compFont);
    render.drawText(battStr, compFont, textColor, batteryX - bw / 2, batteryY - compFont.height / 2);
}

function draw(date) {
    render.begin();
    drawDial();
    drawDate();
    drawHands(date);
    drawComplications();
    render.end();
}

// ===== EVENTS & INIT =====
function onMinuteChange(e) {
    console.log("minutechange");
    draw(e.date);
}

function onBatteryUpdate() {
    draw(new Date());
}

function onWeatherUpdate() {
    draw(new Date());
}

const msg = new Message({
    keys: ["BackgroundColor","DialColor","NumberColor","HourHandColor",
           "MinuteHandColor","DateColor","ComplicationColor","UseFahrenheit",
           "WeatherRequest","WeatherTemp","WeatherUnit"],
    onReadable() {
        const m = this.read();
        let needsRedraw = false;

        let weatherTemp = null;
        let weatherUnit = null;
        m.forEach((value, key) => {
            if (key === "WeatherTemp") weatherTemp = value;
            if (key === "WeatherUnit") weatherUnit = value;
        });
        if (weatherTemp !== null && weatherUnit !== null) {
            setWeatherData(weatherTemp, weatherUnit);
            needsRedraw = true;
        }

        const hasSettings = m.has("BackgroundColor") || m.has("DialColor") ||
                            m.has("NumberColor") || m.has("HourHandColor") ||
                            m.has("MinuteHandColor") || m.has("DateColor") ||
                            m.has("ComplicationColor") || m.has("UseFahrenheit");
        if (hasSettings) {
            settings = applySettingsFromMessage(m);
            requestWeatherFromPhone(settings.UseFahrenheit);
            needsRedraw = true;
        }

        if (needsRedraw) draw(new Date());
    },
    onWritable() { console.log("msg ready"); },
    onSuspend() { console.log("msg suspended"); }
});

// Init battery
try {
    const Battery = require("embedded:sensor/Battery");
    const batt = new Battery({
        onSample() {
            const s = this.sample();
            batteryPercent = s.percent;
            isCharging = s.charging;
            isPlugged = s.plugged;
            onBatteryUpdate();
        }
    });
    const initial = batt.sample();
    batteryPercent = initial.percent;
    isCharging = initial.charging;
    isPlugged = initial.plugged;
    console.log("Battery: " + batteryPercent + "%");
} catch (e) {
    console.log("Battery init error: " + e);
}

// Init weather
loadCachedWeather();

// Init watch events
const watchGlobal = globalThis.watch;
if (watchGlobal) {
    watchGlobal.addEventListener("minutechange", onMinuteChange);
    console.log("Watch events registered");
} else {
    console.log("watch global missing");
}

// Initial draw
draw(new Date());
console.log("main.js done");

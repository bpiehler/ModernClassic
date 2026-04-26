/** main.js - ModernClassic analog watchface renderer */

import Poco from "commodetto/Poco";
import Message from "pebble/message";
import * as Settings from "settings";
import * as Battery from "battery";
import * as Weather from "weather";

console.log("main.js loading");

const render = new Poco(screen);

console.log("Poco created, screen size: " + render.width + "x" + render.height);

// Screen geometry
const CX = Math.floor(render.width / 2);
const CY = Math.floor(render.height / 2);
const DIAL_RADIUS = Math.min(CX, CY) - 8;  // Leave margin for round screen

console.log("Dial center: " + CX + "," + CY + " radius: " + DIAL_RADIUS);

// Fonts (use known-available Pebble sizes)
let numFont, dateFont, compFont;
try {
    numFont = new render.Font("Leco-Regular", 20);
    dateFont = new render.Font("Gothic-Regular", 14);
    compFont = new render.Font("Gothic-Regular", 14);
    console.log("Fonts loaded successfully");
} catch (e) {
    console.log("Font error: " + e);
}

// Load settings
let settings = Settings.loadSettings();
console.log("Settings loaded: " + JSON.stringify(settings));

// Helper: parse hex color for Poco
function color(render, hex) {
    return Settings.parseColor(render, hex);
}

// ===== DRAW FUNCTIONS =====

function drawDial() {
    const dialColor = color(render, settings.DialColor);
    const bgColor = color(render, settings.BackgroundColor);
    const numColor = color(render, settings.NumberColor);

    // Background
    render.fillRectangle(bgColor, 0, 0, render.width, render.height);

    // Outer dial ring
    render.drawCircle(dialColor, CX, CY, DIAL_RADIUS, 0, 360);

    // Tick marks
    for (let i = 0; i < 60; i++) {
        const angle = (i * 6) - 90;  // 0 at top
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

    // Numbers 1-12
    const numRadius = DIAL_RADIUS - 28;
    for (let n = 1; n <= 12; n++) {
        const angle = (n * 30) - 90;  // 0 at top
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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = monthNames[now.getMonth()] + " " + now.getDate();

    const dateColor = color(render, settings.DateColor);
    const tw = render.getTextWidth(dateStr, dateFont);
    const th = dateFont.height;

    // Position above center
    const y = CY - DIAL_RADIUS + 45;
    render.drawText(dateStr, dateFont, dateColor, CX - tw / 2, y);
}

function drawHands(date) {
    const hourColor = color(render, settings.HourHandColor);
    const minuteColor = color(render, settings.MinuteHandColor);

    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();

    // Hour hand angle
    const hourAngle = (hours * 30 + minutes * 0.5) - 90;
    // Minute hand angle
    const minuteAngle = (minutes * 6) - 90;

    // Draw hour hand (length 65, thickness 5)
    const hourRad = hourAngle * Math.PI / 180;
    const hourLen = Math.floor(DIAL_RADIUS * 0.45);
    const hx = CX + Math.cos(hourRad) * hourLen;
    const hy = CY + Math.sin(hourRad) * hourLen;
    render.drawLine(CX, CY, hx, hy, hourColor, 5);

    // Draw minute hand (length 90, thickness 3)
    const minRad = minuteAngle * Math.PI / 180;
    const minLen = Math.floor(DIAL_RADIUS * 0.70);
    const mx = CX + Math.cos(minRad) * minLen;
    const my = CY + Math.sin(minRad) * minLen;
    render.drawLine(CX, CY, mx, my, minuteColor, 3);

    // Center dot
    const centerColor = color(render, settings.DialColor);
    render.drawCircle(centerColor, CX, CY, 4, 0, 360);
}

function drawComplications() {
    const compColor = color(render, settings.ComplicationColor);
    const textColor = color(render, settings.NumberColor);
    const compRadius = 22;

    // Weather complication (left of center, ~9 o'clock)
    const weatherX = CX - Math.floor(DIAL_RADIUS * 0.55);
    const weatherY = CY;
    const temp = Weather.getCurrentTemp();

    render.drawCircle(compColor, weatherX, weatherY, compRadius, 0, 360);
    if (temp !== null) {
        const unit = Weather.getCurrentUnit();
        const tempStr = temp + "°" + unit;
        const tw = render.getTextWidth(tempStr, compFont);
        const th = compFont.height;
        render.drawText(tempStr, compFont, textColor, weatherX - tw / 2, weatherY - th / 2);
    } else {
        const dash = "--";
        const tw = render.getTextWidth(dash, compFont);
        const th = compFont.height;
        render.drawText(dash, compFont, textColor, weatherX - tw / 2, weatherY - th / 2);
    }

    // Battery complication (right of center, ~3 o'clock)
    const batteryX = CX + Math.floor(DIAL_RADIUS * 0.55);
    const batteryY = CY;
    const batteryPercent = Battery.getPercent();
    const arcColor = Battery.getArcColor(render);
    const angles = Battery.getArcAngles();

    // Battery outline circle
    render.drawCircle(compColor, batteryX, batteryY, compRadius, 0, 360);
    // Battery arc (filled portion)
    render.drawCircle(arcColor, batteryX, batteryY, compRadius - 4, angles.start - 90, angles.end - 90);

    // Battery percentage text
    const battStr = batteryPercent + "%";
    const bw = render.getTextWidth(battStr, compFont);
    const bh = compFont.height;
    render.drawText(battStr, compFont, textColor, batteryX - bw / 2, batteryY - bh / 2);
}

// ===== MAIN DRAW =====

function draw(date) {
    console.log("draw called with date: " + (date ? date.toTimeString() : "null"));
    render.begin();
    drawDial();
    drawDate();
    drawHands(date);
    drawComplications();
    render.end();
    console.log("draw complete");
}

// ===== EVENT HANDLERS =====

function onMinuteChange(e) {
    console.log("minutechange event");
    draw(e.date);
}

function onBatteryUpdate() {
    console.log("battery update");
    const now = new Date();
    draw(now);
}

function onWeatherUpdate() {
    console.log("weather update");
    const now = new Date();
    draw(now);
}

// ===== SETTINGS =====

const message = new Message({
    keys: ["BackgroundColor", "DialColor", "NumberColor", "HourHandColor",
           "MinuteHandColor", "DateColor", "ComplicationColor", "UseFahrenheit",
           "WeatherRequest", "WeatherTemp", "WeatherUnit"],
    onReadable() {
        const msg = this.read();
        let needsRedraw = false;

        // Check for weather response from PKJS
        let weatherTemp = null;
        let weatherUnit = null;
        msg.forEach((value, key) => {
            if (key === "WeatherTemp") weatherTemp = value;
            if (key === "WeatherUnit") weatherUnit = value;
        });

        if (weatherTemp !== null && weatherUnit !== null) {
            Weather.setWeatherData(weatherTemp, weatherUnit);
            needsRedraw = true;
        }

        // Check for settings changes from Clay
        const hasSettings = msg.has("BackgroundColor") || msg.has("DialColor") ||
                            msg.has("NumberColor") || msg.has("HourHandColor") ||
                            msg.has("MinuteHandColor") || msg.has("DateColor") ||
                            msg.has("ComplicationColor") || msg.has("UseFahrenheit");
        if (hasSettings) {
            settings = Settings.applySettingsFromMessage(msg);
            Weather.initWeather(settings.UseFahrenheit);
            needsRedraw = true;
        }

        if (needsRedraw) {
            const now = new Date();
            draw(now);
        }
    },
    onWritable() {
        console.log("Message channel ready");
    },
    onSuspend() {
        console.log("Message channel suspended");
    }
});

// ===== INITIALIZATION =====

// Ensure watch global is accessible
try {
    Battery.initBattery(onBatteryUpdate);
    Weather.setOnUpdate(onWeatherUpdate);

    // Use globalThis.watch for explicit access to the Pebble watch global
    const watchGlobal = globalThis.watch;
    if (watchGlobal) {
        watchGlobal.addEventListener("minutechange", onMinuteChange);
        console.log("Initialization complete");
    } else {
        console.log("watch global not available");
    }
} catch (e) {
    console.log("Initialization error: " + e);
}

console.log("main.js loaded");

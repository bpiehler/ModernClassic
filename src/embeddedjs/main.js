import Poco from "commodetto/Poco";
import Message from "pebble/message";

// ===== CORE SETUP =====
const render = new Poco(screen);
const CX = Math.floor(render.width / 2);
const CY = Math.floor(render.height / 2);
const DIAL_RADIUS = Math.min(CX, CY) - 10;

// ===== SETTINGS =====
const DEFAULTS = {
    BackgroundColor: "#000000",
    DialColor: "#202020",
    NumberColor: "#FFFFFF",
    HourHandColor: "#FFFFFF",
    MinuteHandColor: "#B0B0B0",
    DateColor: "#FFFFFF",
    ComplicationColor: "#808080",
    UseFahrenheit: false
};

function hexToRgb(hex) {
    if (typeof hex === "number") {
        const val = hex & 0xFFFFFF;
        return { r: (val >> 16) & 0xFF, g: (val >> 8) & 0xFF, b: val & 0xFF };
    }
    const str = String(hex).replace("#", "");
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(str);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function color(hex) {
    const rgb = hexToRgb(hex);
    return render.makeColor(rgb.r, rgb.g, rgb.b);
}

function loadSettings() {
    const s = {};
    for (const key in DEFAULTS) {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            s[key] = key === "UseFahrenheit" ? stored === "true" : stored;
        } else {
            s[key] = DEFAULTS[key];
        }
    }
    return s;
}

function saveSettings(s) {
    for (const key in s) {
        localStorage.setItem(key, key === "UseFahrenheit" ? String(s[key]) : s[key]);
    }
}

let settings = loadSettings();

// ===== STATE =====
let numFont = null, dateFont = null, compFont = null;
let batteryPercent = 100;
let currentTemp = null;
let currentUnit = "C";

// ===== INIT =====
function init() {
    try { numFont = new render.Font("Leco-Regular", 20); } catch (e) {}
    try { dateFont = new render.Font("Gothic-Regular", 14); } catch (e) {}
    try { compFont = new render.Font("Gothic-Regular", 14); } catch (e) {}

    try {
        const Battery = require("embedded:sensor/Battery");
        const batt = new Battery({
            onSample() { batteryPercent = this.sample().percent; redraw(); }
        });
        batteryPercent = batt.sample().percent;
    } catch (e) {}

    const wg = globalThis.watch;
    if (wg && wg.addEventListener) {
        wg.addEventListener("minutechange", function(e) {
            render.begin();
            draw(e.date);
            render.end();
        });
    }

    const ct = localStorage.getItem("weather_temp");
    const cu = localStorage.getItem("weather_unit");
    if (ct !== null) { currentTemp = parseFloat(ct); currentUnit = cu || "C"; }

    // Single Message channel for all communication
    const msg = new Message({
        keys: ["BackgroundColor", "DialColor", "NumberColor", "HourHandColor",
               "MinuteHandColor", "DateColor", "ComplicationColor", "UseFahrenheit",
               "WeatherRequest", "WeatherTemp", "WeatherUnit"],
        onReadable() {
            const m = this.read();
            let updated = false;

            // Check for weather response
            let temp = null, unit = null;
            m.forEach((value, key) => {
                if (key === "WeatherTemp") temp = value;
                if (key === "WeatherUnit") unit = value;
            });
            if (temp !== null && unit !== null) {
                currentTemp = temp;
                currentUnit = unit;
                localStorage.setItem("weather_temp", String(currentTemp));
                localStorage.setItem("weather_unit", currentUnit);
                updated = true;
            }

            // Check for settings changes
            const hasSettings = m.has("BackgroundColor") || m.has("DialColor") ||
                                m.has("NumberColor") || m.has("HourHandColor") ||
                                m.has("MinuteHandColor") || m.has("DateColor") ||
                                m.has("ComplicationColor") || m.has("UseFahrenheit");
            if (hasSettings) {
                const newSettings = {};
                m.forEach((value, key) => {
                    if (key in DEFAULTS) newSettings[key] = value;
                });
                Object.assign(settings, newSettings);
                saveSettings(settings);
                updated = true;
            }

            if (updated) redraw();
        },
        onWritable() {
            // Request weather update on startup
            this.write(new Map([["WeatherRequest", settings.UseFahrenheit ? 1 : 0]]));
        }
    });

    redraw();
}

function redraw() {
    render.begin();
    draw(new Date());
    render.end();
}

// ===== DRAW =====
function draw(date) {
    const bg = color(settings.BackgroundColor);
    const dial = color(settings.DialColor);
    const num = color(settings.NumberColor);
    const hour = color(settings.HourHandColor);
    const minute = color(settings.MinuteHandColor);
    const dateC = color(settings.DateColor);
    const compOutline = color(settings.ComplicationColor);

    // Background
    render.fillRectangle(bg, 0, 0, render.width, render.height);

    // Dial face
    render.fillRectangle(dial, CX - DIAL_RADIUS, CY - DIAL_RADIUS, DIAL_RADIUS * 2, DIAL_RADIUS * 2);

    // Tick marks
    for (let i = 0; i < 60; i++) {
        const angle = (i * 6) - 90;
        const radians = angle * Math.PI / 180;
        const isHour = (i % 5 === 0);
        const tickLen = isHour ? 14 : 7;
        const tickWidth = isHour ? 2 : 1;
        const innerR = DIAL_RADIUS - tickLen - 2;
        const outerR = DIAL_RADIUS - 3;
        render.drawLine(
            CX + Math.cos(radians) * innerR, CY + Math.sin(radians) * innerR,
            CX + Math.cos(radians) * outerR, CY + Math.sin(radians) * outerR,
            num, tickWidth);
    }

    // Numbers 1-12
    if (numFont) {
        const numRadius = DIAL_RADIUS - 30;
        for (let n = 1; n <= 12; n++) {
            const angle = (n * 30) - 90;
            const radians = angle * Math.PI / 180;
            const nx = CX + Math.cos(radians) * numRadius;
            const ny = CY + Math.sin(radians) * numRadius;
            const numStr = String(n);
            const tw = render.getTextWidth(numStr, numFont);
            render.drawText(numStr, numFont, num, nx - tw / 2, ny - numFont.height / 2);
        }
    }

    // Date
    if (dateFont) {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const dateStr = months[date.getMonth()] + " " + date.getDate();
        const tw = render.getTextWidth(dateStr, dateFont);
        const y = CY - DIAL_RADIUS + 50;
        render.drawText(dateStr, dateFont, dateC, CX - tw / 2, y);
    }

    // Hands
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const hourAngle = (hours * 30 + minutes * 0.5) - 90;
    const minuteAngle = (minutes * 6) - 90;

    const hourRad = hourAngle * Math.PI / 180;
    const hourLen = Math.floor(DIAL_RADIUS * 0.45);
    render.drawLine(CX, CY,
        CX + Math.cos(hourRad) * hourLen,
        CY + Math.sin(hourRad) * hourLen,
        hour, 5);

    const minRad = minuteAngle * Math.PI / 180;
    const minLen = Math.floor(DIAL_RADIUS * 0.70);
    render.drawLine(CX, CY,
        CX + Math.cos(minRad) * minLen,
        CY + Math.sin(minRad) * minLen,
        minute, 3);

    render.drawCircle(num, CX, CY, 4, 0, 360);

    // Complications
    if (compFont) {
        const compRadius = 20;

        // Weather (left of center)
        const wx = CX - Math.floor(DIAL_RADIUS * 0.50);
        render.drawCircle(compOutline, wx, CY, compRadius, 0, 360);
        const wstr = currentTemp !== null ? currentTemp + "°" + currentUnit : "--";
        const wtw = render.getTextWidth(wstr, compFont);
        render.drawText(wstr, compFont, bg, wx - wtw / 2, CY - compFont.height / 2);

        // Battery (right of center)
        const bx = CX + Math.floor(DIAL_RADIUS * 0.50);
        const arcColor = batteryPercent > 50 ? color("#00C800") : batteryPercent > 20 ? color("#DCC800") : color("#DC0000");
        const endAngle = Math.floor(batteryPercent * 3.6);
        render.drawCircle(compOutline, bx, CY, compRadius, 0, 360);
        render.drawCircle(arcColor, bx, CY, compRadius - 4, 270, 270 + endAngle);
        const bstr = batteryPercent + "%";
        const btw = render.getTextWidth(bstr, compFont);
        render.drawText(bstr, compFont, bg, bx - btw / 2, CY - compFont.height / 2);
    }
}

setTimeout(init, 100);

import Poco from "commodetto/Poco";

// ===== CORE SETUP =====
const render = new Poco(screen);
const CX = Math.floor(render.width / 2);
const CY = Math.floor(render.height / 2);
const DIAL_RADIUS = Math.min(CX, CY) - 8;

const white = render.makeColor(255, 255, 255);
const black = render.makeColor(0, 0, 0);
const gray = render.makeColor(128, 128, 128);
const darkGray = render.makeColor(64, 64, 64);
const green = render.makeColor(0, 200, 0);
const yellow = render.makeColor(220, 200, 0);
const red = render.makeColor(220, 0, 0);

let numFont = null, dateFont = null, compFont = null;
let batteryPercent = 100;
let currentTemp = null;
let currentUnit = "C";

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

    try {
        const Message = require("pebble/message");
        const msg = new Message({ keys: ["WeatherRequest", "WeatherTemp", "WeatherUnit"] });
        if (msg.writable) msg.write(new Map([["WeatherRequest", 0]]));
    } catch (e) {}

    try {
        const Message = require("pebble/message");
        new Message({
            keys: ["WeatherTemp", "WeatherUnit"],
            onReadable() {
                const m = this.read();
                let updated = false;
                m.forEach((value, key) => {
                    if (key === "WeatherTemp") { currentTemp = value; updated = true; }
                    if (key === "WeatherUnit") { currentUnit = value; updated = true; }
                });
                if (updated) { localStorage.setItem("weather_temp", String(currentTemp)); localStorage.setItem("weather_unit", currentUnit); redraw(); }
            }
        });
    } catch (e) {}

    redraw();
}

function redraw() {
    render.begin();
    draw(new Date());
    render.end();
}

function draw(date) {
    // 1. Background
    try { render.fillRectangle(black, 0, 0, render.width, render.height); } catch (e) {}

    // 2. Dial ring
    try { render.drawCircle(white, CX, CY, DIAL_RADIUS, 0, 360); } catch (e) {}

    // 3. Ticks
    try {
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
            render.drawLine(x1, y1, x2, y2, white, tickWidth);
        }
    } catch (e) {}

    // 4. Numbers
    try {
        if (numFont) {
            const numRadius = DIAL_RADIUS - 28;
            for (let n = 1; n <= 12; n++) {
                const angle = (n * 30) - 90;
                const radians = angle * Math.PI / 180;
                const nx = CX + Math.cos(radians) * numRadius;
                const ny = CY + Math.sin(radians) * numRadius;
                const numStr = String(n);
                const tw = render.getTextWidth(numStr, numFont);
                render.drawText(numStr, numFont, white, nx - tw / 2, ny - numFont.height / 2);
            }
        }
    } catch (e) {}

    // 5. Date
    try {
        if (dateFont) {
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const dateStr = months[date.getMonth()] + " " + date.getDate();
            const tw = render.getTextWidth(dateStr, dateFont);
            const y = CY - DIAL_RADIUS + 45;
            render.drawText(dateStr, dateFont, white, CX - tw / 2, y);
        }
    } catch (e) {}

    // 6. Hands
    try {
        const hours = date.getHours() % 12;
        const minutes = date.getMinutes();
        const hourAngle = (hours * 30 + minutes * 0.5) - 90;
        const minuteAngle = (minutes * 6) - 90;

        const hourRad = hourAngle * Math.PI / 180;
        const hourLen = Math.floor(DIAL_RADIUS * 0.45);
        render.drawLine(CX, CY,
            CX + Math.cos(hourRad) * hourLen,
            CY + Math.sin(hourRad) * hourLen,
            white, 5);

        const minRad = minuteAngle * Math.PI / 180;
        const minLen = Math.floor(DIAL_RADIUS * 0.70);
        render.drawLine(CX, CY,
            CX + Math.cos(minRad) * minLen,
            CY + Math.sin(minRad) * minLen,
            gray, 3);

        render.drawCircle(white, CX, CY, 4, 0, 360);
    } catch (e) {}

    // 7. Complications
    try {
        if (compFont) {
            const compRadius = 22;

            // Weather (left)
            const wx = CX - Math.floor(DIAL_RADIUS * 0.55);
            render.drawCircle(darkGray, wx, CY, compRadius, 0, 360);
            const wstr = currentTemp !== null ? currentTemp + "°" + currentUnit : "--";
            const wtw = render.getTextWidth(wstr, compFont);
            render.drawText(wstr, compFont, white, wx - wtw / 2, CY - compFont.height / 2);

            // Battery (right)
            const bx = CX + Math.floor(DIAL_RADIUS * 0.55);
            const arcColor = batteryPercent > 50 ? green : batteryPercent > 20 ? yellow : red;
            const endAngle = Math.floor(batteryPercent * 3.6);
            render.drawCircle(darkGray, bx, CY, compRadius, 0, 360);
            render.drawCircle(arcColor, bx, CY, compRadius - 4, 270, 270 + endAngle);
            const bstr = batteryPercent + "%";
            const btw = render.getTextWidth(bstr, compFont);
            render.drawText(bstr, compFont, white, bx - btw / 2, CY - compFont.height / 2);
        }
    } catch (e) {}
}

console.log("Module loaded");
setTimeout(init, 100);

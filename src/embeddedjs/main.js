import Poco from "commodetto/Poco";

// ===== CORE SETUP =====
const render = new Poco(screen);
const CX = Math.floor(render.width / 2);
const CY = Math.floor(render.height / 2);
const DIAL_RADIUS = Math.min(CX, CY) - 10;

const C_BLACK = render.makeColor(0, 0, 0);
const C_DARK = render.makeColor(32, 32, 32);
const C_GRAY = render.makeColor(128, 128, 128);
const C_WHITE = render.makeColor(255, 255, 255);
const C_HOUR = render.makeColor(255, 255, 255);
const C_MIN = render.makeColor(180, 180, 180);
const C_GREEN = render.makeColor(0, 200, 0);
const C_YELLOW = render.makeColor(220, 200, 0);
const C_RED = render.makeColor(220, 0, 0);

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
    // Black background
    render.fillRectangle(C_BLACK, 0, 0, render.width, render.height);

    // Dark gray dial face (so white elements show up)
    render.fillRectangle(C_DARK,
        CX - DIAL_RADIUS, CY - DIAL_RADIUS,
        DIAL_RADIUS * 2, DIAL_RADIUS * 2);

    // Tick marks
    for (let i = 0; i < 60; i++) {
        const angle = (i * 6) - 90;
        const radians = angle * Math.PI / 180;
        const isHour = (i % 5 === 0);
        const tickLen = isHour ? 14 : 7;
        const tickWidth = isHour ? 2 : 1;
        const innerR = DIAL_RADIUS - tickLen - 2;
        const outerR = DIAL_RADIUS - 3;
        const x1 = CX + Math.cos(radians) * innerR;
        const y1 = CY + Math.sin(radians) * innerR;
        const x2 = CX + Math.cos(radians) * outerR;
        const y2 = CY + Math.sin(radians) * outerR;
        render.drawLine(x1, y1, x2, y2, C_WHITE, tickWidth);
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
            render.drawText(numStr, numFont, C_WHITE, nx - tw / 2, ny - numFont.height / 2);
        }
    }

    // Date
    if (dateFont) {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const dateStr = months[date.getMonth()] + " " + date.getDate();
        const tw = render.getTextWidth(dateStr, dateFont);
        const y = CY - DIAL_RADIUS + 50;
        render.drawText(dateStr, dateFont, C_WHITE, CX - tw / 2, y);
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
        C_HOUR, 5);

    const minRad = minuteAngle * Math.PI / 180;
    const minLen = Math.floor(DIAL_RADIUS * 0.70);
    render.drawLine(CX, CY,
        CX + Math.cos(minRad) * minLen,
        CY + Math.sin(minRad) * minLen,
        C_MIN, 3);

    render.drawCircle(C_WHITE, CX, CY, 4, 0, 360);

    // Complications
    if (compFont) {
        const compRadius = 20;

        // Weather (left of center)
        const wx = CX - Math.floor(DIAL_RADIUS * 0.50);
        render.drawCircle(C_GRAY, wx, CY, compRadius, 0, 360);
        const wstr = currentTemp !== null ? currentTemp + "°" + currentUnit : "--";
        const wtw = render.getTextWidth(wstr, compFont);
        render.drawText(wstr, compFont, C_BLACK, wx - wtw / 2, CY - compFont.height / 2);

        // Battery (right of center)
        const bx = CX + Math.floor(DIAL_RADIUS * 0.50);
        const arcColor = batteryPercent > 50 ? C_GREEN : batteryPercent > 20 ? C_YELLOW : C_RED;
        const endAngle = Math.floor(batteryPercent * 3.6);
        render.drawCircle(C_GRAY, bx, CY, compRadius, 0, 360);
        render.drawCircle(arcColor, bx, CY, compRadius - 4, 270, 270 + endAngle);
        const bstr = batteryPercent + "%";
        const btw = render.getTextWidth(bstr, compFont);
        render.drawText(bstr, compFont, C_BLACK, bx - btw / 2, CY - compFont.height / 2);
    }
}

console.log("Module loaded");
setTimeout(init, 100);

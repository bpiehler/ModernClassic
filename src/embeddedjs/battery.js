/** battery.js - Monitor battery level and determine status colors */

import Battery from "embedded:sensor/Battery";

let batteryPercent = 100;
let isCharging = false;
let isPlugged = false;
let onUpdate = null;
let batterySensor = null;

export function initBattery(callback) {
    onUpdate = callback;
    try {
        batterySensor = new Battery({
            onSample() {
                const sample = this.sample();
                batteryPercent = sample.percent;
                isCharging = sample.charging;
                isPlugged = sample.plugged;
                if (onUpdate) onUpdate();
            }
        });
        const initial = batterySensor.sample();
        batteryPercent = initial.percent;
        isCharging = initial.charging;
        isPlugged = initial.plugged;
        console.log("Battery initialized: " + batteryPercent + "%");
    } catch (e) {
        console.log("Battery init error: " + e);
        batteryPercent = 100;
    }
}

export function getPercent() {
    return batteryPercent;
}

export function isChargingStatus() {
    return isCharging;
}

export function getArcColor(render) {
    if (batteryPercent > 50) {
        return render.makeColor(0, 200, 0);      // Green
    } else if (batteryPercent > 20) {
        return render.makeColor(220, 200, 0);    // Yellow
    } else {
        return render.makeColor(220, 0, 0);      // Red
    }
}

export function getArcAngles() {
    // Arc from 0 to (percent * 3.6) degrees
    const endAngle = Math.floor(batteryPercent * 3.6);
    return { start: 0, end: endAngle };
}

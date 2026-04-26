/** settings.js - Manage user preferences via localStorage and Clay messages */

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
    // Handle integer colors from Clay (e.g., 0x000000 or just 0)
    if (typeof hex === "number") {
        const val = hex & 0xFFFFFF;
        return {
            r: (val >> 16) & 0xFF,
            g: (val >> 8) & 0xFF,
            b: val & 0xFF
        };
    }
    // Handle string colors (e.g., "#000000" or "000000")
    const str = String(hex).replace("#", "");
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(str);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

export function loadSettings() {
    const settings = {};
    for (const key in DEFAULTS) {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            if (key === "UseFahrenheit") {
                settings[key] = stored === "true";
            } else {
                settings[key] = stored;
            }
        } else {
            settings[key] = DEFAULTS[key];
        }
    }
    return settings;
}

export function saveSettings(settings) {
    for (const key in settings) {
        if (key === "UseFahrenheit") {
            localStorage.setItem(key, String(settings[key]));
        } else {
            localStorage.setItem(key, settings[key]);
        }
    }
}

export function parseColor(render, hex) {
    const rgb = hexToRgb(hex);
    return render.makeColor(rgb.r, rgb.g, rgb.b);
}

export function applySettingsFromMessage(msg) {
    const settings = loadSettings();
    msg.forEach((value, key) => {
        if (key in DEFAULTS) {
            settings[key] = value;
        }
    });
    saveSettings(settings);
    return settings;
}

export { DEFAULTS };

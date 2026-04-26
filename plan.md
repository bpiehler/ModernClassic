# ModernClassic Watchface — Implementation Plan

## Overview
An analog Pebble watchface built with Alloy (Moddable SDK), targeting **Gabbro** (260×260 round) with graceful **Emery** fallback. Clean, modern design with configurable colors, weather and battery complications, and date display.

## Technology Stack
- **Framework:** Alloy (JavaScript/Moddable)
- **Renderer:** Poco (procedural graphics)
- **Configuration:** Clay (`@rebble/clay`) for phone-side settings
- **Networking:** `@moddable/pebbleproxy` for weather API calls

## Visual Design (Gabbro 260×260)
| Element | Position | Details |
|---|---|---|
| **Dial ring** | Center (130,130), radius ~120px | Thin circle + tick marks (longer at hours) |
| **Numbers 1–12** | Around dial perimeter | Sans-serif (Leco/Gothic), configurable color |
| **Hour hand** | From center, length ~65px, thickness 5px | Configurable color |
| **Minute hand** | From center, length ~90px, thickness 3px | Configurable color |
| **No second hand** | — | Uses `minutechange` for battery savings |
| **Date** | Above center (~11:30–12:30 position) | "Apr 25" format, configurable color |
| **Weather complication** | Left of center (~9 o'clock), radius ~22px | Temp numerically (e.g., "72°") |
| **Battery complication** | Right of center (~3 o'clock), radius ~22px | Percentage text + colored arc ring (green>50%, yellow 20-50%, red<20%) |

## File Structure
```
src/
  embeddedjs/
    main.js           - Render loop, draw dial, hands, complications, date
    settings.js       - localStorage settings management, defaults, color parsing
    weather.js        - Weather fetching via Location sensor + Open-Meteo
    battery.js        - Battery monitoring via Battery sensor
  pkjs/
    config.json       - Clay configuration page definition
    index.js          - PKJS proxy setup + Clay initialization
package.json          - App manifest (updated capabilities, message keys)
plan.md               - This plan
```

## Module Responsibilities

### `main.js`
- Subscribe to `watch.minutechange` for time updates
- Draw sequence: background → dial ring & ticks → numbers → hands → complications → date
- Precompute dial geometry, number positions, hand lengths based on `screen.width/height`
- Import and use `settings.js`, `weather.js`, `battery.js`

### `settings.js`
- Load settings from `localStorage` with sensible defaults
- Defaults: bg=#000000, dial=#AAAAAA, numbers=#FFFFFF, hour=#FFFFFF, minute=#DDDDDD, date=#FFFFFF, complications=#888888
- Parse hex color strings to Poco `makeColor(r,g,b)`
- Apply settings on startup and when Clay settings arrive via `Message`

### `weather.js`
- On startup/request: use `Location` sensor to get lat/long
- Wait for `watch.connected.pebblekit === true` before `fetch()`
- API: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code`
- Parse JSON, cache temp (°C, convert if °F) + condition in `localStorage`
- Schedule refresh every 30 minutes via `setTimeout`
- Handle errors: use cached data if available

### `battery.js`
- `new Battery({ onSample() {...} })`
- Store `percent`, `charging`, `plugged`
- Trigger display update via callback
- Determine arc color: green (>50%), yellow (20-50%), red (<20%)

### `pkjs/index.js`
```js
const moddableProxy = require("@moddable/pebbleproxy");
const Clay = require("@rebble/clay");
const clayConfig = require("./config.json");

const clay = new Clay(clayConfig);

Pebble.addEventListener('ready', moddableProxy.readyReceived);
Pebble.addEventListener('appmessage', function(e) {
    if (moddableProxy.appMessageReceived(e)) return;
    // Clay handles its own messages automatically
});
```

### `pkjs/config.json` (Clay)
Fields:
- `BackgroundColor` — color picker (default: #000000)
- `DialColor` — color picker (default: #AAAAAA)
- `NumberColor` — color picker (default: #FFFFFF)
- `HourHandColor` — color picker (default: #FFFFFF)
- `MinuteHandColor` — color picker (default: #DDDDDD)
- `DateColor` — color picker (default: #FFFFFF)
- `ComplicationColor` — color picker (default: #888888)
- `UseFahrenheit` — toggle (default: false)

## package.json Updates
- Add `"configurable"` to `capabilities` array
- Update `messageKeys`: `BackgroundColor`, `DialColor`, `NumberColor`, `HourHandColor`, `MinuteHandColor`, `DateColor`, `ComplicationColor`, `UseFahrenheit`
- Keep `"watchface": true` and `"projectType": "moddable"`

## Dependencies
```bash
pebble package install @moddable/pebbleproxy
pebble package install @rebble/clay
```

## Build & Run Instructions
```bash
pebble build                             # Compile the project
pebble install --emulator gabbro          # Test on round emulator
pebble install --emulator emery           # Verify rectangular fallback
pebble emu-battery --percent 45           # Test battery arc color
pebble emu-battery --percent 15           # Test low battery (red arc)
```

## Testing Strategy
Since Alloy runs in an embedded JS environment without a standard test runner, testing is **build + emulator + manual verification**:

1. **Build verification:** `pebble build` succeeds with no errors
2. **Emulator smoke tests:**
   - Gabbro: round layout, no clipping at dial edges, hands centered
   - Emery: loads without crash, acceptable rectangular layout
3. **Feature checklist (manual):**
   - ☐ Time updates on `minutechange`
   - ☐ Hour hand advances with minutes (not just hours)
   - ☐ Date updates at midnight
   - ☐ Battery arc fills correctly; color changes at 50% and 20% thresholds
   - ☐ Battery percentage text centered in arc
   - ☐ Weather fetch returns temp; displays with ° symbol
   - ☐ Weather updates every 30 min; uses cache when offline
   - ☐ Clay config page opens from Pebble app
   - ☐ All color changes apply immediately and persist after restart
   - ☐ Settings persist across app restarts via `localStorage`

## Notes & Considerations
- **Rounded hand ends:** `render.drawLine(cx, cy, endX, endY, color, thickness)` in Poco renders with rounded caps automatically — no extra work needed.
- **Battery arc:** `render.drawCircle(color, cx, cy, radius, startAngle, endAngle)` draws partial arcs. Calculate start/end based on battery percent (e.g., 0° to 3.6° × percent).
- **Weather caching:** Store `weather_temp`, `weather_time`, `weather_code` in `localStorage`. On startup, if cache <30 min old, use it while fetching fresh data.
- **Location permission:** Add `"location"` to `capabilities` for `Location` sensor to work.
- **Performance:** Full-screen redraw each minute is fine for this complexity. If needed later, use `render.begin(x,y,w,h)` for partial updates.
- **Emery fallback:** On rectangular screen, use `Math.min(width, height)` as dial diameter and center it. Some clipping at corners is acceptable per user requirements.

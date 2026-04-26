# ModernClassic Watchface — Implementation Plan

## Overview
An analog Pebble watchface built with Alloy (Moddable SDK), targeting **Gabbro** (260×260 round) with graceful **Emery** fallback. Clean, modern design with configurable colors, weather and battery complications, and date display.

## Technology Stack
- **Framework:** Alloy (JavaScript/Moddable)
- **Renderer:** Poco (procedural graphics)
- **Configuration:** Clay (`@rebble/clay`) for phone-side settings
- **Networking:** `@moddable/pebbleproxy` for weather API calls via PKJS

## Visual Design (Gabbro 260×260)
| Element | Position | Details |
|---|---|---|
| **Background** | Full screen | Configurable color (default: black) |
| **Dial face** | Center (130,130), radius ~120px | Configurable color (default: dark gray), tick marks at perimeter |
| **Numbers 1–12** | Around dial perimeter | Sans-serif (Leco/Gothic), configurable color |
| **Hour hand** | From center, length ~45% of radius, thickness 5px | Configurable color (default: white) |
| **Minute hand** | From center, length ~70% of radius, thickness 3px | Configurable color (default: light gray) |
| **No second hand** | — | Uses `minutechange` for battery savings |
| **Date** | Above center, near 12 o'clock | "Apr 25" format, configurable color |
| **Weather complication** | Left of center (~9 o'clock), radius ~20px | Current temp numerically (e.g., "72°"), request via app message to phone |
| **Battery complication** | Right of center (~3 o'clock), radius ~20px | Percentage text + colored arc ring (green>50%, yellow 20-50%, red<20%) |

## File Structure
```
src/
  embeddedjs/
    main.js           - Watchface rendering, settings, battery, weather (single file)
    manifest.json     - Moddable manifest (standard single-module template)
  pkjs/
    config.json       - Clay configuration page definition
    index.js          - PKJS proxy setup + Clay + weather fetching
  c/
    mdbl.c            - C entry point (creates window, starts Moddable machine, event loop)
package.json          - App manifest (capabilities, message keys, dependencies)
plan.md               - This plan
```

> **Note:** After experimentation with multi-module Moddable manifests, the project uses a single `main.js` for all watch-side logic. This matches the standard Alloy template structure and avoids module resolution issues.

## Module Responsibilities

### `src/embeddedjs/main.js`
- Subscribe to `watch.minutechange` for time updates
- Draw sequence: background → dial face → tick marks → numbers → hands → date → complications
- Manage settings via `localStorage` with sensible defaults
- Handle Clay config updates via `pebble/message` app messages
- Monitor battery via `embedded:sensor/Battery`
- Request weather updates via app messages to PKJS
- Precompute dial geometry based on `screen.width/height`

### `src/pkjs/index.js`
- Set up `@moddable/pebbleproxy` for network proxying
- Initialize Clay configuration page from `config.json`
- Handle `WeatherRequest` app messages from watch:
  - Use phone's `navigator.geolocation` to get location
  - Fetch from Open-Meteo API via `fetch()`
  - Send `WeatherTemp` and `WeatherUnit` back to watch via `Pebble.sendAppMessage()`

### `src/c/mdbl.c`
- Create a Pebble window and push it to the stack
- Call `moddable_createMachine(NULL)` to start the Moddable JS engine
- Call `app_event_loop()` to keep the app alive and process OS events
- Destroy window on exit

## Settings (Clay Configuration)
All colors are configurable via the phone-side Clay page:
- `BackgroundColor` — default: #000000
- `DialColor` — default: #202020
- `NumberColor` — default: #FFFFFF
- `HourHandColor` — default: #FFFFFF
- `MinuteHandColor` — default: #B0B0B0
- `DateColor` — default: #FFFFFF
- `ComplicationColor` — default: #808080
- `UseFahrenheit` — toggle, default: false

Settings are stored in `localStorage` on the watch and persist across app restarts.

## package.json
- Capabilities: `configurable`, `location`
- Message keys: all settings fields plus `WeatherRequest`, `WeatherTemp`, `WeatherUnit`
- Dependencies: `@moddable/pebbleproxy`, `@rebble/clay`

## Build & Run Instructions
```bash
pebble build                             # Compile the project
pebble install --emulator gabbro --logs   # Test on round emulator with logs
pebble install --emulator emery --logs    # Verify rectangular fallback
pebble emu-battery --percent 45           # Test battery arc color (yellow)
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
   - ☐ Weather updates via app message from PKJS
   - ☐ Clay config page opens from Pebble app
   - ☐ Color changes apply immediately and persist after restart
   - ☐ Settings persist across app restarts via `localStorage`

## Notes & Considerations
- **Single-file architecture:** All watch-side logic lives in `main.js` to match the standard Moddable template (`"*": "./main"`) and avoid module resolution issues.
- **Rounded hand ends:** `render.drawLine(cx, cy, endX, endY, color, thickness)` in Poco renders with rounded caps automatically.
- **Battery arc:** `render.drawCircle(color, cx, cy, radius, startAngle, endAngle)` draws partial arcs. Arc uses positive angles (270° to 270°+percent×3.6°).
- **Weather architecture:** Watch sends `WeatherRequest` app message → PKJS gets phone GPS → fetches from Open-Meteo → sends `WeatherTemp`+`WeatherUnit` back to watch. No direct `fetch()` or `Location` sensor on watch side.
- **Performance:** Full-screen redraw each minute is fine for this complexity. The `render.begin()`/`render.end()` pair batches all drawing commands.
- **Emery fallback:** On rectangular screen, `Math.min(width, height)` determines dial diameter. Some clipping at corners is acceptable.
- **Deferred initialization:** `setTimeout(init, 100)` delays sensor and message setup until the app event loop is running, avoiding startup crashes.

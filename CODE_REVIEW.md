# ModernClassic Watchface - Code Review & Audit

This document outlines the findings from the code review of the **ModernClassic** Pebble watchface project built with the Alloy (Moddable SDK) framework. The application is currently failing to load and update properly due to several architectural and runtime errors.

## 1. Missing `app_event_loop()` in C Wrapper (Critical)

**File:** `src/c/mdbl.c`

**Issue:** 
The C entry point for the Pebble application is missing the core event loop. In standard Pebble applications, `app_event_loop()` must be called to block the main thread, process OS events (like timers, button presses, and UI updates), and keep the app running. 

Currently, the `main()` function initializes the window and the Moddable engine (`moddable_createMachine`), but immediately destroys the window and exits the application. This causes the app to launch and terminate instantly.

**Recommendation:**
Add `app_event_loop();` immediately after `moddable_createMachine(NULL);` to keep the application alive.

```c
#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  moddable_createMachine(NULL);
  
  app_event_loop(); // Required to keep the app running

  window_destroy(w);
}
```

## 2. Invalid Dual-Environment Logic (Network & Location on Watch)

**File:** `src/embeddedjs/weather.js`

**Issue:**
The `weather.js` file attempts to perform HTTP network requests (`fetch` from `api.open-meteo.com`) and location lookups (`new Location(...)`) directly on the watch-side JavaScript engine. 

As highlighted in the Alloy documentation, a common pitfall is attempting to run network or location logic on the watch itself. The Moddable environment on the watch does not have direct internet or GPS access. These operations **must** be executed on the connected smartphone.

**Recommendation:**
- Refactor the network request and location logic into `src/pkjs/index.js` (phone-side).
- Use Pebble App Messages (which Alloy supports) to request the weather update from the watch and send the resulting temperature/unit back to the watch from the phone.
- Remove `fetch` and `Location` usage from `src/embeddedjs/weather.js`.

## 3. Missing `watch` Module Imports

**Files:** `src/embeddedjs/main.js`, `src/embeddedjs/weather.js`

**Issue:**
There are multiple references to a global `watch` object across the watch-side JavaScript files:
- `main.js` (Line 235): `watch.addEventListener("minutechange", onMinuteChange);`
- `weather.js` (Line 39): `if (!watch.connected.pebblekit) { ... }`

However, the `watch` object is never imported in these files. In Alloy/Moddable, `watch` is not a global variable and must be imported explicitly. This will cause a `ReferenceError` at runtime, crashing the JavaScript engine when the app attempts to initialize or fetch weather.

**Recommendation:**
Add the appropriate import at the top of the files utilizing the `watch` API, depending on the exact Moddable/Alloy module structure (e.g., `import watch from "pebble/watch";` or the equivalent export for the framework).

## Conclusion
The immediate failure to load is caused by the missing `app_event_loop()` in the C entry point, which terminates the app instantly. If that is fixed, the JavaScript runtime will then crash due to the missing `watch` imports. Finally, the weather complication will fail or crash the engine because it attempts to use unsupported network and location APIs on the watch itself. Resolving these three issues will allow the watch face to load and function as intended.
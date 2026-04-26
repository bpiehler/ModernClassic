/** pkjs/index.js - Phone-side proxy, Clay configuration, and weather fetching */

const moddableProxy = require("@moddable/pebbleproxy");
const Clay = require("@rebble/clay");
const clayConfig = require("./config.json");

const clay = new Clay(clayConfig);

Pebble.addEventListener('ready', function(e) {
    moddableProxy.readyReceived(e);
    console.log("ModernClassic PKJS ready");
});

Pebble.addEventListener('appmessage', function(e) {
    if (moddableProxy.appMessageReceived(e))
        return;

    const payload = e.payload;
    console.log("Received app message: " + JSON.stringify(payload));

    // Handle weather request from watch
    if (payload.WeatherRequest !== undefined) {
        var useFahrenheit = payload.WeatherRequest === 1;
        fetchWeatherAndReply(useFahrenheit);
    }
});

function fetchWeatherAndReply(useFahrenheit) {
    function sendWeatherToWatch(temp, unit) {
        Pebble.sendAppMessage({
            "WeatherTemp": temp,
            "WeatherUnit": unit
        });
    }

    function celsiusToFahrenheit(c) {
        return Math.round((c * 9 / 5) + 32);
    }

    // Try to get location from phone
    if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lon = position.coords.longitude;
                console.log("Location: " + lat + ", " + lon);

                var url = "https://api.open-meteo.com/v1/forecast?" +
                    "latitude=" + lat +
                    "&longitude=" + lon +
                    "&current=temperature_2m";

                fetch(url)
                    .then(function(response) {
                        if (!response.ok) throw new Error("HTTP " + response.status);
                        return response.json();
                    })
                    .then(function(data) {
                        var tempC = data.current.temperature_2m;
                        var temp = useFahrenheit ? celsiusToFahrenheit(tempC) : Math.round(tempC);
                        var unit = useFahrenheit ? "F" : "C";
                        console.log("Weather: " + temp + "°" + unit);
                        sendWeatherToWatch(temp, unit);
                    })
                    .catch(function(err) {
                        console.log("Weather fetch error: " + err);
                        // Send cached fallback or default
                        sendWeatherToWatch(0, useFahrenheit ? "F" : "C");
                    });
            },
            function(error) {
                console.log("Location error: " + error.message);
                // Without location, send a default
                sendWeatherToWatch(0, useFahrenheit ? "F" : "C");
            },
            { timeout: 15000, maximumAge: 60000 }
        );
    } else {
        console.log("Geolocation not available");
        sendWeatherToWatch(0, useFahrenheit ? "F" : "C");
    }
}

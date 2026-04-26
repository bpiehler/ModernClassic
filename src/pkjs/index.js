/** pkjs/index.js - Phone-side proxy and Clay configuration */

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
    console.log("Received app message: " + JSON.stringify(e.payload));
});

import Poco from "commodetto/Poco";

console.log("MINIMAL START");

const render = new Poco(screen);
const white = render.makeColor(255, 255, 255);
const black = render.makeColor(0, 0, 0);

render.begin();
render.fillRectangle(white, 0, 0, render.width, render.height);
render.drawCircle(black, render.width / 2, render.height / 2, 40, 0, 360);
render.end();

console.log("MINIMAL END");

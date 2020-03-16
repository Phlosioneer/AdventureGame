console.log("Starting server");

var fs = require('fs');
var http = require('http');
var static = require('node-static');

var staticServer = new static.Server('.', { cache: 0 });
var defaultPage = "./static/game.html";

var eventLocations = {};
var files = fs.readdirSync("./events/");
files.forEach(function (file) {
    var filePath = "./events/" + file;
    var content = JSON.parse(fs.readFileSync(filePath));
    content.forEach(function(event) {
        eventLocations[event.name] = filePath;
    });
});

http.createServer(function (request, response) {
    console.log("Received start request");
    body = [];
    request.addListener("data", function (chunk) {
        body.push(chunk);
    });
    request.addListener("end", function () {
        console.log("Received request body. Responding...");
        console.log(request.url);
        if (request.url == "/") {
            staticServer.serveFile(defaultPage, 200, {}, request, response);
        } else if (request.url == "/static/mustache.js") {
            staticServer.serveFile("./node_modules/mustache/mustache.js", 200, {}, request, response);
        } else if (request.url.startsWith("/static/")) {
            staticServer.serve(request, response);
        } else if (request.url.startsWith("/events/") && request.url.endsWith(".json")) {
            var eventName = request.url.substring("/events/".length);
            eventName = eventName.substring(0, eventName.length - ".json".length);
            var fileName = eventLocations[eventName];
            if (fileName) {
                staticServer.serveFile(fileName, 200, {}, request, response);
            } else {
                console.log("Could not find any event named: '" + eventName + "'");
                console.log("Known events:");
                console.log(eventLocations);
                response.statusCode = 404;
                response.end();
            }
        } else {
            // TODO: Nothing is dynamic yet.
            console.log("404 not found: " + request.url)
            response.statusCode = 404;
            response.end();
        }
    });
}).listen(8080);

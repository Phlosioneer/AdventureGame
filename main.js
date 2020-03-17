console.log("Starting server");

var fs = require('fs');
var http = require('http');
var express = require('express');
var path = require('path');

var expressApp = express();

expressApp.use(function(request, response, next) {
    console.log(request.url);
    next();
})

expressApp.get("/", function(request, response, next) {
    response.redirect("/static/game.html");
});

expressApp.get("/static/mustache.js", function(request, response, next) {
    response.sendFile(path.join(__dirname, "node_modules", "mustache", "mustache.js"), error => {
        if (error) {
            console.error(error);
        }
    });
});

expressApp.use("/static", express.static(path.join(__dirname, "static")));

expressApp.use("/events/batch", express.static(path.join(__dirname, "events")));

expressApp.get("/events/:eventName.json", function(request, response, next) {
    var eventName = request.params["eventName"];
    var fileName = eventLocations[eventName];
    if (fileName) {
        response.redirect(fileName);
    } else {
        console.log("Could not find any event named: '" + eventName + "'");
        console.log("Known events:");
        console.log(eventLocations);
        response.statusCode = 404;
        response.end();
    }
});

expressApp.use(function(request, response, next, error) {
    console.error(error);
});

var eventLocations = {};
var files = fs.readdirSync("./events/");
files.forEach(function (file) {
    var filePath = path.join(__dirname, "events", file);
    var content = JSON.parse(fs.readFileSync(filePath));
    content.forEach(function(event) {
        eventLocations[event.name] = "/events/batch/" + file;
    });
});

expressApp.listen(8080);

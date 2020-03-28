console.log("Starting server");

var fs = require('fs');
var http = require('http');
var express = require('express');
var path = require('path');
var process = require('process');

var expressApp = express();
var eventLocations = {};
var qualityLocations = {};

expressApp.use(function(request, response, next) {
    console.log("Incoming request url: " + request.url);
    next();
})

expressApp.get("/", function(request, response, next) {
    response.redirect("/static/html/game.html");
});

expressApp.get("/static/src/mustache.js", function(request, response, next) {
    response.sendFile(path.join(__dirname, "node_modules", "mustache", "mustache.js"), error => {
        if (error) {
            console.error("Error while retrieving mustache.js:");
            console.error(error);
        }
    });
});

expressApp.use("/static", express.static(path.join(__dirname, "static")));

expressApp.use("/events/batch", express.static(path.join(__dirname, "events")));
expressApp.use("/qualities/batch", express.static(path.join(__dirname, "qualities")));

function makeIndexedEndpoint(router, name, index) {
    router.use("/" + name + "/batch", express.static(path.join(__dirname, name)));
    router.get("/" + name + "/:dataName.json", function(request, response, next) {
        var fileName = index[request.params["dataName"]];
        if (fileName) {
            response.redirect(fileName);
        } else {
            console.error("Could not find any " + name + " named: '" + request.params["dataName"] + "'");
            console.error("Known " + name + ":");
            console.error(index);
            response.statusCode = 404;
            response.end();
        }
    });
}
makeIndexedEndpoint(expressApp, "events", eventLocations);
makeIndexedEndpoint(expressApp, "qualities", qualityLocations);

expressApp.use(function(error, request, response, next) {
    console.error("Encountered error:");
    console.error(error);
});

// Takes all the json files in one directory and indexes them, so they can be used as if they were
// all in one giant json array. Returns a promise that resolves to the completed index.
async function indexJsonDefinitions(directory) {
    var files = await fs.promises.readdir(path.join(__dirname, directory));
    
    var finalIndex = {};
    await Promise.all(files.map(async file => {
        var data = JSON.parse(await fs.promises.readFile(path.join(__dirname, directory, file)));
        data.forEach(entry => finalIndex[entry.name] = "/" + directory + "/batch/"+ file);
    }));

    return finalIndex;
}

// Parse all files, then start the server.
Promise.all([
    // Use Object.assign to preserve references that were given to endpoints.
    indexJsonDefinitions("events").then(index => Object.assign(eventLocations, index)),
    indexJsonDefinitions("qualities").then(index => Object.assign(qualityLocations,  index))
]).then(() => {
    console.log(eventLocations);
    console.log(qualityLocations);
    expressApp.listen(8080);
}).catch(error => {
    console.error("Error while initializing server:");
    console.error(error);
    process.exit(-1);
});
// DO NOT PUT CODE BELOW THIS LINE! IT MAY NOT RUN BEFORE THE SERVER STARTS.

var loadingText = "<p>Loading...</p>";

var cachingEnabled = false;

var knownEvents = {};
// Returns the parsed event as a promise.
function fetchEvent(eventName) {
    if (cachingEnabled && knownEvents[eventName]) {
        return Promise.resolve(knownEvents[eventName]);
    }

    return fetch("/events/" + encodeURIComponent(eventName) + ".json")
        .then(response => response.json())
        .then(responseBody => {
        responseBody.forEach(event => {
            knownEvents[event.name] = event;
            if (event.options) {
                event.options.forEach(option => {
                    if (!option.buttonText) {
                        option.buttonText = "Go";
                    }
                });
            }
        });

        // TODO: prefetch child events
        return knownEvents[eventName];
    });
}

class Story {
    async render() {
        tabContentElement.innerHTML = loadingText;
        var template = await this.templatePromise;
        var event =  await this.eventPromise;
        // Ensure that this is still the current tab before overwriting.
        if (currentTab == "story") {
            tabContentElement.innerHTML = Mustache.render(template, event);
        }
    }

    constructor(cookie) {
        // TODO: Load data from cookies
        this.eventName = "brimhaven.hub";
        this.eventPromise = fetchEvent(this.eventName);
        this.templatePromise = fetch("/static/deck.mustache")
            .then(response => response.text());
    }

    setEvent(eventName) {
        this.eventName = eventName;
        this.eventPromise = fetchEvent(eventName);
    }
}

class Inventory {
    constructor(cookie) {
        // TODO: Load data from cookies
        this.size = 20;
        this.items = [];
        this.attributes = [];
        this.stats = [];
    }

    render() {
        return loadingText;
    }
}

class Equipment {
    constructor(cookie) {
        // TODO: Load data from cookies
        this.wearing = [];
    }

    render() {
        return loadingText;
    }
}

class Map {
    constructor(cookie) {
        // TODO: Load data from cookies
        this.position = {x: 225, y: 464};
        this.canvas = document.getElementById("mapCanvas");
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.overworldDeck = document.getElementById("mapCards");
        this.overworldDeck.hidden = true;
        this.mapImage = new Image();
        this.mapImage.src = "/static/Map.png";
        this.template = undefined;
        this.templatePromise = fetch("/static/overworldDeck.mustache")
            .then(response => response.text())
            .then(template => this.template = template);
        this.overworldData = undefined;
        this.overworldDataPromise = fetch("/static/mapMetadata.json")
            .then(response => response.json())
            .then(data => this.overworldData = data);

        this.chartedCourse = undefined;
        this.quillMoved = false;
        this.shouldMove = false;

        this.mapImage.onload = () => this.renderCanvas();
        this.mouseDraggedCallback = () => this.mouseDragged();
        this.canvas.onmousedown = () => this.mousePressed();
        this.canvas.onmouseup = () => this.mouseReleased();
        this.pauseRendering = true;
        this.nearestHub = undefined;

        window.onload = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.pauseRendering = false;
        };
        window.onresize = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
        };
    }

    renderCanvas() {
        if (!this.mapImage.complete || this.mapImage.naturalWidth === 0) {
            // Wait for the map image to load.
            this.mapImage.onload = () => this.renderCanvas();
            return;
        }
        // Shoot for 30fps. Note that we don't use setInterval.
        window.setTimeout(() => this.renderCanvas(), 1/30 * 1000);
        if (this.pauseRendering) {
            return;
        }
        this.update();

        var context = this.canvas.getContext("2d");
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        var origin = this._toScreenPosition({x: 0, y: 0});
        context.drawImage(this.mapImage, origin.x, origin.y);
        context.fillStyle = "rgb(255, 0, 0)";
        context.beginPath();
        context.arc(this.canvas.width / 2, this.canvas.height / 2, 10, 0, Math.PI * 2);
        context.fill();
        
        if (this.chartedCourse && this.quillMoved) {
            context.strokeStyle = "rgb(0)"
            context.lineWidth = 6;
            context.setLineDash([8, 8]);
            context.beginPath();
            if (this.shouldMove) {
                // Draw the line in reverse order, so that moving along the line doesn't move the dashes.
                var nextPoint = this._toScreenPosition(this.chartedCourse[this.chartedCourse.length - 1]);
                context.moveTo(nextPoint.x, nextPoint.y);
                for (var i = this.chartedCourse.length - 2; i >= 0; i--) {
                    nextPoint = this._toScreenPosition(this.chartedCourse[i]);
                    context.lineTo(nextPoint.x, nextPoint.y);
                }
                nextPoint = this._toScreenPosition(this.position);
                context.lineTo(nextPoint.x, nextPoint.y);
            } else {
                // Draw in normal order, so that extending the line doesn't move the dashes.
                var nextPoint = this._toScreenPosition(this.position);
                context.moveTo(nextPoint.x, nextPoint.y);
                for (var i = 0; i < this.chartedCourse.length; i++) {
                    nextPoint = this._toScreenPosition(this.chartedCourse[i]);
                    context.lineTo(nextPoint.x, nextPoint.y);
                }
            }
            context.stroke();
        }
    }

    _getMouse() {
        var bounds = this.canvas.getBoundingClientRect();
        var mouseX = window.event.clientX - bounds.left;
        var mouseY = window.event.clientY - bounds.top;
        return {x: mouseX, y: mouseY};
    }

    _sqDistance(point1, point2) {
        var deltaX = point1.x - point2.x;
        var deltaY = point1.y - point2.y;
        return deltaX * deltaX + deltaY * deltaY;
    }

    _toScreenPosition(mapPoint) {
        var originX = this.canvas.width / 2 - this.position.x;
        var originY = this.canvas.height / 2 - this.position.y;

        return {
            x: originX + mapPoint.x,
            y: originY + mapPoint.y
        };
    }

    _toMapPosition(screenPoint) {
        var originX = this.canvas.width / 2 - this.position.x;
        var originY = this.canvas.height / 2 - this.position.y;

        return {
            x: screenPoint.x - originX,
            y: screenPoint.y - originY
        };
    }

    mousePressed() {
        var mouse = this._toMapPosition(this._getMouse());
        this.chartedCourse = [this.position, mouse];
        
        this.canvas.onmousemove = this.mouseDraggedCallback;
        this.quillMoved = false;
        this.shouldMove = false;
    }

    mouseReleased() {
        this.chartedCourse.push(this._toMapPosition(this._getMouse()));
        this.canvas.onmousemove = undefined;
        if (!this.quillMoved) {
            this.chartedCourse = undefined;
        } else {
            this.shouldMove = true;
        }
    }

    mouseDragged() {
        var lastMouse = this.chartedCourse[this.chartedCourse.length - 1];
        var currentMouse = this._toMapPosition(this._getMouse());
        if (this._sqDistance(lastMouse, currentMouse) > 10 * 10) {
            this.chartedCourse.push(currentMouse);
            this.quillMoved = true;
        }
    }

    update() {
        if (this.chartedCourse && this.shouldMove) {
            var SPEED = 1;
            this._move(SPEED);
        }
        
        if (this.overworldData) {
            var newNearestHub = undefined;
            var newNearestSqDist = -1;
            this.overworldData.cities.forEach(city => {
                if (!city.hubEvent) {
                    return;
                }
                var sqDist = this._sqDistance(this.position, city);
                if ((!newNearestHub || sqDist < newNearestSqDist) && sqDist <= city.radius * city.radius) {
                    newNearestHub = city;
                    newNearestSqDist = sqDist;
                }
            });
            if (!newNearestHub) {
                this.nearestHub = undefined;
                this.overworldDeck.innerHTML = "";
            } else if (!this.nearestHub || this.nearestHub.name !== newNearestHub.name) {
                this.nearestHub = newNearestHub;
                Promise.all([this.templatePromise, fetchEvent(newNearestHub.hubEvent)]).then((promisedValues) => {
                    var cards = [{
                        title: promisedValues[1].title,
                        description: promisedValues[1].description,
                        onclick: "map.openEvent('" + promisedValues[1].name + "');",
                    }];
                    this.overworldDeck.innerHTML = Mustache.render(this.template, {cards: cards});
                });
            }
        }
    }

    // Called by overworldDeck cards.
    openEvent(eventName) {
        toggleJournal(true);
        tabs["story"].instance.setEvent(eventName);
        setTab("story");
    }

    _move(distance) {
        var nextPoint = this.chartedCourse[0];
        var nextDistance = Math.sqrt(this._sqDistance(this.position, nextPoint));
        if (nextDistance < distance) {
            this.position = this.chartedCourse[0];
            if (this.chartedCourse.length == 1) {
                this.chartedCourse = undefined;
            } else {
                this.chartedCourse.splice(0, 1);
                this._move(Math.abs(distance - nextDistance));
            }
        } else {
            // Interpolate
            var proportion = distance / nextDistance;
            this.position = {
                x: this.position.x * (1 - proportion) + nextPoint.x * proportion,
                y: this.position.y * (1 - proportion) + nextPoint.y * proportion
            };
        }
    }
}

// TODO: Get cookies
var tabs = {
    "story": {
        "element": document.getElementById("tab-story"),
        "instance": new Story(document.cookie)
    },
    "inventory": {
        "element": document.getElementById("tab-inventory"),
        "instance": new Inventory(document.cookie)
    },
    "equipment": {
        "element": document.getElementById("tab-equipment"),
        "instance": new Equipment(document.cookie)
    }
};
var map = new Map(document.cookie);
var currentTab = "story";
var tabContentElement = document.getElementById("tab-content");
var journalElement = document.getElementById("journal");

var journalActive = true;

function toggleJournal(newState) {
    if (newState === journalActive) {
        return;
    }
    journalActive = newState;
    if (journalActive) {
        map.overworldDeck.hidden = true;
        journalElement.classList.add("is-active");
    } else {
        map.overworldDeck.hidden = false;
        journalElement.classList.remove("is-active");
    }
}

function setTab(name, override) {
    if (currentTab == name && !override) {
        return;
    }
    tabs[currentTab].element.classList.remove("is-active");
    tabs[name].element.classList.add("is-active"); 
    currentTab = name;
    renderTab(currentTab);
    if (name == "map") {
        tabContentElement.classList.remove("container");
    } else if (!tabContentElement.classList.contains("container")) {
        tabContentElement.classList.add("container");
    }
}

function renderTab(tab) {
    tabs[tab].instance.render();
}

// First load
setTab("story", true);
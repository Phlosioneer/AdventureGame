
var loadingText = "<p>Loading...</p>";

var cachingEnabled = false;

var knownEvents = {};
class Story {
    render() {
        if (this.template === undefined || this.event === undefined) {
            if (this.templatePromise === undefined) {
                console.log("template promise missing");
            }
            if (this.eventPromise === undefined) {
                console.log("event promise missing");
            }
            Promise.all([this.templatePromise, this.eventPromise]).then(() => setTab("story", true));
            return loadingText;
        }
        return Mustache.render(this.template, this.event);
    }

    // Returns the parsed event as a promise.
    fetchEvent(eventName) {
        if (cachingEnabled && knownEvents[eventName]) {
            return Promise.resolve(knownEvents[eventName]);
        }

        return fetch("/events/" + encodeURIComponent(eventName) + ".json")
            .then(response => response.json())
            .then(responseBody => {
            responseBody.forEach(function (event) {
                knownEvents[event.name] = event;
                if (event.options) {
                    event.options.forEach(function (option) {
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

    constructor(cookie) {
        // TODO: Load data from cookies
        this.eventName = "brimhaven.hub";
        this.event = undefined;
        this.template = undefined;
        this.eventPromise = this.fetchEvent(this.eventName)
            .then(event => this.event = event);
        this.templatePromise = fetch("/static/story.mustache")
            .then(response => response.text())
            .then(template => this.template = template);
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
        this.template = undefined;
        this.canvas = undefined;
        this.templatePromise = fetch("/static/map.mustache")
            .then(response => response.text())
            .then(text => this.template = text);
        this.mapImage = new Image();
        this.mapImage.src = "/static/Map.png";

        this.chartedCourse = undefined;
        this.quillMoved = false;
        this.shouldMove = false;

        var instance = this;
        this.mouseDraggedCallback = () => instance.mouseDragged();
    }

    render() {
        if (this.template === undefined) {
            this.templatePromise.then(() => setTab("map", true));
            return loadingText;
        }

        // This fires when a <canvas> is added to the tabContent element.
        var observer = new MutationObserver((mutationList, observer) => {
            for (var i = 0; i < mutationList.length; i++) {
                var mutation = mutationList[i];
                if (mutation.addedNodes.length == 0) {
                    continue;
                }
                
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType == 1 && node.tagName == "CANVAS") {
                        // We've loaded the canvas.
                        observer.disconnect();
                        this.canvas = node;
                        this.canvas.width = this.canvas.offsetWidth;
                        this.canvas.height = this.canvas.offsetHeight;
                        var instance = this;
                        this.canvas.onmousedown = () => instance.mousePressed();
                        this.canvas.onmouseup = () => instance.mouseReleased();
                        this.renderCanvas();
                    }
                }
            }
        });
        observer.observe(tabContentElement, {childList: true});
        return this.template;
    }

    renderCanvas() {
        if (!this.mapImage.complete || this.mapImage.naturalWidth === 0) {
            // Wait for the map image to load.
            var instance = this;
            this.mapImage.onload = () => instance.renderCanvas;
            return;
        }
        if (!this.canvas) {
            // Wait for the canvas to load.
            return;
        }
        if (currentTab != "map") {
            // The map isn't focused, so stop the loop.
            return;
        }
        // Shoot for 30fps. Note that we don't use setInterval.
        var instance = this;
        window.setTimeout(() => instance.renderCanvas(), 1/30 * 1000);

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
        if (!this.chartedCourse || !this.shouldMove) {
            return;
        }
        var SPEED = 1;
        this._move(SPEED);
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
    },
    "map": {
        "element": document.getElementById("tab-map"),
        "instance": new Map(document.cookie)
    }
};
var currentTab = "story";
var tabContentElement = document.getElementById("tab-content");

function setTab(name, override) {
    if (currentTab == name && !override) {
        return;
    }
    tabs[currentTab].element.classList.remove("is-active");
    tabs[name].element.classList.add("is-active"); 
    currentTab = name;
    tabContentElement.innerHTML = renderTab(currentTab);
    if (name == "map") {
        tabContentElement.classList.remove("container");
    } else if (!tabContentElement.classList.contains("container")) {
        tabContentElement.classList.add("container");
    }
}

function renderTab(tab) {
    return tabs[tab].instance.render();
}

// First load
setTab("map", true);
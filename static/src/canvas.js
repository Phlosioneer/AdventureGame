class ListenerList {
    constructor() {
        this.listeners = [];
        this.isIterating = false;

        this.overflowEvents = [];
    }

    trigger(arg) {
        if (this.listeners.length == 0) {
            return;
        }
        this.isIterating = true;
        this.listeners.forEach(listener => {
            if (listener) {
                listener(arg);
            }
        });
        this.isIterating = false;
        
        this.overflowEvents.forEach(event => {
            if (event.isRemove) {
                this.removeListener(event.listener);
            } else {
                this.addListener(event.listener);
            }
        });
        this.overflowEvents = [];
    }

    removeListener(listener) {
        if (!listener) {
            console.warn("ListenerList.removeListener(" + listener + ") is a no-op.");
            return;
        }
        if (this.isIterating) {
            this.overflowEvents.push({
                isRemove: true,
                listener: listener
            });
            return;
        }
        var index = this.listeners.indexOf(listener);
        if (index == -1) {
            return;
        }
        this.listeners[index] = null;
    }

    addListener(listener) {
        if (!listener) {
            console.warn("ListenerList.addListener(" + listener + ") is a no-op.");
            return;
        }
        if (this.isIterating) {
            this.overflowEvents.push({
                isRemove: false,
                listener: listener
            });
            return;
        }
        var index = this.listeners.indexOf(null);
        if (index == -1) {
            this.listeners.push(listener);
        } else {
            this.listeners[index] = listener;
        }
    }
}

// Manages all the messy details around the canvas element.
class CanvasManager {
    constructor(canvas, renderFunction, frameRate) {
        this.canvas = canvas;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        this.mouseIsDown = false;
        // Pause rendering until the element loads.
        this.pauseRendering = true;

        this.mousePressedListeners = new ListenerList();
        this.mouseReleasedListeners = new ListenerList();
        this.mouseDraggedListeners = new ListenerList();

        this.mouseDraggedCallback = () => this.mouseDragged();
        this.canvas.onmousedown = () => this.mousePressed();
        this.canvas.onmouseup = () => this.mouseReleased();
        this.canvas.onmouseout = () => this.mouseReleased();

        // Currently, window.onload is the only way to be sure that the
        // element has finished loading.
        window.onload = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
            this.pauseRendering = false;
        };
        window.onresize = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
        };

        this.renderFunction = renderFunction;
        this.frameRate = frameRate;

        // This will fail (because of pauseRendering), but it will schedule
        // itself correctly.
        this.tryRender();
    }

    mousePressed() {
        this.mousePressedListeners.trigger(this.getMouse());
        this.canvas.onmousemove = this.mouseDraggedCallback;
        this.mouseIsDown = true;
    }

    mouseReleased() {
        if (this.mouseIsDown) {
            this.mouseReleasedListeners.trigger(this.getMouse());
        }
        this.canvas.onmousemove = undefined;
        this.mouseIsDown = false;
    }

    mouseDragged() {
        this.mouseDraggedListeners.trigger(this.getMouse());
    }

    tryRender() {
        // Shoot for a stable fps. Note that we don't use setInterval.
        window.setTimeout(() => this.tryRender(), 1/this.fps * 1000);
        if (this.pauseRendering || !this.renderFunction) {
            return;
        }

        this.renderFunction();
    }

    getMouse() {
        var bounds = this.canvas.getBoundingClientRect();
        var mouseX = window.event.clientX - bounds.left;
        var mouseY = window.event.clientY - bounds.top;
        return {x: mouseX, y: mouseY};
    }
}

class Camera {
    constructor(startPosition, canvas) {
        this.position = startPosition;
        this.canvas = canvas;
    }

    toScreenPosition(mapPoint) {
        var originX = this.canvas.width / 2 - this.position.x;
        var originY = this.canvas.height / 2 - this.position.y;

        return {
            x: originX + mapPoint.x,
            y: originY + mapPoint.y
        };
    }

    toMapPosition(screenPoint) {
        var originX = this.canvas.width / 2 - this.position.x;
        var originY = this.canvas.height / 2 - this.position.y;

        return {
            x: screenPoint.x - originX,
            y: screenPoint.y - originY
        };
    }
}

class Map {
    constructor(cookie) {
        // TODO: Load data from cookies
        this.canvas = document.getElementById("mapCanvas");
        this.camera = new Camera({x: 585, y: 1105}, this.canvas);
        
        this.manager = new CanvasManager(this.canvas, undefined, 30);
        this.manager.mouseDraggedListeners.addListener(this.mouseDragged.bind(this));
        this.manager.mousePressedListeners.addListener(this.mousePressed.bind(this));
        this.manager.mouseReleasedListeners.addListener(this.mouseReleased.bind(this));
        
        fetchManager.getTemplate("overworldDeck");
        this.overworldDeck = document.getElementById("mapCards");
        this.overworldDeck.hidden = true;
        this.overworldData = undefined;
        this.overworldDataPromise = fetch("/static/mapMetadata.json")
            .then(response => response.json())
            .then(data => this.overworldData = data);
        this.nearestHub = undefined;
        
        this.mapImage = new Image();
        this.mapImage.src = "/static/images/Map.png";
        this.mapImage.onload = () => {
            this.manager.renderFunction = () => this.renderCanvas();
        };

        this.chartedCourse = undefined;
        this.quillMoved = false;
        this.shouldMove = false;
    }

    renderCanvas() {
        if (!this.mapImage.complete || this.mapImage.naturalWidth === 0) {
            // Wait for the map image to load.
            return;
        }
        this.update();

        var context = this.canvas.getContext("2d");
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        var origin = this.camera.toScreenPosition({x: 0, y: 0});
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
                var nextPoint = this.camera.toScreenPosition(this.chartedCourse[this.chartedCourse.length - 1]);
                context.moveTo(nextPoint.x, nextPoint.y);
                for (var i = this.chartedCourse.length - 2; i >= 0; i--) {
                    nextPoint = this.camera.toScreenPosition(this.chartedCourse[i]);
                    context.lineTo(nextPoint.x, nextPoint.y);
                }
                nextPoint = this.camera.toScreenPosition(this.camera.position);
                context.lineTo(nextPoint.x, nextPoint.y);
            } else {
                // Draw in normal order, so that extending the line doesn't move the dashes.
                var nextPoint = this.camera.toScreenPosition(this.camera.position);
                context.moveTo(nextPoint.x, nextPoint.y);
                for (var i = 0; i < this.chartedCourse.length; i++) {
                    nextPoint = this.camera.toScreenPosition(this.chartedCourse[i]);
                    context.lineTo(nextPoint.x, nextPoint.y);
                }
            }
            context.stroke();
        }
    }

    _sqDistance(point1, point2) {
        var deltaX = point1.x - point2.x;
        var deltaY = point1.y - point2.y;
        return deltaX * deltaX + deltaY * deltaY;
    }

    mousePressed(screenMouse) {
        var mouse = this.camera.toMapPosition(screenMouse);
        this.chartedCourse = [this.camera.position, mouse];
        
        this.canvas.onmousemove = this.mouseDraggedCallback;
        this.quillMoved = false;
        this.shouldMove = false;
    }

    mouseReleased(screenMouse) {
        this.chartedCourse.push(this.camera.toMapPosition(screenMouse));
        this.canvas.onmousemove = undefined;
        if (!this.quillMoved) {
            this.chartedCourse = undefined;
        } else {
            this.shouldMove = true;
        }
    }

    mouseDragged(screenMouse) {
        var lastMouse = this.chartedCourse[this.chartedCourse.length - 1];
        var currentMouse = this.camera.toMapPosition(screenMouse);
        if (this._sqDistance(lastMouse, currentMouse) > 10 * 10) {
            this.chartedCourse.push(currentMouse);
            this.quillMoved = true;
        }
    }

    update() {
        if (this.chartedCourse && this.shouldMove) {
            var SPEED = 0.5;
            this._move(SPEED);
        }
        
        if (this.overworldData) {
            var newNearestHub = undefined;
            var newNearestSqDist = -1;
            this.overworldData.cities.forEach(city => {
                if (!city.hubEvent) {
                    return;
                }
                var sqDist = this._sqDistance(this.camera.position, city);
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
                (async () => {
                    var event = await fetchManager.getEvent(newNearestHub.hubEvent);
                    var template = await fetchManager.getTemplate("overworldDeck");
                    var cards = [{
                        title: event.title,
                        description: event.description,
                        onclick: "map.openEvent('" + event.name + "');",
                    }];
                    // Ensure that this rendering is still useful before overwriting.
                    if (this.nearestHub && this.nearestHub.hubEvent === event.name) {
                        this.overworldDeck.innerHTML = Mustache.render(template, {cards: cards});
                    }
                })();
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
        var nextDistance = Math.sqrt(this._sqDistance(this.camera.position, nextPoint));
        if (nextDistance < distance) {
            this.camera.position = this.chartedCourse[0];
            if (this.chartedCourse.length == 1) {
                this.chartedCourse = undefined;
            } else {
                this.chartedCourse.splice(0, 1);
                this._move(Math.abs(distance - nextDistance));
            }
        } else {
            // Interpolate
            var proportion = distance / nextDistance;
            this.camera.position = {
                x: this.camera.position.x * (1 - proportion) + nextPoint.x * proportion,
                y: this.camera.position.y * (1 - proportion) + nextPoint.y * proportion
            };
        }
    }
}
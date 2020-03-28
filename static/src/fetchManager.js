
class FetchManager {
    constructor() {
        this.templates = {};
        this.templatePromises = {};
        this.events = {};
        this.eventPromises = {};
        this.qualities = {};
        this.qualityPromises = {};

        this.cachingEnabled = false;
    }

    _getResource(name, resolved, promises, urlPrefix, kind, postprocess) {
        if (!name) {
            return Promise.reject("Undefined event");
        }
        if (this.cachingEnabled && resolved[name]) {
            return Promise.resolve(resolved[name]);
        }

        if (promises[name]) {
            return promises[name];
        }

        var promise = undefined;
        if (kind == "json") {
            promise = fetch(urlPrefix + encodeURIComponent(name) + ".json")
                .then(response => response.json())
                .then(responseBody => {
                    responseBody.forEach(resource => {
                        resolved[resource.name] = resource;
                        if (postprocess) {
                            postprocess(resource);
                        }
                    });
                    return resolved[name];
                });
        } else if (kind == "mustache") {
            promise = fetch(urlPrefix + encodeURIComponent(name) + ".mustache")
                .then(response => response.text())
                .then(template => {
                    resolved[name] = template;
                    return template;
                });
        } else {
            return Promise.reject("Unknown resource kind: " + kind);
        }
    
        
        promises[name] = promise;
        return promise;
    }

    getQuality(qualityName) {
        return this._getResource(
            qualityName,
            this.qualities,
            this.qualityPromises,
            "/qualities/",
            "json",
            quality => {
                quality.imagePrefetch = new Image();
                quality.imagePrefetch.src = quality.icon;
            });
    }

    getEvent(eventName) {
        return this._getResource(
            eventName,
            this.events,
            this.eventPromises,
            "/events/",
            "json");
    }

    getTemplate(templateName) {
        return this._getResource(
            templateName,
            this.templates,
            this.templatePromises,
            "/static/templates/",
            "mustache");
    }
}

var fetchManager = new FetchManager();
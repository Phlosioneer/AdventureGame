
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
            "json",
            event => this._processEvent(event));
    }

    getTemplate(templateName) {
        return this._getResource(
            templateName,
            this.templates,
            this.templatePromises,
            "/static/",
            "mustache");
    }

    _processEvent(event) {
        // Set default button text.
        if (event.options) {
            event.options.forEach(option => {
                if (!option.buttonText) {
                    option.buttonText = "Go";
                }
            });
        }
    
        // Merge the description lines, if it's an array.
        if (event.description instanceof Array) {
            var merged = "";
            event.description.forEach(line => merged += line);
            event.description = merged;
        }
        
        // Replace ASCII newlines with HTML ones.
        event.description = event.description.replace("\n", "<br/>");
    
        // Prefetch and render qualities.
        if (event.options) {
            /*var requiredQualityPromises = [];
            requiredQualityPromises.push(this.getTemplate("qualityList"));
            event.options.forEach(option => {
                if (option.requirements) {
                    option.requirements.forEach(requirement => {
                        var promise = this.getQuality(requirement.property);
                        requiredQualityPromises.push(promise);
                        if (requirement.comparedToProperty) {
                            var promise = this.getQuality(requirement.comparedToProperty);
                            requiredQualityPromises.push(promise);
                        }
                    });
                }
            });

            if (requiredQualityPromises.length == 1) {
                event.renderedQualities = "";
                event.renderedQualitiesPromise = Promise.resolve("");
            } else {
                event.renderedQualities = undefined;
                event.renderedQualitiesPromise = Promise.all(requiredQualityPromises)
                    .then(promisedValues => {
                        var template = promisedValues[0];
                        var qualities = promisedValues.splice(1);
                        event.renderedQualities = Mustache.render(template, {qualities: qualities});
                    });
            }*/
        }
    }
}

var fetchManager = new FetchManager();
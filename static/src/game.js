
var loadingText = "<p>Loading...</p>";

class Story {
    async render() {
        tabContentElement.innerHTML = loadingText;
        var template = await fetchManager.getTemplate("deck");
        var event =  await fetchManager.getEvent(this.eventName);
        var partials = {
            requirement: await fetchManager.getTemplate("requirement")
        };

        var options = await Promise.all(event.options.map(this.renderOption.bind(this)));
        var renderData = {
            title: event.title,
            description: this.renderText(event.description),
            options: options
        };

        // Ensure that this is still the current tab before overwriting.
        if (currentTab == "story") {
            tabContentElement.innerHTML = Mustache.render(template, renderData, partials);
        }
    }

    async renderOption(option) {
        if (!option.requirements) {
            option.requirements = [];
        }
        var requirements = await Promise.all(option.requirements.map(this.renderRequirement.bind(this)));
        requirements = requirements.filter(element => element !== undefined);
        var buttonText = option.buttonText;
        if (!buttonText) {
            buttonText = "Go";
        }

        return {
            title: option.title,
            description: this.renderText(option.description),
            hasRequirements: option.requirements.length != 0,
            requirements: requirements,
            buttonText: buttonText
        };
    }

    async renderRequirement(requirement) {
        if (requirement.hidden) {
            return undefined;
        }
        var quality = await fetchManager.getQuality(requirement.property);
        return {
            name: quality.displayName,
            icon: quality.icon,
            description: this.renderText("You have at least 5 of this.")
        };
    }

    renderText(text) {
        // Merge the description lines, if it's an array.
        if (text instanceof Array) {
            var merged = "";
            text.forEach(line => merged += line);
            text = merged;
        }

        // Replace ASCII newlines with HTML ones.
        return text.replace("\n", "<br/>");
    }

    constructor(cookie) {
        // TODO: Load data from cookies
        this.eventName = "haven.hub";
        fetchManager.getEvent(this.eventName);
        fetchManager.getTemplate("deck");
        fetchManager.getTemplate("requirement");
    }

    setEvent(eventName) {
        this.eventName = eventName;
        fetchManager.getEvent(eventName);
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
        tabContentElement.innerHTML = loadingText;
    }
}

class Equipment {
    constructor(cookie) {
        // TODO: Load data from cookies
        this.wearing = [];
    }

    render() {
        tabContentElement.innerHTML =  loadingText;
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
}

function renderTab(tab) {
    tabs[tab].instance.render();
}

// First load
setTab("story", true);
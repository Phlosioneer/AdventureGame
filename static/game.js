
var loadingText = "<p>Loading...</p>";

class Story {
    async render() {
        tabContentElement.innerHTML = loadingText;
        var template = await fetchManager.getTemplate("deck");
        var event =  await fetchManager.getEvent(this.eventName);
        // Ensure that this is still the current tab before overwriting.
        if (currentTab == "story") {
            tabContentElement.innerHTML = Mustache.render(template, event);
        }
    }

    constructor(cookie) {
        // TODO: Load data from cookies
        this.eventName = "brimhaven.hub";
        fetchManager.getEvent(this.eventName);
        fetchManager.getTemplate("deck");
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
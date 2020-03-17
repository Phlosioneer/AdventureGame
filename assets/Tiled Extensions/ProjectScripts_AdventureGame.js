
function exportMetadata() {
	if (!tiled.activeAsset) {
		tiled.error("No active file to export.");
		return;
	}
	if (!tiled.activeAsset.isTileMap) {
		tiled.error("Can only export metadata on maps.");
		return;
	}
	var document = tiled.activeAsset;
	var outputFilePath = document.property("outputFile");
	if (!outputFilePath) {
		tiled.error("Map needs an 'outputFile' property.");
		return;
	}
	if (typeof outputFilePath != "string") {
		tiled.error("'outputFile' property must be a string value.");
		return;
	}
	var cities = null;
	var regions = null;
	var roads = null;
	for (var i = 0; i < document.layerCount; i++) {
		var layer = document.layerAt(i);
		if (layer.name == "Roads") {
			roads = exportRoads(layer);
		} else if (layer.name == "Regions") {
			regions = exportRegions(layer);
		} else if (layer.name == "Cities") {
			cities = exportCities(layer);
		}
	}
	
	if (cities == null) {
		tiled.error("Layer not found: 'Cities'");
		return;
	}
	if (regions == null) {
		tiled.error("Layer not found: 'Regions'");
		return;
	}
	if (roads == null) {
		tiled.error("Layer not found: 'Roads'");
		return;
	}
	
	var json = {
		cities: cities,
		regions: regions,
		roads: roads
	};
	var outputFile = new TextFile(outputFilePath, TextFile.WriteOnly);
	outputFile.write(jsonDump(json));
	outputFile.commit();
	outputFile.close();
	tiled.log("Export complete!");
}

function exportRegions(layer) {
	var objects = layer.objects;
	var ret = [];
	for (var i = 0; i < objects.length; i++) {
		var current = objects[i];
		if (current.shape != MapObject.Rectangle) {
			tiled.warn("Regions must be rectangles (Object with id " + current.id + " is not a rectangle)");
			continue;
		}
		
		ret.push({
			name: current.name,
			x: current.x,
			y: current.y,
			width: current.width,
			height: current.height
		});
	}
	return ret;
}

function exportCities(layer) {
	var objects = layer.objects;
	var ret = [];
	for (var i = 0; i < objects.length; i++) {
		var current = objects[i];
		if (current.shape != MapObject.Ellipse || current.width != current.height) {
			tiled.warn("Cities must be circles (Object with id " + current.id + " is not a circle)");
			continue;
		}
		
		ret.push({
			name: current.name,
			x: current.x,
			y: current.y,
			radius: current.width,
			hubEvent: current.property("hubEvent")
		});
	}
	return ret;
}

var ROAD_INTERVAL = 10;
function exportRoads(layer) {
	var objects = layer.objects;
	var ret = [];
	for (var i = 0; i < objects.length; i++) {
		var current = objects[i];
		if (current.shape != MapObject.Polyline) {
			tiled.warn("Roads must be polylines (Object with id " + current.id + " is not a polyline)");
		}
		
		var rawPoints = current.polygon;
		for (var j = 0; j < rawPoints.length; j++) {
			rawPoints[j].x += current.x;
			rawPoints[j].y += current.y;
		}
		
		var points = [];
		var residualDistance = 0;
		for (var j = 0; j < rawPoints.length - 1; j++) {
			var currentPoint = rawPoints[j];
			var nextPoint = rawPoints[j + 1];
			var deltaX = currentPoint.x - nextPoint.x;
			var deltaY = currentPoint.y - nextPoint.y;
			var dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
			for (var k = residualDistance; k < dist; k += ROAD_INTERVAL) {
				var percent = k / dist;
				var x = currentPoint.x * (1 - percent) + nextPoint.x * percent;
				var y = currentPoint.y * (1 - percent) + nextPoint.y * percent;
				points.push({x: x, y: y});
			}
			residualDistance = dist - (k - 1);
		}
		points.push(rawPoints[rawPoints.length - 1]);
		
		ret.push({
			name: current.name,
			points: points
		});
	}
	return ret;
}

function jsonDump(data, indent = 0, indentBy = "\t") {
	if (data === undefined || data === null) {
		return "null";
	}
	if (typeof data == "number") {
		return String(data);
	}
	if (typeof data == "string") {
		return "\"" + data + "\"";
	}
	if (typeof data == "boolean") {
		if (data) {
			return "true";
		} else {
			return "false";
		}
	}
	var outerIndent = "";
	for (var i = 0; i < indent; i++) {
		outerIndent += indentBy;
	}
	var innerIndent = outerIndent + indentBy;
	if (data instanceof Array) {
		var ret = "[\n";
		for (var i = 0; i < data.length; i++) {
			ret += innerIndent + jsonDump(data[i], indent + 1, indentBy);
			if (i + 1 != data.length) {
				ret += ",";
			}
			ret += "\n";
		}
		ret += outerIndent + "]";
		return ret;
	}
	var ret = "{\n";
	var keys = Object.keys(data);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		ret += innerIndent + "\"" + key + "\": " + jsonDump(data[key], indent + 1, indentBy);
		if (i + 1 != keys.length) {
			ret += ",";
		}
		ret += "\n";
	}
	ret += outerIndent + "}";
	return ret;
}

var action = tiled.registerAction("Export Metadata", exportMetadata);
action.text = "Export Metadata";

tiled.extendMenu("Edit", [
	{ separator: true },
	{ action: "Export Metadata" }
]);
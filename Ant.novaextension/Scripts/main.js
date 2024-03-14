const xmlToJson = require('./xml-to-json/xmlToJsonStream.js');
const { showNotification, consoleLogObject } = require("./nova-utils.js");

var treeView = null;
var buildXmlFileName = "build.xml";

/**
 * Opens a file and dumps it into a string.
 * @param {string} filename - The name of the file to open, relative to the workspace
 * @param {boolean} trimAll - Default: true. Trims each line, and removes extra spacing (useful for pjxml and our XML files!)
 */
function getStringOfWorkspaceFile(filename, trimAll = true) {
	var line, contents;
	try {
		contents = "";
		//console.log("Trying to open: " + nova.path.join(nova.workspace.path, filename));
		var file = nova.fs.open(nova.path.join(nova.workspace.path, filename));
		if(file) {
			do {
				line = file.readline();
				if(line!=null) {
					if(trimAll) {
						line = line.trim();
					}
					contents += line;
				}
			} while(line && line.length>0);
		}

		if(trimAll) {
			contents = contents.replace((/  |\r\n|\n|\r/gm),"");  // contents.replace(/(\r\n|\n|\r)/gm,"")
		}
	} catch(error) {
		console.log("*** ERROR: Could not open file " + nova.path.join(nova.workspace.path, filename) + " for reading. ***");
		return null;
	}
	return contents;
}

exports.activate = function() {
	// Do work when the extension is activated
	exports.loadAndParseBuildXML(buildXmlFileName);

	nova.fs.watch(nova.path.join(nova.workspace.path, buildXmlFileName), () => {
		console.log("File changed.. reload!");
	});
}

exports.loadAndParseBuildXML = function(filename) {
	// If there's a build.xml, parse it

	var buildXmlString = getStringOfWorkspaceFile("build.xml",false);

	// If not a valid or empty XML, clear the window
	if(buildXmlString==null || buildXmlString=="") {
		treeView = new TreeView("antsidebar", {
			dataProvider: null
		});
		return ;
	}

	// Parse the XML to JSON.
	var buildJson = new xmlToJson.XMLtoJSON(buildXmlString);
/*
	console.log("\n\n\n\n DONE PARSING \n\n\n");
	consoleLogObject(buildJson.json);
	console.log("Project name should be: "+buildJson.json.project.name);
	console.log("Project targets should be: "+buildJson.json.project.target);
*/
	// Create the TreeView
	treeView = new TreeView("antsidebar", {
		dataProvider: new AntDataProvider(buildJson.json.project.name,buildJson.json.project.target)
	});

	treeView.onDidChangeSelection((selection) => {
		// console.log("New selection: " + selection.map((e) => e.name));
	});

	treeView.onDidExpandElement((element) => {
		// console.log("Expanded: " + element.name);
	});

	treeView.onDidCollapseElement((element) => {
		// console.log("Collapsed: " + element.name);
	});

	treeView.onDidChangeVisibility(() => {
		// console.log("Visibility Changed");
	});

	// TreeView implements the Disposable interface
	nova.subscriptions.add(treeView);
}

exports.deactivate = function() {
	// Clean up state before the extension is deactivated
}

nova.commands.register("antsidebar.doubleClick", () => {
	// Invoked when an item is double-clicked
	let selection = treeView.selection;
	console.log("DoubleClick: " + selection.map((e) => e.name));
});

nova.commands.register("antsidebar.run", () => {
	// Invoked when an item is double-clicked
	let selection = treeView.selection;
	console.log("Now, the fun part, getting Ant to run this: ");
	if(selection.length>1) {
		console.log("Only select one!!");
	} else {
		console.log("RUN: " + selection.map((e) => e.name));
	}
});

class AntItem {
	constructor(name, type) {
		this.name = name;
		this.type = type;
		this.children = [];
		this.parent = null;
	}

	addChild(element) {
		element.parent = this;
		this.children.push(element);
	}
}

/**
 * Creates the Sidebar tree
 */
class AntDataProvider {
	constructor(projectName, items) {
		let antItems = [];

		// Have a holder for the build name
		let holder = new AntItem(projectName,"ant");
		antItems.push(holder);

		// Add to the holder each build
		// Ideally, additional tags would be handled, but parsing the XML isn't fun.
		items.forEach((a) => {
			if(a.name!==undefined) {
				let element;
				if(a.description) {
					element = new AntItem(a.name,"target-with-desc");
				} else {
					element = new AntItem(a.name,"target");
				}
				holder.addChild(element);

				if(a.available) {
					a.available.forEach((av) => {
						if(av.file) {
							element.addChild(new AntItem("file="+av.file,"file"));
						}
					})
				}
				/** @TODO Current XML to JSON makes a mess, this doesn't match up with other Ant UIs
				/* Other elements should be added and nested as such!
				if(a.fail) {
					a.fail.forEach((f) => {

					})
				}
				*/
			}
		});

		this.rootItems = antItems;
	}

	getChildren(element) {
		if(!element) {
			return this.rootItems;
		} else {
			return element.children;
		}
	}

	getParent(element) {
		// Requests the parent of an element, for use with the reveal() method
		return element.parent;
	}

	getTreeItem(element) {
		// Converts an element into its display (TreeItem) representation
		let item = new TreeItem(element.name);

		//console.log("element type: " + element.type);
		if (element.children.length > 0) {
			item.collapsibleState = TreeItemCollapsibleState.Collapsed;
			item.contextValue = element.name;
		} else {
			item.command = "antsidebar.doubleClick";
			item.contextValue = "info";
		}

		// Determine type of icon
		if(element.type=="target") {
			item.image = "target";
		} else if(element.type=="target-with-desc") {
			item.image = "target-light";
		} else if(element.type=="ant") {
			item.image = "ant";
		} else {
			item.image = "__filetype.blank";
		}

		return item;
	}
}
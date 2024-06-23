const xmlToJson = require('./not-so-simple-simple-xml-to-json.js');
const { showNotification, consoleLogObject } = require("./nova-utils.js");

var treeView = null;

// Should be configurable? But Build should always be at the root of the project, right?
var buildXmlPath = nova.workspace.path;
var buildXmlFileName = "build.xml";
var previousBuildXmlData = "";

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

	// Watch the build file. If it changes, then reload it.
	nova.fs.watch(nova.path.join(buildXmlPath, buildXmlFileName), () => {
		console.log("File changed.. reload!");
		exports.loadAndParseBuildXML(buildXmlFileName);
	});
}

exports.loadAndParseBuildXML = function(filename) {
	// If there's a build.xml, parse it
	var buildXmlString = getStringOfWorkspaceFile("build.xml",false);

	// If not a valid or empty XML, clear the window
	if(buildXmlString==null || buildXmlString=="") {
		showNotification("Unable to use empty build.xml");
		treeView = new TreeView("antsidebar", {
			dataProvider: null
		});
		return;
	}

	// Parse the XML to JSON.
	var buildJson = new xmlToJson.ns3x2j(buildXmlString);

	// Check if the data really changed, if not just leave our tree alone!
	if(buildJson.xmlString==previousBuildXmlData) {
		return;
	}

	// Now, store this so we don't have to rebuild if the same content!
	previousBuildXmlData = buildJson.xmlString;

	// Create the TreeView
	treeView = new TreeView("antsidebar", { dataProvider: new AntDataProvider(buildJson) });

	// TreeView implements the Disposable interface
	nova.subscriptions.add(treeView);
}

exports.deactivate = function() {
	// Clean up state before the extension is deactivated
}

exports.openBuildAndGoTo = function(type, name) {
	nova.workspace.openFile(nova.path.join(buildXmlPath, buildXmlFileName)).then((textDocument) => {
		var editor = nova.workspace.activeTextEditor;

		if (editor) {
			var selection = treeView.selection;
			var selectedName = selection.map((e) => e.name)[0];
			var selectedNodeName = selection.map((e) => e.nodeName)[0];
			var selectedLine = selection.map((e) => e.line)[0];
			var selectedColumn = selection.map((e) => e.column)[0];

			if(selectedLine!=0) {
				editor.moveToTop();
				editor.moveDown(selectedLine-1);
				editor.moveRight(selectedColumn);
				editor.selectRight(selectedNodeName.length);
			}
		}
	});
}

nova.commands.register("antsidebar.view", () => {
	var selection = treeView.selection;
	var type = selection.map((e) => e.type)[0];
	var selectedName = selection.map((e) => e.name)[0];
	exports.openBuildAndGoTo();
});

nova.commands.register("antsidebar.run", () => {
	var selection = treeView.selection;
	let buildTarget = selection.map((e) => e.name)[0];
	//console.log("RUN: " + buildTarget);
	exports.runTarget(buildTarget);
});

exports.runTarget = function(targetName) {
	var noticePromise;
	var notice = new NotificationRequest("ant-build-start");
	notice.title = "Ant Build Started";
	notice.boty = "Starting to launch build target " + targetName;
	notice.actions = [ "Okay" ];
	noticePromise = nova.notifications.add(notice);

	// @TODO Should use preferences to Ant executable
	var path = nova.path.join(nova.path.join(nova.extension.path, "apache-ant-1.10.14"),"bin") + "/ant";
	var args = new Array;

	args.push(path);
	args.push(targetName);

	var options = {
		args: args,
		cwd: buildXmlPath
	};

	var process = new Process("/usr/bin/env",options)
	var stdOut = [];
	var stdErr = [];
	if(nova.inDevMode()) {
		console.log("Options: ");
		consoleLogObject(options);
	}

	/** @TODO Maybe change to a Task like process that will give a transcription */
	process.onStdout(function(line) {
		stdOut.push(line.trim());
		console.log(line.trim());
	});
	process.onStderr(function(line) { stdErr.push(line.trim()); });
	process.onDidExit(function() {
		nova.notifications.cancel("ant-build-start");

		notice = new NotificationRequest("ant-build-results");
		if(stdErr.length>0) {
			notice.title = "Ant Build Error";
			notice.body = stdErr.join("\n");
			notice.actions = [ "Oh no!"];
		} else {
			notice.title = "Ant Build Success";
			// Just output the last two lines. Should say successful and the time it took
			notice.body = stdOut.slice(-2,stdOut.length).join("\n");
			notice.actions = [ "Great!"];
		}
		noticePromise = nova.notifications.add(notice);
	});

	process.start();
	if(nova.inDevMode()) {
		//console.log("Ant runTarget done");
	}
}

class AntItem {
	constructor(name, type, nodeName, line = 0, column = 0) {
		this.name = name;
		this.type = type;
		this.nodeName = nodeName;
		this.line = line;
		this.column = column;
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
	constructor(buildJson) {
		let projectName = buildJson.getNodeAttributesByName("project")[0]["name"];
		let items = buildJson.findNodesByName("target");
		let position = buildJson.getNodePositionsByName("project")[0];

		// Items that are part of the Ant Build
		let antItems = [];

		// Have a holder for the build name
		let holder = new AntItem(projectName,"ant","project",position.line,position.column);
		antItems.push(holder);

		// Add to the holder each build
		items.forEach((a) => {
			if(a["@"].name!==undefined) {
				let element;
				if(a["@"].description) {
					element = new AntItem(a["@"].name,"target-with-desc","target",a.line,a.column);
				} else {
					element = new AntItem(a["@"].name,"target","target",a.line,a.column);
				}
				holder.children.push(element);

				let goThroughChildren = (parent, items) => {
					let childElement, childName, childType;
					if(items.children) {
						items.children.forEach((c) => {
							switch(c.name) {
								case "available": {
									if(parent.type=="target") {
										childName = "file="+c["@"].file
										childType = "available";
									} else {
										childName = c.name;
										childType = "tag";
									}
									break;
								}
								case "pathconvert": {
									childName = c.name;
									childType = c.name;
									break;
								}
								case "fileset": {
									if(c["@"].id!==undefined) {
										childName = c["@"].id
									} else {
										childName = c.name;
									}
									childType = c.name;
									break;
								}
								case "mkdir":
								case "delete": {
									childName = c.name+" "+c["@"].dir;
									childType = c.name;
									break;
								}
								case "jar": {
									childName = c.name+" "+c["@"].destfile;
									childType = c.name;
									break;
								}
								case "unzip": {
									childName = c.name+" "+c["@"].src;
									childType = c.name;
									break;
								}
								default: {
									childName = c.name;
									childType = c.name;
									break;
								}
							}

							if(childName!="") {
								childElement = new AntItem(childName, childType, c.name, c.line, c.column);
								parent.addChild(childElement);
							}

							if(c.children) {
								goThroughChildren(childElement,c);
							}
						});
					}
				}

				if(a.children && a.children.length>0) {
					goThroughChildren(element, a);
				}
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

		// Figure out if it should have a collapsible state of open/closed otherwise none
		if(element.type=="ant") { // Always show the element.type of "ant" as expended.
			item.collapsibleState = TreeItemCollapsibleState.Expanded;
		} else if (element.children.length > 0) { // Otherwise, if there are no children, don't show the expander
			item.collapsibleState = TreeItemCollapsibleState.Collapsed;
		}
		item.contextValue = element.type;

		// Determine type of icon
		switch(element.type) {
			case "target":
				item.image = "target";
			break;
			case "target-with-desc":
				item.image = "target-light";
			break;
			case "ant":
				item.image = "ant";
			break;
			case "available":
				item.image = "__filetype.blank";
			break;
			case "pathconvert":
				item.image = "__symbol.tag-image";
			break;
			case "flleset":
				item.image = "__symbol.block";
			break;
			default:
				item.image = "__symbol.tag";
			break;
		}

		return item;
	}
}
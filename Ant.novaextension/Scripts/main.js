const xmlToJson = require('./not-so-simple-simple-xml-to-json.js');
const { showNotification, consoleLogObject, isWorkspace, getWorkspaceOrGlobalConfig } = require("./nova-utils.js");

var treeView = null;
var previousBuildXmlData = "";

const DEFAULT_ANT_EXE = nova.path.join(nova.path.join(nova.extension.path, "apache-ant-1.10.14"),"bin") + "/ant";
const DEFAULT_PATH = nova.workspace.path;
const DEFAULT_BUILD_FILE = "build.xml;"
const DEFAULT_BUILD_AND_PATH = nova.path.join(DEFAULT_PATH, DEFAULT_BUILD_FILE);

var antBuildXmlFileAndPath = DEFAULT_BUILD_AND_PATH;

/**
 * Opens a file and dumps it into a string.
 * @param {string} filename - The name of the file to open, relative to the workspace
 * @param {boolean} trimAll - Default: true. Trims each line, and removes extra spacing
 * @returns {String|null} - The contents of the text file or null if not able to open
 */
function getStringOfWorkspaceFile(filename, trimAll = true) {
	var line, contents;
	try {
		contents = "";
		//console.log("Trying to open: " + nova.path.join(nova.workspace.path, filename));
		var file = nova.fs.open(filename);
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
		console.log("*** ERROR: Could not open file " + filename + " for reading. ***");
		return null;
	}
	return contents;
}

/**
 * When the extension is activated, we want to load the build.xml and then set up a watch on that file so if it changes
 * we then update the view
 */
exports.activate = function() {
	exports.doSidebar();
}

/**
 * Function that does all the work for the sidebar.
 */
exports.doSidebar = function() {
	exports.figureBuildFile();
	exports.loadAndParseBuildXML();

	// Setup a watch if the file gets saved to re-parse the file
	nova.fs.watch(antBuildXmlFileAndPath, () => { exports.doSidebar(); });
	// If the extension's build file changes, then we need to change stuff.
	nova.config.onDidChange("ant.build.file", () => { exports.doSidebar(); });
	// If the workspace's build file changes, then we need to change stuff too!!
	nova.workspace.config.onDidChange("ant.build.file", () => { exports.doSidebar(); });
}

/**
 * Checks to get the name of the build file to use
 */
exports.figureBuildFile = function () {
	var antBuildXmlFileName = getWorkspaceOrGlobalConfig("ant.build.file") ?? "build.xml";
	antBuildXmlFileAndPath = nova.path.join(nova.workspace.path, antBuildXmlFileName);
}

/**
 * Loads and parses the build.xml file and creates the treeview as needed.
 *
 * @param {string} filename - The name of the workspace file to get
 */
exports.loadAndParseBuildXML = function(filename) {
	// If there's a build.xml, parse it
	var buildXmlString = getStringOfWorkspaceFile(antBuildXmlFileAndPath,false);

	// If not a valid or empty XML, clear the window
	if(buildXmlString==null || buildXmlString=="") {
		if(buildXmlString==null) {
			showNotification("Error loading Build file","Cannot open file at " + antBuildXmlFileAndPath + " for reading");
		} else if(buildXmlString=="") {
			showNotification("Unable to use empty build.xml");
		}
		treeView = new TreeView("antsidebar", {
			dataProvider: null
		});
		return;
	}

	// Parse the XML to JSON.
	var buildJson = new xmlToJson.ns3x2j(buildXmlString,true);

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

/**
 * When the extension deactivates, clean up things.
 */
exports.deactivate = function() {
	treeView = null;
	previousBuildXmlData = "";
}

/**
 * Used to open the build.xml. If something is selected in the treeview, then we will jump to that specific location
 */
exports.openBuildAndGoTo = function() {
	nova.workspace.openFile(antBuildXmlFileAndPath).then((textDocument) => {
		var editor = nova.workspace.activeTextEditor;

		if (editor) {
			var selection = treeView.selection;
			if(selection) {
				var selectedLine = selection.map((e) => e.line)[0];

				// If we have a selectedLine, then figure the name of the node and what to highlight!
				if(selectedLine!=0) {
					var selectedNodeName = selection.map((e) => e.nodeName)[0];
					var selectedColumn = selection.map((e) => e.column)[0];

					editor.moveToTop();
					editor.moveDown(selectedLine-1);
					editor.moveRight(selectedColumn);
					editor.selectRight(selectedNodeName.length);
				}
			}
		}
	});
}

/**
 * Register a command so we can go to an element in the build.xml
 */
nova.commands.register("antsidebar.view", () => {
	var selection = treeView.selection;
	var type = selection.map((e) => e.type)[0];
	var selectedName = selection.map((e) => e.name)[0];
	exports.openBuildAndGoTo();
});

/**
 * Register a command so we can run one of the targets in the build.xml
 */
nova.commands.register("antsidebar.run", () => {
	var selection = treeView.selection;
	let buildTarget = selection.map((e) => e.name)[0];
	//console.log("RUN: " + buildTarget);
	exports.runTarget(buildTarget);
});

/**
 * Used to actually call Ant to run a build target
 * @param {string} targetName - The name of the target node to run!
 */
exports.runTarget = function(targetName) {
	var noticePromise;

	// Show a notification that the build is starting
	var notice = new NotificationRequest("ant-build-start");
	notice.title = "Ant Build Started";
	notice.boty = "Starting to launch build target " + targetName;
	notice.actions = [ "Okay" ];
	noticePromise = nova.notifications.add(notice);

	// Get the configuration for the Ant path, or use the default included Ant binaries
	var antExe = getWorkspaceOrGlobalConfig("ant.ant.path") ?? DEFAULT_ANT_EXE;

	var args = new Array;
	args.push(antExe);

	var antBuildXmlFileName = getWorkspaceOrGlobalConfig("ant.build.file") ?? DEFAULT_BUILD_FILE;

	// Need to add an argument if the build file is named somethign other than build.xml
	if(antBuildXmlFileName!="build.xml") {
		args.push("-buildfile");
		args.push(antBuildXmlFileName);
	}

	args.push(targetName);

	var options = {
		args: args,
		cwd: DEFAULT_PATH
	};

	var process = new Process("/usr/bin/env",options)
	var stdOut = [];
	var stdErr = [];

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
}

/**
 * A Class for the items that get displayed in the treeview for the Ant view.
 * In addition to the normal elements like `children` and `parent`, we need to track a bunch of stuff,
 * like the line and column so we can jump to it, also which `type` of icon to show
 */
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
 * Used to create the Ant Sidebar tree
 */
class AntDataProvider {
	/**
	 * Used to generate the treeview of the Ant Sidebar
	 *
	 * @param {Object} buildJson - A JSON Obect of the build.xml
	 */
	constructor(buildJson) {
		// Figure out the name of the project to show!
		let projectName = buildJson.getNodeAttributesByName("project")[0]["name"];
		// Get's all the build.xml's <target/>!
		let targets = buildJson.findNodesByName("target");
		// Get the position of the project node (used for jumping to an editor view)
		let position = buildJson.getNodePositionsByName("project")[0];

		// Items that are part of the Ant Build
		let antItems = [];

		// Start with a holder for the name and title of the build.xml
		let holder = new AntItem(projectName,"ant","project",position.line,position.column);
		antItems.push(holder);

		// Add to the holder each target node.
		targets.forEach((a) => {
			// If the target has a name, we can proceed with getting elements.
			if(a["@"].name!==undefined) {
				// Let's create a new element to add to the treeview!
				let element;

				// Check if it's a target with a description since it get's a different icon in the treeview
				if(a["@"].description) {
					element = new AntItem(a["@"].name,"target-with-desc","target",a.line,a.column);
				} else {
					element = new AntItem(a["@"].name,"target","target",a.line,a.column);
				}

				// Now we can add this element to the holder
				holder.children.push(element);

				// If the target has children, then we need to go through them and add them as AntItems too!
				if(a.children && a.children.length>0) {
					this.goThroughChildren(element, a);
				}
			}
		});

		// Set the root to the array of AntItems we created!
		this.rootItems = antItems;
	}

	/**
	 * Function to go through the children elements and tie them back to the parent!
	 *
	 * @param {AntItem} parent - The AntItem that may have children
	 * @param {Object} items - The JSON data for the node that is being parsed
	 */
	goThroughChildren(parent, items) {
		let childElement, childName, childType;
		// If there are children to go through, then you best be doing it!!
		if(items.children) {
			// Go through each child and figure out what kind of AntItem it should be!
			items.children.forEach((c) => {
				// Based upon the name of the child,
				switch(c.name) {
					case "available": {
						if(parent.type=="target" && c["@"].file!==undefined) {
							childName = "file="+c["@"].file;
							childType = "available";
						} else {
							childName = c.name;
							childType = "tag";
						}
						break;
					}
					case "property": {
						if(parent.type=="target" && c["@"].name!==undefined) {
							childName = c["@"].name;
							childType = "property";
						} else {
							childName = c.name;
							childType = "property";
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

				// If the child name is empty, then do not add an AntItem to the list
				if(childName!="") {
					childElement = new AntItem(childName, childType, c.name, c.line, c.column);
					parent.addChild(childElement);
				}

				// If this child has children, then we need to go through them too!
				if(c.children) {
					this.goThroughChildren(childElement,c);
				}
			});
		}
	}

	/**
	 * Finds the children of the element selected
	 *
	 * @param {AntItem} element - The children of the item
	 */
	getChildren(element) {
		if(!element) {
			return this.rootItems;
		} else {
			return element.children;
		}
	}

	/**
	 * Requests the parent of an element, for use with the reveal() method
	 * @param {AntItem} element - The parent of the selected item
	 */
	getParent(element) { return element.parent; }

	/**
	 * Nova uses this to help render the treeview (I think). We need to set if is should be collapsible or not.
	 * As well as the type of `image` to use for icons.
	 *
	 * @param {AntItem} element - The item that should be rendered, and what data can be processed from it
	 */
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
				item.image = "target-desc";
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
			case "macrodef":
				item.image = "__filetype.java";
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
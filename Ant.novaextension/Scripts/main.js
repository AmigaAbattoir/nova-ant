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
	treeView = new TreeView("antsidebar", {
		dataProvider: new AntDataProvider(buildJson.getNodeAttributesByName("project")[0]["name"],buildJson.findNodesByName("target"))
	});
/*
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
*/
	// TreeView implements the Disposable interface
	nova.subscriptions.add(treeView);
}

exports.deactivate = function() {
	// Clean up state before the extension is deactivated
}

exports.openBuildAndGoTo = function(type, name) {
	//console.log(nova.path.join(buildXmlPath, buildXmlFileName));
	nova.workspace.openFile(nova.path.join(buildXmlPath, buildXmlFileName)).then((textDocument) => {
		var editor = nova.workspace.activeTextEditor;

		if (editor) {
			var selection = treeView.selection;
			var type = selection.map((e) => e.type)[0];
			var selectedName = selection.map((e) => e.name)[0];

			/** @TODO Use regex. You can do that in Nova, right? It doesn't seems to work. */
			var check1, check2;
			if(type=="target" || type=="target-with-desc") {
				check1 = "name=\"" + selectedName + "\"";
				check2 = "name='" + selectedName + "'";
			} else if(type=="file") {
				var fileName = selectedName.split("=")[1];
				//console.log("Fileanme [[" + fileName + "]]");
				check1 = "file=\"" + fileName + "\"";
				check2 = "file='" + fileName + "'";
			} else {
				console.log("Not able to go to that line yet");
				return;
			}

			// Get all of the document
			var allText = editor.getTextInRange(new Range(0, editor.document.length));
			// Split on line break
			var lines = allText.split(/\r?\n/);

			var count = 0;
			while(count<lines.length) {
				//console.log("LINE " + count + ": [[[" + lines[count] + "]]]");
				//console.log(check1 + " indexOf() " + lines[count].indexOf(check1))
				//console.log(check2 + " indexOf() " + lines[count].indexOf(check2))
				if(lines[count].indexOf(check1)!=-1 || lines[count].indexOf(check2)!=-1) {
					//console.log("Found at line " + count);
					editor.moveToTop();
					editor.moveDown(count);
					count = lines.lenght;
				}
				count++;
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

nova.commands.register("antsidebar.doubleClick", () => {
	// Invoked when an item is double-clicked
	var selection = treeView.selection;
	var type = selection.map((e) => e.type)[0];
	var selectedName = selection.map((e) => e.name)[0];
	//console.log("DoubleClick: " + selectedName);
	if(type=="file") {
		exports.openBuildAndGoTo(type, selectedName);
	}
});

nova.commands.register("antsidebar.run", () => {
	// Invoked when an item is double-clicked
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
	constructorButSingle(projectName, items) {
		let antItems = [];

		// Have a holder for the build name
		let holder = new AntItem(projectName,"ant");
		antItems.push(holder);

		// Add to the holder each build
		items.forEach((a) => {
			if(a["@"].name!==undefined) {
				let element;
				if(a["@"].description) {
					element = new AntItem(a["@"].name,"target-with-desc");
				} else {
					element = new AntItem(a["@"].name,"target");
				}
				holder.addChild(element);

				// Should we go through each child... but need to go through their children too!
				a.children.forEach((c) => {
					switch(c.name) {
						case "available": {
							element.addChild(new AntItem("file="+c["@"].file,"available"));
							break;
						}
						case "mkdir":
						case "delete": {
							element.addChild(new AntItem(c.name+" "+c["@"].dir,c.name));
							break;
						}
						case "jar": {
							element.addChild(new AntItem(c.name+" "+c["@"].destfile,c.name));
							break;
						}
						case "unzip": {
							element.addChild(new AntItem(c.name+" "+c["@"].src,c.name));
							break;
						}
						default: {
							element.addChild(new AntItem(c.name,c.name));
							break;
						}
					}
				});
			}
		});

		this.rootItems = antItems;
	}

	constructor(projectName, items) {
		let antItems = [];

		// Have a holder for the build name
		let holder = new AntItem(projectName,"ant");
		antItems.push(holder);

		// Add to the holder each build
		items.forEach((a) => {
			if(a["@"].name!==undefined) {
				let element;
				if(a["@"].description) {
					element = new AntItem(a["@"].name,"target-with-desc");
				} else {
					element = new AntItem(a["@"].name,"target");
				}
				holder.children.push(element);

				let goThroughChildren = (parent, items) => {
					let childElement;

					if(items.children) {
						// Should we go through each child... but need to go through their children too!
						items.children.forEach((c) => {
							switch(c.name) {
								case "available": {
									if(parent.type=="target") {
										childElement = new AntItem("file="+c["@"].file,"available");
									} else {

									}
									break;
								}
								case "pathconvert": {
									childElement = new AntItem(c.name,"pathconvert");
									break;
								}
								case "fileset": {
									if(c["@"].id!==undefined) {
										childElement = new AntItem(c["@"].id,"flleset");
									} else {
										childElement = new AntItem(c.name,"flleset");
									}
									break;
								}
								case "mkdir":
								case "delete": {
									childElement = new AntItem(c.name+" "+c["@"].dir,c.name);
									break;
								}
								case "jar": {
									childElement = new AntItem(c.name+" "+c["@"].destfile,c.name);
									break;
								}
								case "unzip": {
									childElement = new AntItem(c.name+" "+c["@"].src,c.name);
									break;
								}
									childElement = new AntItem(c.name,c.name);
								default: {
									childElement = new AntItem(c.name,c.name);
									break;
								}
							}
							if(childElement) {
								parent.addChild(childElement);
							}

							if(c.children) {
								goThroughChildren(childElement,c);
							}
						});
					}
				}

				goThroughChildren(element, a);
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

		if(element.type=="ant") { // Always show the element.type of "ant" as expended.
			item.collapsibleState = TreeItemCollapsibleState.Expanded;
			item.contextValue = element.name;
		} else if (element.children.length > 0) { // Otherwise, if there are no children, don't show the expander
			item.collapsibleState = TreeItemCollapsibleState.Collapsed;
			item.contextValue = element.name;
		} else { // Anything that doesn't have children, should send a double click for
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
		} else if(element.type=="available") {
			item.image = "__filetype.blank";
		} else if(element.type=="pathconvert") {
			item.image = "__symbol.tag-image";
		} else if(element.type=="flleset") {
			//item.image = "__symbol.package";
			item.image = "__symbol.block";
		} else {
			item.image = "__symbol.tag-media";
		}

		return item;
	}
}
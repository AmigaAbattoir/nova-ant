/**
 * not-so-simple-simple-xml-to-json.js
 *
 * Not so simple, simple XML to JSON (ns3x2j for short)
 *
 * Used for Nova to parse XML to a JSON array. It keeps the structure of the XML, and keeps attributes
 * and content separate
 *
 * @author ChatGPT and Christopher Pollati
 */
exports.ns3x2j = class NotSoSimpleSimpleXMLtoJSON {

	/**
	 * Takes a string of text as XML, and converts it into a JSON object
	 *
	 * @param {String} xmlString - The XML content that should be parsed
	 */
	constructor(xmlString, trackPosition = false) {
		this.xmlString = xmlString;
		this.trackPosition = trackPosition;
		this.currentIndex = 0;
		this.lineNumber = 1;   // Track the current line number
		this.columnNumber = 0; // Track the current column number
		this.jsonArray = [];
		const rootNode = this.parseNode();
		if (rootNode) {
			this.jsonArray.push(rootNode);
		}
	}

	generateNode(nodeName, attributes, children, textContent, line, column) {
		return {
			name: nodeName,
			"@": attributes,
			children: children,
			textContent: textContent,
			...(this.trackPosition && {
				line: line,
				column: column
			})
		};
	}

	/**
	 * Handles taking the XML node and converting it into JSON
	 */
	parseNode() {
		this.skipWhitespace();
		if (this.currentIndex >= this.xmlString.length) {
			return null;
		}

		if (this.xmlString[this.currentIndex] !== '<') {
			this.showErrorContext("Expected '<' at position " + this.getLineColumn());
		}

		this.moveCurrentIndex(1); // Skip '<'

 	   // Handle XML declaration <?xml ... ?>
		if (this.xmlString.substr(this.currentIndex, 4) === '?xml') {
			this.skipDeclaration();
			return this.parseNode(); // Recursively call parseNode after skipping the declaration
		}

		if (this.xmlString[this.currentIndex] === '!') {
			this.skipComment();
			return this.parseNode(); // Recursively call parseNode after skipping the comment
		}

		let lineStart = this.lineNumber;
		let colStart = this.columnNumber;

		const nodeName = this.parseNodeName();
		const attributes = this.parseAttributes();

		this.skipWhitespace();

		let children = [];
		let textContent = null;

		if (this.xmlString[this.currentIndex] === '>') {
			this.moveCurrentIndex(1); // Skip '>'
			children = this.parseChildren(nodeName);

			// If there is only 1 child, and it is labled #text, then it really should be the
			// text content of this node!
			if(children.length==1) {
				if(children[0].name=="#text") {
					textContent = children[0].textContent;
					children = [];
				}
			}
		} else if (this.xmlString[this.currentIndex] === '/' && this.xmlString[this.currentIndex + 1] === '>') {
			this.moveCurrentIndex(2); // Skip '/>'
			return this.generateNode(nodeName, attributes, [], null, lineStart, colStart);
		} else {
			this.showErrorContext("Unexpected character at position " + this.getLineColumn());
		}

		return this.generateNode(nodeName, attributes, children, textContent, lineStart, colStart);
	}

	/**
	 * Helps to skip an XML declaration
	 */
	skipDeclaration() {
		if (this.xmlString.substr(this.currentIndex, 4) !== '?xml') {
			this.showErrorContext("Expected '?xml' for declaration at position " + this.getLineColumn());
		}
		this.moveCurrentIndex(4); // Skip '?xml'

		while (this.currentIndex < this.xmlString.length - 2) {
			if (this.xmlString.substr(this.currentIndex, 2) === '?>') {
				this.moveCurrentIndex(2); // Skip '?>'
				break;
			} else {
				this.nextCharCountingLine();
			}
		}

		if (this.currentIndex >= this.xmlString.length) {
			this.showErrorContext("Unterminated XML declaration starting at position " + this.getLineColumn());
		}
	}

	/**
	 * Used to skip comments, should handled nested comments too!
	 */
	skipComment() {
		if (this.xmlString.substr(this.currentIndex, 3) !== "!--") {
			this.showErrorContext("Expected '!--' for comment at position " + this.getLineColumn());
		}
		this.moveCurrentIndex(3); // Skip '!--'

		let depth = 1;
		while (depth > 0 && this.currentIndex < this.xmlString.length - 3) {
			if (this.xmlString.substr(this.currentIndex, 3) === "-->") {
				depth--;
				this.moveCurrentIndex(3); // Skip '-->'
			} else if (this.xmlString.substr(this.currentIndex, 4) === "<!--") {
				depth++;
				this.moveCurrentIndex(4); // Skip '<!--'
			} else {
				this.nextCharCountingLine();
			}
		}

		if (depth !== 0) {
			this.showErrorContext("Unterminated comment starting at position " + this.getLineColumn());
		}
	}

	/**
	 * Used to move where were are in the XML string, accounting that the `currentIndex` and `columnNumber` need to be adjusted
	 *
	 * @param {Number} value - How many spaces
	 */
	moveCurrentIndex(value) {
		this.currentIndex += value;
		this.columnNumber += value;
	}

	/**
	 * Move our counters to the next line, so the line gets increased and the column number is reset
	 */
	moveToNextLine() {
		this.lineNumber++;
		this.columnNumber = 0; // Reset column number at the start of each new line
	}

	/**
	 * Gets the current `lineNumber` and `columnNumber`
	 */
	getLineColumn() {
		return `line: ${this.lineNumber}, col: ${this.columnNumber}`;
	}

	/**
	 * Move to the next character, checking to see if there is a newline, and adjust accordingly!
	 */
	nextCharCountingLine() {
		if (this.xmlString[this.currentIndex] === '\n') {
			this.moveToNextLine();
		} else {
			this.columnNumber++;
		}
		this.currentIndex++;
	}

	/**
	 * Checks for the nodes name, otherwise throws an error.
	 */
	parseNodeName() {
		const start = this.currentIndex;
		while (this.currentIndex < this.xmlString.length && /[a-zA-Z0-9_:.-]/.test(this.xmlString[this.currentIndex])) {
			this.nextCharCountingLine();
		}
		if (start === this.currentIndex) {
			this.showErrorContext("Expected node name at position " + this.getLineColumn());
		}
		return this.xmlString.substring(start, this.currentIndex);
	}

	/**
	 * Checks for the attributes in a node.
	 */
	parseAttributes() {
		const attributes = {};
		while (this.currentIndex < this.xmlString.length) {
			this.skipWhitespace();
			if (this.xmlString[this.currentIndex] === '>' || (this.xmlString[this.currentIndex] === '/' && this.xmlString[this.currentIndex + 1] === '>')) {
				break;
			}
			const name = this.parseNodeName();
			this.skipWhitespace();
			if (this.xmlString[this.currentIndex] !== '=') {
				this.showErrorContext("Expected '=' after attribute name at position " + this.getLineColumn());
			}
			this.moveCurrentIndex(1); // Skip '='
			this.skipWhitespace();
			const value = this.parseAttributeValue();
			attributes[name] = value;
		}
		return attributes;
	}

	/**
	 * Handles parsing the values of the attribute.
	 */
	parseAttributeValue() {
		const quote = this.xmlString[this.currentIndex];
		if (quote !== '"' && quote !== "'") {
			this.showErrorContext("Expected '\"' or \"'\" for attribute value at position " + this.getLineColumn());
		}
		this.moveCurrentIndex(1); // Skip opening quote
		const start = this.currentIndex;
		while (this.currentIndex < this.xmlString.length && this.xmlString[this.currentIndex] !== quote) {
			this.nextCharCountingLine();
		}
		if (this.currentIndex >= this.xmlString.length) {
			this.showErrorContext("Unterminated attribute value starting at position " + start);
		}
		const value = this.xmlString.substring(start, this.currentIndex);
		this.moveCurrentIndex(1); // Skip closing quote
		return value;
	}

	/**
	 * Handles going through the children of a node
	 *
	 * @param {String} parentNodeName - The parent's node name so we know when to stop parsing the node
	 */
	parseChildren(parentNodeName) {
		const children = [];
		let textContent = '';

		while (this.currentIndex < this.xmlString.length) {
			this.skipWhitespace();
			if (this.xmlString[this.currentIndex] === '<') {
				var lineStart = this.lineNumber;
				if (this.xmlString[this.currentIndex + 1] === '/') {
					this.moveCurrentIndex(2); // Skip '</'
					const endTagName = this.parseNodeName();
					if (endTagName !== parentNodeName) {
						this.showErrorContext(`Expected closing tag </${parentNodeName}> but found </${endTagName}> at position ` + this.getLineColumn());
					}
					this.skipWhitespace();
					if (this.xmlString[this.currentIndex] !== '>') {
						this.showErrorContext("Expected '>' at position " + this.getLineColumn());
					}
					this.currentIndex++; // Skip '>'
					if (textContent.trim().length > 0) {
						// Don't trim text content!
						children.push(
							this.generateNode("#text", {}, [], textContent, lineStart, this.columnNumber)
						);
					}
					break;
				} else if (this.xmlString.substr(this.currentIndex, 4) === "<!--") {
					// Move the currentIndex over one
					this.moveCurrentIndex(1);
					this.skipComment(); // Skip comment
				} else {
					const childNode = this.parseNode();
					children.push(childNode);
				}
			} else {
				textContent += this.xmlString[this.currentIndex];
				this.nextCharCountingLine();
			}
		}

		return children;
	}

	/**
	 * Handles skipping white space (and making sure we know what line/column we are at!)
	 */
	skipWhitespace() {
		while (this.currentIndex < this.xmlString.length && /\s/.test(this.xmlString[this.currentIndex])) {
			this.nextCharCountingLine();
		}
	}

	/**
	 * Helps to display an error, that may be helpful for reading. Tries to show the line where the error occurs,
	 * and adds double brackets at the offending spot.
	 *
	 * @param {String} message - The error message
	 */
	showErrorContext(message) {
		const start = Math.max(0, this.currentIndex - 20);
		const end = Math.min(this.xmlString.length, this.currentIndex + 20);
		const before = this.xmlString.substring(start, this.currentIndex).replace(/\n/g, ' ');
		const after = this.xmlString.substring(this.currentIndex+1, end).replace(/\n/g, ' ');
		const pointer = '[[' + this.xmlString[this.currentIndex] + ']]';

		console.error(`Error: ${message}`);
		console.error(`${before}${pointer}${after}`);

		/** @NOTE This cause Nova to stop parsing, which is usually fine in the case of debugging an extension */
		throw new Error(message);
	}

	/* ---- Helpers ---- */

	/**
	 * Helper to find a particular node by it's name
	 * @param {String} nodeName - The name of the node you are looking for
	 */
	findNodesByName(nodeName) {
		const result = [];
		this.searchNodes(this.jsonArray, nodeName, result);
		return result;
	}

	/**
	 * Returnsa all the attributes for a specific node.
	 *
	 * @param {String} nodeName - The node to get attributes of
	 */
	getNodeAttributesByName(nodeName) {
		const nodes = this.findNodesByName(nodeName);
		if (nodes.length > 0) {
			return nodes.map(node => node['@']);
		}
		return [];
	}

	/**
	 * Just return the line and column for a particular node by name
	 *
	 * @param {String} nodeName - The name of the node to find
	 */
	 getNodePositionsByName(nodeName) {
		const nodes = this.findNodesByName(nodeName);
		if (nodes.length > 0) {
			return nodes.map(node => ({
				line: node.line,
				column: node.column
			}));
		}
		return [];
	}

	/**
	 * Get a particular children of a particular node
	 *
	 * @param {String} nodeName - The name of the node to find
	 * @param {String} childName - The name of the children to find
	 */
	getNodeChildrenByName(nodeName, childName) {
		const nodes = this.findNodesByName(nodeName);
		if (nodes.length === 1) {
			const children = nodes[0].children.filter(child => child.name === childName);
			return children.length === 1 ? children[0] : children;
		} else if (nodes.length > 0) {
			return nodes.map(node => node.children.filter(child => child.name === childName));
		}
		return null;
	}

	getCurrentNodeChildrenByName(node, childName) {
		const children = node.children.filter(child => child.name === childName);
		return children.length === 1 ? children[0] : children;
	}

	/**
	 * Searches the JSON for particular nodes
	 *
	 * @param {JSON} nodes - The JSON array of nodes to search through
	 * @param {String} nodeName - The name of the nodes you are looking for
	 * @param {Object} result - Where to store the results of the search.
	 */
	searchNodes(nodes, nodeName, result) {
		for (let node of nodes) {
			if (node.name === nodeName) {
				result.push(node);
			}
			if (node.children) {
				this.searchNodes(node.children, nodeName, result);
			}
		}
	}

	/**
	 * Method to get the JSON array
	 */
	getJSONArray() { return this.jsonArray; }
};
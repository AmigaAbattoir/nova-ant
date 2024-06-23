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
	constructor(xmlString, trackNodeText = false) {
		this.xmlString = xmlString;
		this.currentIndex = 0;
		this.lineNumber = 1;   // Track the current line number
		this.columnNumber = 0; // Track the current column number
		this.jsonArray = [];
		const rootNode = this.parseNode();
		if (rootNode) {
			this.jsonArray.push(rootNode);
		}
	}

	parseNode() {
		this.skipWhitespace();
		if (this.currentIndex >= this.xmlString.length) {
			return null;
		}

		if (this.xmlString[this.currentIndex] !== '<') {
			this.showErrorContext("Expected '<' at position " + this.getLineColumn());
		}

		this.moveCurrentIndex(1); // Skip '<'

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
			return {
				name: nodeName,
				"@": attributes,
				children: [],
				textContent: null,
				line: lineStart,
				column: colStart
			};
		} else {
			this.showErrorContext("Unexpected character at position " + this.getLineColumn());
		}

		return {
			name: nodeName,
			"@": attributes,
			children: children,
			textContent: textContent,
			line: lineStart,
			column: colStart
		};
	}

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

	moveCurrentIndex(value) {
		this.currentIndex += value;
		this.columnNumber += value;
	}

	nextCharCountingLine() {
		if (this.xmlString[this.currentIndex] === '\n') {
			this.moveToNextLine();
		} else {
			this.columnNumber++;
		}
		this.currentIndex++;
	}

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
						children.push({
							name: "#text",
							"@": {},
							children: [],
							textContent: textContent, // Don't trim text content!
							line: lineStart,
							column: this.columnNumber,
						});
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

	skipWhitespace() {
		while (this.currentIndex < this.xmlString.length && /\s/.test(this.xmlString[this.currentIndex])) {
			this.nextCharCountingLine();
		}
	}

	findNodesByName(nodeName) {
		const result = [];
		this.searchNodes(this.jsonArray, nodeName, result);
		return result;
	}

	getNodeAttributesByName(nodeName) {
		const nodes = this.findNodesByName(nodeName);
		if (nodes.length > 0) {
			return nodes.map(node => node['@']);
		}
		return [];
	}

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

	getJSONArray() {
		return this.jsonArray;
	}

	showErrorContext(message) {
		const start = Math.max(0, this.currentIndex - 20);
		const end = Math.min(this.xmlString.length, this.currentIndex + 20);
		const before = this.xmlString.substring(start, this.currentIndex).replace(/\n/g, ' ');
		const after = this.xmlString.substring(this.currentIndex+1, end).replace(/\n/g, ' ');
		const pointer = '[[' + this.xmlString[this.currentIndex] + ']]';

		console.error(`Error: ${message}`);
		console.error(`${before}${pointer}${after}`);
		throw new Error(message);
	}

	moveToNextLine() {
		this.lineNumber++;
		this.columnNumber = 0; // Reset column number at the start of each new line
	}

	getLineColumn() {
		return `line: ${this.lineNumber}, col: ${this.columnNumber}`;
	}
};
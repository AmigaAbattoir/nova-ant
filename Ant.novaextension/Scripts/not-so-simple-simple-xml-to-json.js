/**
 * not-so-simple-simple-xml-to-json.js
 *
 * Not so simple, simple XML to JSON (ns3x2j for short)
 *
 * Used for Nova to parse XML to an JSON array. It keeps the structure of the XML, and keeps attributes
 * and content separate
 *
 * @author ChatGPT and Christopher Pollati
 */
exports.ns3x2j = class NotSoSimpleSimpleXMLtoJSON {
	constructor(xmlString) {
		this.xmlString = this.preprocessXML(xmlString);
		this.currentIndex = 0;
		this.jsonArray = [];
		const rootNode = this.parseNode();
		if (rootNode) {
			this.jsonArray.push(rootNode);
		}
	}

	preprocessXML(xmlString) {
		xmlString = this.removeNestedComments(xmlString);
		// Remove whitespace between tags
		return xmlString.replace(/>\s+</g, '><').trim();
	}

	removeNestedComments(xmlString) {
		let result = '';
		let inComment = false;
		let commentLevel = 0;

		for (let i = 0; i < xmlString.length; i++) {
			if (xmlString.substr(i, 4) === '<!--') {
				inComment = true;
				commentLevel++;
				i += 3; // Skip the entire <!--
			} else if (xmlString.substr(i, 3) === '-->') {
				commentLevel--;
				i += 2; // Skip the entire -->
				if (commentLevel === 0) {
					inComment = false;
				}
			} else if (!inComment) {
				result += xmlString[i];
			}
		}

		if (commentLevel !== 0) {
			throw new Error("Unclosed comment in the XML string");
		}

		return result;
	}

	parseNode() {
		this.skipWhitespace();
		if (this.currentIndex >= this.xmlString.length) {
			return null;
		}

		if (this.xmlString[this.currentIndex] !== '<') {
			throw new Error("Expected '<' at position " + this.currentIndex);
		}

		this.currentIndex++; // Skip '<'

		if (this.xmlString[this.currentIndex] === '!') {
			throw new Error("Unsupported markup at position " + this.currentIndex);
		}

		const nodeName = this.parseNodeName();
		const attributes = this.parseAttributes();

		this.skipWhitespace();

		let children = [];
		let textContent = null;

		if (this.xmlString[this.currentIndex] === '>') {
			this.currentIndex++; // Skip '>'
			children = this.parseChildren(nodeName);
		} else if (this.xmlString[this.currentIndex] === '/' && this.xmlString[this.currentIndex + 1] === '>') {
			this.currentIndex += 2; // Skip '/>'
			return {
				name: nodeName,
				"@": attributes,
				children: [],
				textContent: null
			};
		} else {
			throw new Error("Unexpected character at position " + this.currentIndex);
		}

		return {
			name: nodeName,
			"@": attributes,
			children: children,
			textContent: textContent
		};
	}

	parseNodeName() {
		const start = this.currentIndex;
		while (this.currentIndex < this.xmlString.length && /[a-zA-Z0-9_:.-]/.test(this.xmlString[this.currentIndex])) {
			this.currentIndex++;
		}
		if (start === this.currentIndex) {
			throw new Error("Expected node name at position " + start);
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
				throw new Error("Expected '=' after attribute name at position " + this.currentIndex);
			}
			this.currentIndex++; // Skip '='
			this.skipWhitespace();
			const value = this.parseAttributeValue();
			attributes[name] = value;
		}
		return attributes;
	}

	parseAttributeValue() {
		const quote = this.xmlString[this.currentIndex];
		if (quote !== '"' && quote !== "'") {
			throw new Error("Expected '\"' or \"'\" for attribute value at position " + this.currentIndex);
		}
		this.currentIndex++; // Skip opening quote
		const start = this.currentIndex;
		while (this.currentIndex < this.xmlString.length && this.xmlString[this.currentIndex] !== quote) {
			this.currentIndex++;
		}
		if (this.currentIndex >= this.xmlString.length) {
			throw new Error("Unterminated attribute value starting at position " + start);
		}
		const value = this.xmlString.substring(start, this.currentIndex);
		this.currentIndex++; // Skip closing quote
		return value;
	}

	parseChildren(parentNodeName) {
		const children = [];
		let textContent = '';

		while (this.currentIndex < this.xmlString.length) {
			this.skipWhitespace();
			if (this.xmlString[this.currentIndex] === '<') {
				if (this.xmlString[this.currentIndex + 1] === '/') {
					this.currentIndex += 2; // Skip '</'
					const endTagName = this.parseNodeName();
					if (endTagName !== parentNodeName) {
						throw new Error(`Expected closing tag </${parentNodeName}> but found </${endTagName}> at position ` + this.currentIndex);
					}
					this.skipWhitespace();
					if (this.xmlString[this.currentIndex] !== '>') {
						throw new Error("Expected '>' at position " + this.currentIndex);
					}
					this.currentIndex++; // Skip '>'
					if (textContent.trim().length > 0) {
						children.push({
							name: "#text",
							"@": {},
							children: [],
							textContent: textContent.trim()
						});
					}
					break;
				} else {
					const childNode = this.parseNode();
					children.push(childNode);
				}
			} else {
				textContent += this.xmlString[this.currentIndex];
				this.currentIndex++;
			}
		}

		return children;
	}

	skipWhitespace() {
		while (this.currentIndex < this.xmlString.length && /\s/.test(this.xmlString[this.currentIndex])) {
			this.currentIndex++;
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
}
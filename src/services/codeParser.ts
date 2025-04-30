
/**
 * Extracts JSDoc comments from code
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of JSDoc comments
 */
export function extractJSDocComments(code: string): string[] {
  const jsDocRegex = /\/\*\*[\s\S]*?\*\//g;
  return code.match(jsDocRegex) || [];
}

/**
 * Extracts inline comments from code
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of inline comments
 */
export function extractInlineComments(code: string): string[] {
  const inlineCommentRegex = /\/\/.*$/gm;
  return code.match(inlineCommentRegex) || [];
}

/**
 * Extracts function definitions from code
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of function information
 */
export function extractFunctionDefs(code: string): { name: string, params: string, body: string }[] {
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*{([^}]*)}/g;
  const methodRegex = /(\w+)\s*\(([^)]*)\)\s*{([^}]*)}/g;
  const arrowFuncRegex = /(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*{([^}]*)}/g;
  
  const functions = [];
  
  // Match regular functions
  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      params: match[2],
      body: match[3]
    });
  }
  
  // Match method definitions
  while ((match = methodRegex.exec(code)) !== null) {
    // Skip if it looks like it's already been captured
    if (!functions.some(f => f.name === match[1])) {
      functions.push({
        name: match[1],
        params: match[2],
        body: match[3]
      });
    }
  }
  
  // Match arrow functions
  while ((match = arrowFuncRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      params: match[2],
      body: match[3]
    });
  }
  
  return functions;
}

/**
 * Extracts export definitions from code
 * @param {string} code - Source code to parse
 * @returns {object} Map of exported values
 */
export function extractExports(code: string): Record<string, string> {
  const moduleExportsRegex = /module\.exports\s*=\s*{([^}]*)}/g;
  const exports = {};
  
  let match;
  while ((match = moduleExportsRegex.exec(code)) !== null) {
    const exportBlock = match[1];
    const exportPairs = exportBlock.split(',').map(pair => pair.trim());
    
    for (const pair of exportPairs) {
      if (pair.includes(':')) {
        const [key, value] = pair.split(':').map(p => p.trim());
        exports[key] = value;
      } else if (pair) {
        exports[pair] = pair;
      }
    }
  }
  
  return exports;
}

/**
 * Extracts all knowledge from code
 * @param {string} code - Source code to parse
 * @param {string} filePath - Path to the file
 * @returns {object} Extracted knowledge
 */
export function extractKnowledge(code: string, filePath: string) {
  return {
    jsDocComments: extractJSDocComments(code),
    inlineComments: extractInlineComments(code),
    functions: extractFunctionDefs(code),
    exports: extractExports(code),
    filePath
  };
}

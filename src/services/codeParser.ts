/**
 * Extracts JSDoc comments from code
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of JSDoc comments
 */
export function extractJSDocComments(code: string): string[] {
  const jsDocRegex = /\/\*\*[\s\S]*?\*\//g;
  const comments = code.match(jsDocRegex) || [];
  
  // Filter out empty comments
  return comments.filter(comment => 
    comment.length > 5 && 
    comment.includes('*') && 
    !comment.includes('@private')
  );
}

/**
 * Extracts inline comments from code
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of inline comments
 */
export function extractInlineComments(code: string): string[] {
  const inlineCommentRegex = /\/\/.*$/gm;
  const comments = code.match(inlineCommentRegex) || [];
  
  // Filter out very short or empty comments
  return comments.filter(comment => 
    comment.length > 4 && 
    comment.trim().substring(2).trim().length > 0
  );
}

/**
 * Extracts structured data like arrays and objects
 * @param {string} code - Source code to parse
 * @returns {object} Extracted structured data
 */
export function extractStructuredData(code: string): Record<string, any> {
  const data = {};
  
  // Extract arrays with meaningful names
  const arrayRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\[([^\]]*)\]/g;
  let match;
  while ((match = arrayRegex.exec(code)) !== null) {
    const varName = match[1];
    const arrayContent = match[2];
    data[varName] = arrayContent;
  }
  
  // Extract object literals
  const objectRegex = /(?:const|let|var)\s+(\w+)\s*=\s*{([^}]*)}/g;
  while ((match = objectRegex.exec(code)) !== null) {
    const varName = match[1];
    const objectContent = match[2];
    data[varName] = objectContent;
  }
  
  return data;
}

/**
 * Extracts text content from JSX/TSX elements
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of text content
 */
export function extractJSXTextContent(code: string): string[] {
  const textContent = [];
  
  // Extract text from JSX elements
  const jsxTextRegex = />([^<>]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(code)) !== null) {
    const text = match[1].trim();
    if (text.length > 3 && !text.includes('{') && !text.includes('}')) {
      textContent.push(text);
    }
  }
  
  // Extract string literals that might contain important content
  const stringLiteralRegex = /["'`]([^"'`]{10,}?)["'`]/g;
  while ((match = stringLiteralRegex.exec(code)) !== null) {
    const text = match[1].trim();
    if (text.length > 10) {
      textContent.push(text);
    }
  }
  
  return textContent;
}

/**
 * Extracts function definitions from code
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of function information
 */
export function extractFunctionDefs(code: string): { name: string, params: string, body: string }[] {
  // Regular function definitions
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  // Class methods
  const methodRegex = /(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  // Arrow functions with identifier
  const arrowFuncRegex = /(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  // ES6 class method syntax
  const es6MethodRegex = /(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  
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
  
  // Match ES6 methods
  while ((match = es6MethodRegex.exec(code)) !== null) {
    if (!functions.some(f => f.name === match[1])) {
      functions.push({
        name: match[1],
        params: match[2],
        body: match[3]
      });
    }
  }
  
  return functions;
}

/**
 * Extracts class definitions from code
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of class information
 */
export function extractClassDefs(code: string): { name: string, methods: string[], extends: string | null }[] {
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{([^}]*)}/g;
  const classes = [];
  
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const extendsClass = match[2] || null;
    const classBody = match[3];
    
    // Extract method names from class body
    const methodNameRegex = /(\w+)\s*\([^)]*\)\s*{/g;
    const methods = [];
    let methodMatch;
    
    while ((methodMatch = methodNameRegex.exec(classBody)) !== null) {
      methods.push(methodMatch[1]);
    }
    
    classes.push({
      name: className,
      methods,
      extends: extendsClass
    });
  }
  
  return classes;
}

/**
 * Extracts export definitions from code
 * @param {string} code - Source code to parse
 * @returns {object} Map of exported values
 */
export function extractExports(code: string): Record<string, string> {
  const exports = {};
  
  // CommonJS module.exports = {...}
  const moduleExportsRegex = /module\.exports\s*=\s*{([^}]*)}/g;
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
  
  // ES6 named exports
  const es6ExportsRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  while ((match = es6ExportsRegex.exec(code)) !== null) {
    exports[match[1]] = match[1];
  }
  
  // ES6 default export
  const defaultExportRegex = /export\s+default\s+(\w+)/g;
  while ((match = defaultExportRegex.exec(code)) !== null) {
    exports['default'] = match[1];
  }
  
  return exports;
}

/**
 * Extracts imports from code
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of import information
 */
export function extractImports(code: string): { from: string, imports: string[] }[] {
  const importRegex = /import\s+(?:{([^}]*)}\s+from\s+)?['"]([^'"]+)['"]/g;
  const imports = [];
  
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const importedItems = match[1] 
      ? match[1].split(',').map(item => item.trim().split(' as ')[0]) 
      : ['default'];
      
    imports.push({
      from: match[2],
      imports: importedItems
    });
  }
  
  return imports;
}

/**
 * Extracts API route definitions
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of API route information
 */
export function extractAPIRoutes(code: string): { method: string, path: string, handler: string }[] {
  // Look for common API route patterns
  const expressStyleRegex = /app\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g;
  const routerStyleRegex = /router\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g;
  
  const routes = [];
  
  // Extract Express-style routes
  let match;
  while ((match = expressStyleRegex.exec(code)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      handler: match[3]
    });
  }
  
  // Extract Router-style routes
  while ((match = routerStyleRegex.exec(code)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
      handler: match[3]
    });
  }
  
  return routes;
}

/**
 * Extracts database model/schema definitions
 * @param {string} code - Source code to parse
 * @returns {object} Extracted model information
 */
export function extractDatabaseSchema(code: string): Record<string, { fields: string[], relationships: string[] }> {
  const schemas = {};
  
  // Look for common ORM patterns (Mongoose, Sequelize, Bookshelf, etc.)
  const mongooseSchemaRegex = /new\s+Schema\s*\(\s*{([^}]+)}\s*\)/g;
  const sequelizeModelRegex = /(\w+)\.define\s*\(\s*['"](\w+)['"]\s*,\s*{([^}]+)}/g;
  
  // Extract Mongoose schemas
  let match;
  while ((match = mongooseSchemaRegex.exec(code)) !== null) {
    const schemaContent = match[1];
    const fieldRegex = /(\w+):\s*{[^}]*}/g;
    const fields = [];
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(schemaContent)) !== null) {
      fields.push(fieldMatch[1]);
    }
    
    // Look for model name in surrounding code (simplified)
    const modelNameRegex = /model\s*\(\s*['"](\w+)['"]/;
    const modelMatch = code.match(modelNameRegex);
    const modelName = modelMatch ? modelMatch[1] : 'UnknownModel';
    
    schemas[modelName] = {
      fields,
      relationships: []
    };
  }
  
  // Extract Sequelize models
  while ((match = sequelizeModelRegex.exec(code)) !== null) {
    const modelName = match[2];
    const schemaContent = match[3];
    const fieldRegex = /(\w+):\s*{[^}]*}/g;
    const fields = [];
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(schemaContent)) !== null) {
      fields.push(fieldMatch[1]);
    }
    
    schemas[modelName] = {
      fields,
      relationships: []
    };
  }
  
  return schemas;
}

// Define interface for the knowledge extraction result
export interface ExtractedKnowledge {
  jsDocComments: string[];
  inlineComments: string[];
  functions: { name: string, params: string, body: string }[];
  exports: Record<string, string>;
  imports: { from: string, imports: string[] }[];
  filePath: string;
  fileType: string;
  apiRoutes?: { method: string, path: string, handler: string }[];
  databaseSchemas?: Record<string, { fields: string[], relationships: string[] }>;
  classes?: { name: string, methods: string[], extends: string | null }[];
  structuredData?: Record<string, any>;
  jsxTextContent?: string[];
}

/**
 * Extracts all knowledge from code
 * @param {string} code - Source code to parse
 * @param {string} filePath - Path to the file
 * @returns {ExtractedKnowledge} Extracted knowledge
 */
export function extractKnowledge(code: string, filePath: string): ExtractedKnowledge {
  // Extract file type from path
  const fileType = filePath.split('.').pop()?.toLowerCase() || '';
  
  // Basic knowledge extraction for all file types
  const knowledge: ExtractedKnowledge = {
    jsDocComments: extractJSDocComments(code),
    inlineComments: extractInlineComments(code),
    functions: extractFunctionDefs(code),
    exports: extractExports(code),
    imports: extractImports(code),
    filePath,
    fileType
  };
  
  // Enhanced extraction based on file type or content patterns
  if (fileType === 'js' || fileType === 'ts' || fileType === 'jsx' || fileType === 'tsx') {
    // Look for API routes in files that might define them
    if (
      filePath.includes('api') || 
      filePath.includes('route') || 
      filePath.includes('controller')
    ) {
      knowledge['apiRoutes'] = extractAPIRoutes(code);
    }
    
    // Look for database schemas/models
    if (
      filePath.includes('model') || 
      filePath.includes('schema') || 
      code.includes('Schema') || 
      code.includes('define(')
    ) {
      knowledge['databaseSchemas'] = extractDatabaseSchema(code);
    }
    
    // Extract class definitions for all JS/TS files
    knowledge['classes'] = extractClassDefs(code);
    
    // Extract structured data for all files
    knowledge['structuredData'] = extractStructuredData(code);
    
    // Extract JSX text content for React components
    if (fileType === 'jsx' || fileType === 'tsx') {
      knowledge['jsxTextContent'] = extractJSXTextContent(code);
    }
  }
  
  return knowledge;
}

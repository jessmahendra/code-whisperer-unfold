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
 * Extracts structured data like arrays and objects with meaningful content
 * @param {string} code - Source code to parse
 * @returns {object} Extracted structured data
 */
export function extractStructuredData(code: string): Record<string, any> {
  const data = {};
  
  // For any file, treat the content as structured data
  if (code.trim().length > 0) {
    data['fileContent'] = code.substring(0, 5000); // Store substantial content
  }
  
  // Extract arrays with meaningful names
  const arrayRegex = /(?:const|let|var)\s+(\w+)\s*=\s*\[([^\]]*)\]/g;
  let match;
  while ((match = arrayRegex.exec(code)) !== null) {
    const varName = match[1];
    const arrayContent = match[2];
    if (arrayContent.trim().length > 0) {
      data[varName] = arrayContent.trim();
    }
  }
  
  // Extract object literals with meaningful content
  const objectRegex = /(?:const|let|var)\s+(\w+)\s*=\s*{([^}]*)}/g;
  while ((match = objectRegex.exec(code)) !== null) {
    const varName = match[1];
    const objectContent = match[2];
    if (objectContent.trim().length > 0) {
      data[varName] = objectContent.trim();
    }
  }

  // Extract multi-line template literals and strings that might contain content
  const templateLiteralRegex = /`([^`]{10,}?)`/g;
  while ((match = templateLiteralRegex.exec(code)) !== null) {
    const content = match[1].trim();
    if (content.length > 10) {
      data[`template_${Object.keys(data).length}`] = content;
    }
  }
  
  // Extract string literals that might contain important information
  const stringLiteralRegex = /["']([^"']{20,}?)["']/g;
  while ((match = stringLiteralRegex.exec(code)) !== null) {
    const content = match[1].trim();
    if (content.length > 20 && !content.startsWith('http') && !content.includes('\\')) {
      data[`string_${Object.keys(data).length}`] = content;
    }
  }
  
  return data;
}

/**
 * Enhanced JSX text content extraction
 * @param {string} code - Source code to parse
 * @returns {string[]} Array of text content
 */
export function extractJSXTextContent(code: string): string[] {
  const textContent = [];
  
  // Extract text from JSX elements (more comprehensive)
  const jsxTextRegex = />([^<>{}]+)</g;
  let match;
  while ((match = jsxTextRegex.exec(code)) !== null) {
    const text = match[1].trim();
    if (text.length > 2 && !text.includes('{') && !text.includes('}') && !text.startsWith('//')) {
      textContent.push(text);
    }
  }
  
  // Extract string literals that might contain important content
  const stringLiteralRegex = /["'`]([^"'`]{15,}?)["'`]/g;
  while ((match = stringLiteralRegex.exec(code)) !== null) {
    const text = match[1].trim();
    if (text.length > 15 && !text.includes('\\n') && !text.startsWith('http')) {
      textContent.push(text);
    }
  }

  // Extract content from commonly used properties that might contain text
  const contentPropsRegex = /(title|description|label|placeholder|alt|aria-label|content)\s*[:=]\s*["'`]([^"'`]{10,}?)["'`]/g;
  while ((match = contentPropsRegex.exec(code)) !== null) {
    const text = match[2].trim();
    if (text.length > 10) {
      textContent.push(`${match[1]}: ${text}`);
    }
  }
  
  return textContent;
}

/**
 * Enhanced function definitions extraction
 * @param {string} code - Source code to parse
 * @returns {object[]} Array of function information
 */
export function extractFunctionDefs(code: string): { name: string, params: string, body: string }[] {
  const functions = [];
  
  // Regular function definitions
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  // Arrow functions with identifier
  const arrowFuncRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  // Arrow functions without braces
  const simpleArrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*([^;,\n}]+)/g;
  // Class methods
  const methodRegex = /(\w+)\s*\(([^)]*)\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*?)}/g;
  
  // Match regular functions
  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      params: match[2],
      body: match[3].substring(0, 500) // Limit body length
    });
  }
  
  // Match arrow functions with braces
  while ((match = arrowFuncRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      params: match[2],
      body: match[3].substring(0, 500)
    });
  }

  // Match simple arrow functions
  while ((match = simpleArrowRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      params: match[2],
      body: match[3].substring(0, 200)
    });
  }
  
  // Match methods (be more selective to avoid duplicates)
  const methodMatches = [];
  while ((match = methodRegex.exec(code)) !== null) {
    if (!functions.some(f => f.name === match[1])) {
      methodMatches.push({
        name: match[1],
        params: match[2],
        body: match[3].substring(0, 500)
      });
    }
  }
  
  functions.push(...methodMatches);
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
 * Enhanced exports extraction
 * @param {string} code - Source code to parse
 * @returns {object} Map of exported values
 */
export function extractExports(code: string): Record<string, string> {
  const exports = {};
  
  // ES6 named exports
  const es6ExportsRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  let match;
  while ((match = es6ExportsRegex.exec(code)) !== null) {
    exports[match[1]] = match[1];
  }
  
  // ES6 default export
  const defaultExportRegex = /export\s+default\s+(\w+)/g;
  while ((match = defaultExportRegex.exec(code)) !== null) {
    exports['default'] = match[1];
  }

  // Export object destructuring
  const exportObjectRegex = /export\s*{([^}]+)}/g;
  while ((match = exportObjectRegex.exec(code)) !== null) {
    const exportList = match[1].split(',').map(item => item.trim());
    exportList.forEach(item => {
      const cleanItem = item.replace(/\s+as\s+\w+/, '').trim();
      if (cleanItem) {
        exports[cleanItem] = cleanItem;
      }
    });
  }

  // CommonJS module.exports
  const moduleExportsRegex = /module\.exports\s*=\s*{([^}]*)}/g;
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
 * Enhanced knowledge extraction with better content detection
 * @param {string} code - Source code to parse
 * @param {string} filePath - Path to the file
 * @returns {ExtractedKnowledge} Extracted knowledge
 */
export function extractKnowledge(code: string, filePath: string): ExtractedKnowledge {
  console.log(`Extracting knowledge from ${filePath}, content length: ${code.length}`);
  
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
  
  // Always extract structured data for better content detection
  knowledge['structuredData'] = extractStructuredData(code);
  
  // Enhanced extraction based on file type or content patterns
  if (fileType === 'js' || fileType === 'ts' || fileType === 'jsx' || fileType === 'tsx') {
    // Extract JSX text content for React components
    if (fileType === 'jsx' || fileType === 'tsx') {
      knowledge['jsxTextContent'] = extractJSXTextContent(code);
    }
    
    // Look for API routes in files that might define them
    if (
      filePath.includes('api') || 
      filePath.includes('route') || 
      filePath.includes('controller') ||
      code.includes('app.get') ||
      code.includes('app.post') ||
      code.includes('router.')
    ) {
      knowledge['apiRoutes'] = extractAPIRoutes(code);
    }
    
    // Look for database schemas/models
    if (
      filePath.includes('model') || 
      filePath.includes('schema') || 
      code.includes('Schema') || 
      code.includes('define(') ||
      code.includes('sequelize') ||
      code.includes('mongoose')
    ) {
      knowledge['databaseSchemas'] = extractDatabaseSchema(code);
    }
    
    // Extract class definitions for all JS/TS files
    knowledge['classes'] = extractClassDefs(code);
  }

  console.log(`Knowledge extracted from ${filePath}:`, {
    jsDocComments: knowledge.jsDocComments.length,
    inlineComments: knowledge.inlineComments.length,
    functions: knowledge.functions.length,
    exports: Object.keys(knowledge.exports).length,
    structuredDataKeys: Object.keys(knowledge.structuredData || {}).length,
    jsxTextContent: knowledge.jsxTextContent?.length || 0
  });
  
  return knowledge;
}

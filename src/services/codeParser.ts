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
 * Extracts content metadata from markdown files
 * @param {string} content - Markdown file content
 * @returns {object} Metadata including title, date, tags, etc.
 */
export function extractMarkdownMetadata(content: string): {
  title?: string;
  date?: string;
  tags?: string[];
  description?: string;
  frontmatter?: Record<string, any>;
} {
  const metadata: any = {};
  
  // Extract frontmatter (YAML between --- blocks)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const lines = frontmatter.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/['"]/g, '');
        
        if (key === 'tags' && value.includes(',')) {
          metadata[key] = value.split(',').map(tag => tag.trim());
        } else {
          metadata[key] = value;
        }
      }
    }
    metadata.frontmatter = metadata;
  }
  
  // Extract title from first h1 if not in frontmatter
  if (!metadata.title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1];
    }
  }
  
  return metadata;
}

/**
 * Extracts page routing information from Next.js app directory
 * @param {string} filePath - File path
 * @returns {object} Page route information
 */
export function extractPageRouting(filePath: string): {
  route?: string;
  type?: 'page' | 'layout' | 'loading' | 'error' | 'api';
  dynamic?: boolean;
} {
  const routeInfo: any = {};
  
  // Next.js App Router patterns
  if (filePath.includes('/app/')) {
    const pathParts = filePath.split('/app/')[1].split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // Determine file type
    if (fileName === 'page.tsx' || fileName === 'page.js') {
      routeInfo.type = 'page';
    } else if (fileName === 'layout.tsx' || fileName === 'layout.js') {
      routeInfo.type = 'layout';
    } else if (fileName === 'loading.tsx' || fileName === 'loading.js') {
      routeInfo.type = 'loading';
    } else if (fileName === 'error.tsx' || fileName === 'error.js') {
      routeInfo.type = 'error';
    } else if (fileName === 'route.ts' || fileName === 'route.js') {
      routeInfo.type = 'api';
    }
    
    // Build route path
    const routeParts = pathParts.slice(0, -1);
    routeInfo.route = '/' + routeParts.join('/');
    
    // Check for dynamic routes
    routeInfo.dynamic = routeParts.some(part => part.startsWith('[') && part.endsWith(']'));
  }
  
  return routeInfo;
}

/**
 * Extracts CMS configuration information
 * @param {string} code - Configuration file content
 * @param {string} filePath - File path
 * @returns {object} CMS configuration data
 */
export function extractCMSConfig(code: string, filePath: string): {
  platform?: string;
  contentTypes?: string[];
  collections?: string[];
  pageCount?: number;
} {
  const config: any = {};
  
  // Ghost CMS detection
  if (filePath.includes('ghost') || code.includes('ghost')) {
    config.platform = 'Ghost';
    
    // Look for post/page configuration
    const postMatches = code.match(/posts?['":\s]*(\d+)/gi);
    const pageMatches = code.match(/pages?['":\s]*(\d+)/gi);
    
    if (postMatches || pageMatches) {
      config.contentTypes = ['posts', 'pages'];
    }
  }
  
  // Strapi CMS detection
  if (filePath.includes('strapi') || code.includes('strapi')) {
    config.platform = 'Strapi';
    
    // Extract collection types
    const collectionMatches = code.match(/collection-types\/(\w+)/g);
    if (collectionMatches) {
      config.collections = collectionMatches.map(match => 
        match.replace('collection-types/', '')
      );
    }
  }
  
  // WordPress detection
  if (code.includes('wp-') || code.includes('wordpress')) {
    config.platform = 'WordPress';
    config.contentTypes = ['posts', 'pages'];
  }
  
  return config;
}

/**
 * Counts content files in directory structures
 * @param {string} code - Directory listing or file content
 * @param {string} filePath - File path
 * @returns {object} Content counts
 */
export function extractContentCounts(code: string, filePath: string): {
  posts?: number;
  pages?: number;
  files?: number;
  directories?: number;
} {
  const counts: any = {};
  
  // Count markdown files that might be blog posts
  const mdMatches = code.match(/\.md\b/g);
  if (mdMatches) {
    counts.files = mdMatches.length;
    
    // If in posts/blog directory, consider as posts
    if (filePath.includes('/posts/') || filePath.includes('/blog/')) {
      counts.posts = mdMatches.length;
    } else if (filePath.includes('/pages/')) {
      counts.pages = mdMatches.length;
    }
  }
  
  // Count directory entries
  const dirMatches = code.match(/type:\s*['"]dir['"]/g);
  if (dirMatches) {
    counts.directories = dirMatches.length;
  }
  
  return counts;
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
  markdownMetadata?: {
    title?: string;
    date?: string;
    tags?: string[];
    description?: string;
    frontmatter?: Record<string, any>;
  };
  pageRouting?: {
    route?: string;
    type?: 'page' | 'layout' | 'loading' | 'error' | 'api';
    dynamic?: boolean;
  };
  cmsConfig?: {
    platform?: string;
    contentTypes?: string[];
    collections?: string[];
    pageCount?: number;
  };
  contentCounts?: {
    posts?: number;
    pages?: number;
    files?: number;
    directories?: number;
  };
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
  if (fileType === 'js' || fileType === 'ts' || fileType === 'tsx' || fileType === 'jsx') {
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
    
    // Extract Next.js page routing information
    if (filePath.includes('/app/') || filePath.includes('/pages/')) {
      knowledge['pageRouting'] = extractPageRouting(filePath);
    }
  }
  
  // Extract markdown metadata for .md files
  if (fileType === 'md' || fileType === 'mdx') {
    knowledge['markdownMetadata'] = extractMarkdownMetadata(code);
    knowledge['contentCounts'] = extractContentCounts(code, filePath);
  }
  
  // Extract CMS configuration
  if (
    filePath.includes('config') || 
    filePath.includes('ghost') || 
    filePath.includes('strapi') ||
    filePath.includes('cms')
  ) {
    knowledge['cmsConfig'] = extractCMSConfig(code, filePath);
  }
  
  // Extract content counts from directory listings or package.json
  if (filePath.includes('package.json') || code.includes('"type":') || code.includes('"name":')) {
    knowledge['contentCounts'] = extractContentCounts(code, filePath);
  }
  
  return knowledge;
}

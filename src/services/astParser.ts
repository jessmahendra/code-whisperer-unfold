
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ClassInfo {
  name: string;
  methods: string[];
  superClass?: string;
  location: string;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  async: boolean;
  location: string;
  startLine: number;
  endLine: number;
}

export interface ApiEndpointInfo {
  path: string;
  method: string;
  handler: string;
  location: string;
}

export interface CodeStructure {
  classes: ClassInfo[];
  functions: FunctionInfo[];
  apiEndpoints: ApiEndpointInfo[];
  imports: string[];
  exports: string[];
  relationships: {
    functionCalls: {caller: string; callee: string}[];
  };
}

/**
 * Parse code into an AST and extract detailed structural information
 * @param {string} code - Source code to parse
 * @param {string} filePath - Path to the source file
 * @returns {CodeStructure} Extracted code structure information
 */
export function parseCodeStructure(code: string, filePath: string): CodeStructure {
  // Default structure
  const codeStructure: CodeStructure = {
    classes: [],
    functions: [],
    apiEndpoints: [],
    imports: [],
    exports: [],
    relationships: {
      functionCalls: []
    }
  };

  try {
    // Parse into AST
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'exportDefaultFrom'
      ],
    });

    // Track line numbers
    const lines = code.split('\n');
    const getLineNumber = (index: number): number => {
      let lineCount = 0;
      let pos = 0;
      
      while (pos < index && lineCount < lines.length) {
        pos += lines[lineCount].length + 1; // +1 for the newline character
        lineCount++;
      }
      
      return lineCount;
    };

    // Traverse AST
    traverse(ast, {
      // Extract classes
      ClassDeclaration(path) {
        if (path.node.id) {
          const className = path.node.id.name;
          const methods = path.node.body.body
            .filter(node => t.isClassMethod(node))
            .map(node => {
              if (t.isClassMethod(node) && node.key && (t.isIdentifier(node.key) || t.isStringLiteral(node.key))) {
                return t.isIdentifier(node.key) ? node.key.name : node.key.value;
              }
              return 'unknown';
            });
          
          codeStructure.classes.push({
            name: className,
            methods,
            location: filePath,
            superClass: path.node.superClass && t.isIdentifier(path.node.superClass) 
              ? path.node.superClass.name 
              : undefined
          });
        }
      },

      // Extract functions
      FunctionDeclaration(path) {
        if (path.node.id) {
          const name = path.node.id.name;
          const params = path.node.params.map(param => {
            if (t.isIdentifier(param)) {
              return param.name;
            }
            return 'param';
          });

          const startLine = getLineNumber(path.node.start || 0);
          const endLine = getLineNumber(path.node.end || 0);
          
          codeStructure.functions.push({
            name,
            params,
            async: path.node.async,
            location: filePath,
            startLine,
            endLine
          });
        }
      },

      // Extract arrow functions with assignments
      VariableDeclarator(path) {
        if (t.isArrowFunctionExpression(path.node.init) || t.isFunctionExpression(path.node.init)) {
          if (t.isIdentifier(path.node.id)) {
            const name = path.node.id.name;
            const func = path.node.init;
            const params = func.params.map(param => {
              if (t.isIdentifier(param)) {
                return param.name;
              }
              return 'param';
            });

            const startLine = getLineNumber(path.node.start || 0);
            const endLine = getLineNumber(path.node.end || 0);
            
            codeStructure.functions.push({
              name,
              params,
              async: func.async,
              location: filePath,
              startLine,
              endLine
            });
          }
        }
      },

      // Extract API endpoints (common patterns in Express, etc.)
      CallExpression(path) {
        // Look for patterns like router.get('/api/endpoint', handler)
        if (t.isMemberExpression(path.node.callee)) {
          const obj = path.node.callee.object;
          const prop = path.node.callee.property;
          
          if (
            t.isIdentifier(obj) && 
            t.isIdentifier(prop) && 
            ['get', 'post', 'put', 'delete', 'patch'].includes(prop.name)
          ) {
            if (path.node.arguments.length >= 2) {
              const firstArg = path.node.arguments[0];
              if (t.isStringLiteral(firstArg)) {
                const endpoint: ApiEndpointInfo = {
                  path: firstArg.value,
                  method: prop.name,
                  handler: 'handler',
                  location: filePath
                };
                
                // Try to get handler name
                const secondArg = path.node.arguments[1];
                if (t.isIdentifier(secondArg)) {
                  endpoint.handler = secondArg.name;
                }
                
                codeStructure.apiEndpoints.push(endpoint);
              }
            }
          }
        }
      },
      
      // Extract imports
      ImportDeclaration(path) {
        if (t.isStringLiteral(path.node.source)) {
          codeStructure.imports.push(path.node.source.value);
        }
      },
      
      // Extract exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
            codeStructure.exports.push(path.node.declaration.id.name);
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach(decl => {
              if (t.isIdentifier(decl.id)) {
                codeStructure.exports.push(decl.id.name);
              }
            });
          }
        }
        
        // Handle export { x, y } syntax
        path.node.specifiers.forEach(specifier => {
          if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
            codeStructure.exports.push(specifier.exported.name);
          }
        });
      },
      
      ExportDefaultDeclaration(path) {
        if (t.isFunctionDeclaration(path.node.declaration) && path.node.declaration.id) {
          codeStructure.exports.push(`default (${path.node.declaration.id.name})`);
        } else if (t.isIdentifier(path.node.declaration)) {
          codeStructure.exports.push(`default (${path.node.declaration.name})`);
        } else {
          codeStructure.exports.push('default');
        }
      }
    });

    // Extract function call relationships
    traverse(ast, {
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          // Get enclosing function
          let fnName = 'global';
          let parent = path.getFunctionParent();
          
          if (parent && parent.node) {
            if (t.isFunctionDeclaration(parent.node) && parent.node.id) {
              fnName = parent.node.id.name;
            } else if (t.isArrowFunctionExpression(parent.node) || t.isFunctionExpression(parent.node)) {
              const varParent = parent.findParent(p => t.isVariableDeclarator(p.node));
              if (varParent && t.isVariableDeclarator(varParent.node) && t.isIdentifier(varParent.node.id)) {
                fnName = varParent.node.id.name;
              }
            }
          }
          
          // Record the function call relationship
          codeStructure.relationships.functionCalls.push({
            caller: fnName,
            callee: path.node.callee.name
          });
        }
      }
    });

    return codeStructure;
  } catch (error) {
    console.error(`Error parsing code in ${filePath}:`, error);
    return codeStructure;
  }
}

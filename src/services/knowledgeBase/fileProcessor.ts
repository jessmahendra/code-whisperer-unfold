
import { getFileContent, getRepositoryContents } from '../githubConnector';
import { extractKnowledge } from '../codeParser';
import { KnowledgeEntry } from './types';
import { extractKeywords } from './keywordUtils';

// Cache for processed files to avoid redundant processing
const processedFilesCache: Set<string> = new Set();

/**
 * Processes a file by extracting knowledge from its content
 * @param {string} filePath - Path to the file
 * @param {KnowledgeEntry[]} knowledgeBase - Reference to the knowledge base
 * @returns {Promise<void>}
 */
export async function processFile(
  filePath: string, 
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Skip if already processed and cached
  if (processedFilesCache.has(filePath)) {
    return;
  }
  
  try {
    // Add to processed cache
    processedFilesCache.add(filePath);
    
    // Get file content
    const content = await getFileContent(filePath);
    
    // Extract knowledge
    const knowledge = extractKnowledge(content, filePath);
    
    // Add JSDoc comments to knowledge base
    for (const comment of knowledge.jsDocComments) {
      knowledgeBase.push({
        type: 'comment',
        content: comment,
        filePath,
        keywords: extractKeywords(comment),
      });
    }
    
    // Add function definitions to knowledge base
    for (const func of knowledge.functions) {
      const funcContent = `function ${func.name}(${func.params}) { ... }`;
      knowledgeBase.push({
        type: 'function',
        content: funcContent,
        filePath,
        metadata: func,
        keywords: extractKeywords(funcContent + ' ' + func.name),
      });
    }
    
    // Add exports to knowledge base
    for (const [key, value] of Object.entries(knowledge.exports)) {
      knowledgeBase.push({
        type: 'export',
        content: `module.exports.${key} = ${value}`,
        filePath,
        keywords: extractKeywords(key + ' ' + value),
      });
    }
    
    // Add API routes if available
    if (knowledge.apiRoutes) {
      for (const route of knowledge.apiRoutes) {
        knowledgeBase.push({
          type: 'export',
          content: `API Route: ${route.method} ${route.path} => ${route.handler}`,
          filePath,
          metadata: route,
          keywords: extractKeywords(`api route ${route.method} ${route.path} ${route.handler}`),
        });
      }
    }
    
    // Add database schemas if available
    if (knowledge.databaseSchemas) {
      for (const [modelName, schema] of Object.entries(knowledge.databaseSchemas)) {
        knowledgeBase.push({
          type: 'export',
          content: `Database Model: ${modelName} with fields: ${schema.fields.join(', ')}`,
          filePath,
          metadata: { modelName, schema },
          keywords: extractKeywords(`database model ${modelName} ${schema.fields.join(' ')}`),
        });
      }
    }
    
    // Add class definitions if available
    if (knowledge.classes) {
      for (const classInfo of knowledge.classes) {
        knowledgeBase.push({
          type: 'export',
          content: `Class: ${classInfo.name}${classInfo.extends ? ` extends ${classInfo.extends}` : ''} with methods: ${classInfo.methods.join(', ')}`,
          filePath,
          metadata: classInfo,
          keywords: extractKeywords(`class ${classInfo.name} ${classInfo.methods.join(' ')}`),
        });
      }
    }
    
    // Log successful file processing
    console.log(`Successfully processed file: ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

/**
 * Processes a module by extracting knowledge from its files
 * @param {string} modulePath - Path to the module
 * @param {KnowledgeEntry[]} knowledgeBase - Reference to the knowledge base
 * @returns {Promise<void>}
 */
export async function processModule(
  modulePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  try {
    // Get all files in the module
    const contents = await getRepositoryContents(modulePath);
    
    // Process each item (file or directory)
    for (const item of contents) {
      if (item.type === 'file') {
        // Process JavaScript/TypeScript files
        if (item.name.endsWith('.js') || item.name.endsWith('.ts')) {
          await processFile(item.path, knowledgeBase);
        }
      } else if (item.type === 'dir') {
        // Recursively process directories, but limit depth to avoid excessive API calls
        const depth = modulePath.split('/').length;
        if (depth < 8) {  // Limit directory recursion depth
          await processModule(item.path, knowledgeBase);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
    throw error; // Propagate error to allow for proper path exploration
  }
}

/**
 * Clears the file processing cache
 */
export function clearProcessedFilesCache(): void {
  processedFilesCache.clear();
}

/**
 * Gets the number of processed files
 * @returns {number} Number of processed files
 */
export function getProcessedFileCount(): number {
  return processedFilesCache.size;
}

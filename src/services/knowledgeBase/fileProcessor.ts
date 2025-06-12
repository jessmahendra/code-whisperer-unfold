import { getCurrentRepository, getRepositoryContents } from '../githubConnector';
import { extractKnowledge, ExtractedKnowledge } from '../codeParser';
import { extractKeywords } from './keywordUtils';
import { KnowledgeEntry } from './types';

// Cache for processed files to avoid reprocessing
let processedFilesCache = new Set<string>();

/**
 * Processes a file from the repository and extracts knowledge
 * @param {string} filePath - Path to the file in the repository
 * @param {KnowledgeEntry[]} knowledgeBase - The knowledge base to add entries to
 * @returns {Promise<boolean>} Whether processing was successful
 */
export async function processFile(filePath: string, knowledgeBase: KnowledgeEntry[]): Promise<boolean> {
  // Skip if already processed
  if (processedFilesCache.has(filePath)) {
    return true;
  }

  try {
    console.log(`Processing file: ${filePath}`);
    
    const contents = await getRepositoryContents(filePath);
    
    // Handle file content
    if (contents && typeof contents === 'object' && 'content' in contents) {
      // Decode base64 content
      const content = atob(contents.content as string);
      
      // Extract knowledge using enhanced parser
      const knowledge = extractKnowledge(content, filePath);
      
      // Create knowledge entries
      await createKnowledgeEntries(knowledge, knowledgeBase);
      
      processedFilesCache.add(filePath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create knowledge entries from extracted content
 */
async function createKnowledgeEntries(knowledge: ExtractedKnowledge, knowledgeBase: KnowledgeEntry[]): Promise<void> {
  const { filePath } = knowledge;
  
  // Process JSX/HTML text content
  if (knowledge.jsxTextContent && knowledge.jsxTextContent.length > 0) {
    console.log(`Found ${knowledge.jsxTextContent.length} text content items in ${filePath}`);
    
    knowledge.jsxTextContent.forEach((text, index) => {
      knowledgeBase.push({
        id: `${filePath}-text-${index}`,
        content: text,
        type: 'text-content',
        filePath,
        keywords: extractKeywords(text),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: `Text content from ${filePath}`,
          contentType: 'text'
        }
      });
    });
  }
  
  // Process structured data
  if (knowledge.structuredData) {
    Object.entries(knowledge.structuredData).forEach(([key, value]) => {
      knowledgeBase.push({
        id: `${filePath}-data-${key}`,
        content: `Data structure: ${key}\nContent: ${value}`,
        type: 'structured-data',
        filePath,
        keywords: extractKeywords(`${key} ${value}`),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: key,
          dataType: 'structured'
        }
      });
    });
  }
  
  // Process comments
  knowledge.jsDocComments.forEach((comment, index) => {
    knowledgeBase.push({
      id: `${filePath}-comment-${index}`,
      content: comment,
      type: 'comment',
      filePath,
      keywords: extractKeywords(comment),
      lastUpdated: new Date().toISOString()
    });
  });

  knowledge.inlineComments.forEach((comment, index) => {
    knowledgeBase.push({
      id: `${filePath}-inline-${index}`,
      content: comment,
      type: 'comment',
      filePath,
      keywords: extractKeywords(comment),
      lastUpdated: new Date().toISOString()
    });
  });

  // Function processing
  knowledge.functions.forEach((func, index) => {
    const funcContent = `Function: ${func.name}\nParameters: ${func.params}\nBody: ${func.body.substring(0, 500)}...`;
    
    knowledgeBase.push({
      id: `${filePath}-function-${index}`,
      content: funcContent,
      type: 'function',
      filePath,
      keywords: extractKeywords(funcContent),
      lastUpdated: new Date().toISOString(),
      metadata: {
        name: func.name,
        params: func.params
      }
    });
  });

  // Export processing
  Object.entries(knowledge.exports).forEach(([key, value], index) => {
    knowledgeBase.push({
      id: `${filePath}-export-${index}`,
      content: `Export: ${key} = ${value}`,
      type: 'export',
      filePath,
      keywords: extractKeywords(`${key} ${value}`),
      lastUpdated: new Date().toISOString(),
      metadata: {
        name: key,
        value: value
      }
    });
  });

  // Class processing
  if (knowledge.classes) {
    knowledge.classes.forEach((cls, index) => {
      const classContent = `Class: ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}\nMethods: ${cls.methods.join(', ')}`;
      
      knowledgeBase.push({
        id: `${filePath}-class-${index}`,
        content: classContent,
        type: 'class',
        filePath,
        keywords: extractKeywords(classContent),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: cls.name,
          extends: cls.extends,
          methods: cls.methods
        }
      });
    });
  }

  // API route processing
  if (knowledge.apiRoutes) {
    knowledge.apiRoutes.forEach((route, index) => {
      knowledgeBase.push({
        id: `${filePath}-route-${index}`,
        content: `API Route: ${route.method} ${route.path} -> ${route.handler}`,
        type: 'api-route',
        filePath,
        keywords: extractKeywords(`${route.method} ${route.path} ${route.handler}`),
        lastUpdated: new Date().toISOString(),
        metadata: {
          method: route.method,
          path: route.path,
          handler: route.handler
        }
      });
    });
  }
}

/**
 * Processes a module by attempting to scan its directory structure
 * @param {string} modulePath - Path to the module directory
 * @param {KnowledgeEntry[]} knowledgeBase - The knowledge base to add entries to
 * @returns {Promise<boolean>} Whether processing was successful
 */
export async function processModule(modulePath: string, knowledgeBase: KnowledgeEntry[]): Promise<boolean> {
  try {
    const contents = await getRepositoryContents(modulePath);
    
    if (Array.isArray(contents)) {
      let processedAny = false;
      
      for (const item of contents.slice(0, 10)) { // Limit to prevent too many requests
        if (item && typeof item === 'object' && 'type' in item && 'path' in item) {
          const typedItem = item as { type: string; path: string; name?: string };
          
          if (typedItem.type === 'file' && typedItem.name) {
            const success = await processFile(typedItem.path, knowledgeBase);
            if (success) {
              processedAny = true;
            }
          }
        }
      }
      
      return processedAny;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
    return false;
  }
}

/**
 * Get the count of processed files
 * @returns {number} Number of processed files
 */
export function getProcessedFileCount(): number {
  return processedFilesCache.size;
}

/**
 * Clear the processed files cache
 * @returns {void}
 */
export function clearProcessedFilesCache(): void {
  processedFilesCache.clear();
}

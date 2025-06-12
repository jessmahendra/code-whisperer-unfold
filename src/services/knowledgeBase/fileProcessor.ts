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
      
      // Skip very large files to prevent performance issues
      if (content.length > 100000) {
        console.log(`Skipping large file: ${filePath} (${content.length} chars)`);
        processedFilesCache.add(filePath);
        return true;
      }
      
      // Extract knowledge using enhanced parser
      const knowledge = extractKnowledge(content, filePath);
      
      // Create knowledge entries with better validation
      const entriesCreated = await createKnowledgeEntries(knowledge, knowledgeBase);
      
      if (entriesCreated > 0) {
        console.log(`Created ${entriesCreated} knowledge entries from ${filePath}`);
      }
      
      processedFilesCache.add(filePath);
      return entriesCreated > 0;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create knowledge entries from extracted content with better validation
 */
async function createKnowledgeEntries(knowledge: ExtractedKnowledge, knowledgeBase: KnowledgeEntry[]): Promise<number> {
  const { filePath } = knowledge;
  let entriesCreated = 0;
  
  // Process JSX/HTML text content
  if (knowledge.jsxTextContent && knowledge.jsxTextContent.length > 0) {
    console.log(`Found ${knowledge.jsxTextContent.length} text content items in ${filePath}`);
    
    knowledge.jsxTextContent.forEach((text, index) => {
      if (text.trim().length > 5) { // Only meaningful text
        knowledgeBase.push({
          id: `${filePath}-text-${index}`,
          content: text,
          type: 'text-content',
          filePath,
          keywords: extractKeywords(text),
          lastUpdated: new Date().toISOString(),
          metadata: {
            name: `Text content from ${filePath}`,
            contentType: 'text',
            location: `text-${index}`
          }
        });
        entriesCreated++;
      }
    });
  }
  
  // Process structured data with better filtering
  if (knowledge.structuredData) {
    Object.entries(knowledge.structuredData).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (valueStr.trim().length > 10) { // Only meaningful data
        knowledgeBase.push({
          id: `${filePath}-data-${key}`,
          content: `Data structure: ${key}\nContent: ${valueStr}`,
          type: 'structured-data',
          filePath,
          keywords: extractKeywords(`${key} ${valueStr}`),
          lastUpdated: new Date().toISOString(),
          metadata: {
            name: key,
            dataType: 'structured',
            category: 'data'
          }
        });
        entriesCreated++;
      }
    });
  }
  
  // Process comments with better filtering
  knowledge.jsDocComments.forEach((comment, index) => {
    if (comment.trim().length > 10) {
      knowledgeBase.push({
        id: `${filePath}-comment-${index}`,
        content: comment,
        type: 'comment',
        filePath,
        keywords: extractKeywords(comment),
        lastUpdated: new Date().toISOString(),
        metadata: {
          commentType: 'jsdoc'
        }
      });
      entriesCreated++;
    }
  });

  knowledge.inlineComments.forEach((comment, index) => {
    if (comment.trim().length > 8) {
      knowledgeBase.push({
        id: `${filePath}-inline-${index}`,
        content: comment,
        type: 'comment',
        filePath,
        keywords: extractKeywords(comment),
        lastUpdated: new Date().toISOString(),
        metadata: {
          commentType: 'inline'
        }
      });
      entriesCreated++;
    }
  });

  // Function processing with better content
  knowledge.functions.forEach((func, index) => {
    if (func.name && func.name.length > 1) {
      const funcContent = `Function: ${func.name}${func.params ? `\nParameters: ${func.params}` : ''}${func.body ? `\nImplementation: ${func.body.substring(0, 300)}` : ''}`;
      
      knowledgeBase.push({
        id: `${filePath}-function-${index}`,
        content: funcContent,
        type: 'function',
        filePath,
        keywords: extractKeywords(funcContent),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: func.name,
          params: func.params,
          category: 'function'
        }
      });
      entriesCreated++;
    }
  });

  // Export processing
  Object.entries(knowledge.exports).forEach(([key, value], index) => {
    if (key && key.length > 1) {
      knowledgeBase.push({
        id: `${filePath}-export-${index}`,
        content: `Export: ${key}${value !== key ? ` = ${value}` : ''}`,
        type: 'export',
        filePath,
        keywords: extractKeywords(`${key} ${value}`),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: key,
          value: value,
          category: 'export'
        }
      });
      entriesCreated++;
    }
  });

  // Class processing
  if (knowledge.classes) {
    knowledge.classes.forEach((cls, index) => {
      if (cls.name && cls.name.length > 1) {
        const classContent = `Class: ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}${cls.methods.length > 0 ? `\nMethods: ${cls.methods.join(', ')}` : ''}`;
        
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
            methods: cls.methods,
            category: 'class'
          }
        });
        entriesCreated++;
      }
    });
  }

  // API route processing
  if (knowledge.apiRoutes) {
    knowledge.apiRoutes.forEach((route, index) => {
      if (route.method && route.path) {
        knowledgeBase.push({
          id: `${filePath}-route-${index}`,
          content: `API Route: ${route.method} ${route.path}${route.handler ? ` -> ${route.handler}` : ''}`,
          type: 'api-route',
          filePath,
          keywords: extractKeywords(`${route.method} ${route.path} ${route.handler || ''}`),
          lastUpdated: new Date().toISOString(),
          metadata: {
            method: route.method,
            path: route.path,
            handler: route.handler,
            category: 'api'
          }
        });
        entriesCreated++;
      }
    });
  }

  return entriesCreated;
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
      
      // Process more files but still limit to prevent too many requests
      for (const item of contents.slice(0, 15)) {
        if (item && typeof item === 'object' && 'type' in item && 'path' in item) {
          const typedItem = item as { type: string; path: string; name?: string };
          
          if (typedItem.type === 'file' && typedItem.name) {
            // Skip very large files and binary files
            const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
            const shouldSkip = skipExtensions.some(ext => typedItem.name!.toLowerCase().endsWith(ext));
            
            if (!shouldSkip) {
              const success = await processFile(typedItem.path, knowledgeBase);
              if (success) {
                processedAny = true;
              }
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

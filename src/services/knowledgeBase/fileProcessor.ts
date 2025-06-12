
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
    console.log(`Skipping already processed file: ${filePath}`);
    return true;
  }

  try {
    console.log(`Processing file: ${filePath}`);
    
    const contents = await getRepositoryContents(filePath);
    
    // Handle file content
    if (contents && typeof contents === 'object' && 'content' in contents) {
      // Decode base64 content
      const content = atob(contents.content as string);
      console.log(`File content length: ${content.length} chars for ${filePath}`);
      
      // Skip very large files to prevent performance issues
      if (content.length > 100000) {
        console.log(`Skipping large file: ${filePath} (${content.length} chars)`);
        processedFilesCache.add(filePath);
        return true;
      }
      
      // Extract knowledge using enhanced parser
      const knowledge = extractKnowledge(content, filePath);
      console.log(`Extracted knowledge from ${filePath}:`, {
        jsDocComments: knowledge.jsDocComments?.length || 0,
        inlineComments: knowledge.inlineComments?.length || 0,
        functions: knowledge.functions?.length || 0,
        exports: Object.keys(knowledge.exports || {}).length,
        jsxTextContent: knowledge.jsxTextContent?.length || 0,
        structuredData: Object.keys(knowledge.structuredData || {}).length
      });
      
      // Create knowledge entries with better validation
      const entriesCreated = await createKnowledgeEntries(knowledge, knowledgeBase);
      
      console.log(`Created ${entriesCreated} knowledge entries from ${filePath}, total KB size: ${knowledgeBase.length}`);
      
      processedFilesCache.add(filePath);
      return entriesCreated > 0;
    } else {
      console.log(`No content found in file: ${filePath}`, contents);
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
  
  console.log(`Creating knowledge entries for ${filePath}`);
  
  // Process JSX/HTML text content
  if (knowledge.jsxTextContent && knowledge.jsxTextContent.length > 0) {
    console.log(`Found ${knowledge.jsxTextContent.length} text content items in ${filePath}`);
    
    knowledge.jsxTextContent.forEach((text, index) => {
      const cleanText = text.trim();
      if (cleanText.length > 3) { // More lenient threshold
        const entry: KnowledgeEntry = {
          id: `${filePath}-text-${index}`,
          content: cleanText,
          type: 'text-content',
          filePath,
          keywords: extractKeywords(cleanText),
          lastUpdated: new Date().toISOString(),
          metadata: {
            name: `Text content from ${filePath}`,
            contentType: 'text',
            location: `text-${index}`
          }
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added text content entry: ${cleanText.substring(0, 50)}...`);
      }
    });
  }
  
  // Process structured data with better filtering
  if (knowledge.structuredData) {
    Object.entries(knowledge.structuredData).forEach(([key, value]) => {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (valueStr.trim().length > 5) { // More lenient threshold
        const entry: KnowledgeEntry = {
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
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added structured data entry: ${key}`);
      }
    });
  }
  
  // Process comments with better filtering
  if (knowledge.jsDocComments) {
    knowledge.jsDocComments.forEach((comment, index) => {
      const cleanComment = comment.trim();
      if (cleanComment.length > 5) { // More lenient
        const entry: KnowledgeEntry = {
          id: `${filePath}-comment-${index}`,
          content: cleanComment,
          type: 'comment',
          filePath,
          keywords: extractKeywords(cleanComment),
          lastUpdated: new Date().toISOString(),
          metadata: {
            commentType: 'jsdoc'
          }
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added JSDoc comment entry`);
      }
    });
  }

  if (knowledge.inlineComments) {
    knowledge.inlineComments.forEach((comment, index) => {
      const cleanComment = comment.trim();
      if (cleanComment.length > 3) { // More lenient
        const entry: KnowledgeEntry = {
          id: `${filePath}-inline-${index}`,
          content: cleanComment,
          type: 'comment',
          filePath,
          keywords: extractKeywords(cleanComment),
          lastUpdated: new Date().toISOString(),
          metadata: {
            commentType: 'inline'
          }
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added inline comment entry`);
      }
    });
  }

  // Function processing with better content
  if (knowledge.functions) {
    knowledge.functions.forEach((func, index) => {
      if (func.name && func.name.length > 1) {
        const funcContent = `Function: ${func.name}${func.params ? `\nParameters: ${func.params}` : ''}${func.body ? `\nImplementation: ${func.body.substring(0, 300)}` : ''}`;
        
        const entry: KnowledgeEntry = {
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
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added function entry: ${func.name}`);
      }
    });
  }

  // Export processing
  if (knowledge.exports) {
    Object.entries(knowledge.exports).forEach(([key, value], index) => {
      if (key && key.length > 1) {
        const entry: KnowledgeEntry = {
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
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added export entry: ${key}`);
      }
    });
  }

  // Class processing
  if (knowledge.classes) {
    knowledge.classes.forEach((cls, index) => {
      if (cls.name && cls.name.length > 1) {
        const classContent = `Class: ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}${cls.methods.length > 0 ? `\nMethods: ${cls.methods.join(', ')}` : ''}`;
        
        const entry: KnowledgeEntry = {
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
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added class entry: ${cls.name}`);
      }
    });
  }

  // API route processing
  if (knowledge.apiRoutes) {
    knowledge.apiRoutes.forEach((route, index) => {
      if (route.method && route.path) {
        const entry: KnowledgeEntry = {
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
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`Added API route entry: ${route.method} ${route.path}`);
      }
    });
  }

  // Special handling for README and documentation files
  if (filePath.toLowerCase().includes('readme') || filePath.toLowerCase().endsWith('.md')) {
    // For markdown files, create entries from the content directly
    const content = knowledge.structuredData?.fileContent || '';
    if (content.length > 50) {
      const entry: KnowledgeEntry = {
        id: `${filePath}-content`,
        content: content.substring(0, 2000), // Limit content
        type: 'documentation',
        filePath,
        keywords: extractKeywords(content),
        lastUpdated: new Date().toISOString(),
        metadata: {
          name: `Documentation from ${filePath}`,
          contentType: 'markdown',
          category: 'documentation'
        }
      };
      knowledgeBase.push(entry);
      entriesCreated++;
      console.log(`Added documentation entry from ${filePath}`);
    }
  }

  console.log(`Total entries created for ${filePath}: ${entriesCreated}`);
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

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
    
    // Handle file content - FIXED: Better content handling
    if (contents && typeof contents === 'object') {
      let content = '';
      
      // Handle different content formats
      if ('content' in contents && contents.content) {
        try {
          // Decode base64 content properly
          const base64Content = (contents.content as string).replace(/\s/g, '');
          content = atob(base64Content);
          console.log(`Successfully decoded file: ${filePath}, length: ${content.length}`);
        } catch (decodeError) {
          console.error(`Failed to decode ${filePath}:`, decodeError);
          return false;
        }
      } else if (typeof contents === 'string') {
        content = contents;
      } else {
        console.log(`No usable content in ${filePath}:`, contents);
        return false;
      }
      
      // Skip very large files to prevent performance issues
      if (content.length > 100000) {
        console.log(`Skipping large file: ${filePath} (${content.length} chars)`);
        processedFilesCache.add(filePath);
        return true;
      }
      
      // ALWAYS create entries for files with any content
      if (content.length > 0) {
        console.log(`Creating entries for ${filePath} with ${content.length} characters`);
        
        // Extract knowledge using enhanced parser
        const knowledge = extractKnowledge(content, filePath);
        
        // Create knowledge entries - this is the critical part
        const entriesCreated = await createKnowledgeEntries(knowledge, knowledgeBase, content);
        
        console.log(`✅ Created ${entriesCreated} knowledge entries from ${filePath}, total KB size: ${knowledgeBase.length}`);
        
        processedFilesCache.add(filePath);
        return entriesCreated > 0;
      } else {
        console.log(`⚠️ Empty content in file: ${filePath}`);
        processedFilesCache.add(filePath);
        return false;
      }
    } else {
      console.log(`❌ Invalid content structure for ${filePath}:`, contents);
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
    return false;
  }
}

/**
 * Create knowledge entries from extracted content - ENHANCED VERSION
 */
async function createKnowledgeEntries(knowledge: ExtractedKnowledge, knowledgeBase: KnowledgeEntry[], rawContent: string): Promise<number> {
  const { filePath } = knowledge;
  let entriesCreated = 0;
  
  console.log(`📝 Creating knowledge entries for ${filePath} with content length ${rawContent.length}`);
  
  // ALWAYS create a main file content entry for any meaningful content
  if (rawContent.trim().length > 10) {
    const contentPreview = rawContent.substring(0, 2000); // Increased preview size
    const entry: KnowledgeEntry = {
      id: `${filePath}-content-${Date.now()}`,
      content: `File: ${filePath}\n\nContent:\n${contentPreview}${rawContent.length > 2000 ? '\n\n[Content truncated...]' : ''}`,
      type: 'text-content',
      filePath,
      keywords: extractKeywords(`${filePath} ${contentPreview}`),
      lastUpdated: new Date().toISOString(),
      metadata: {
        name: `Content from ${filePath}`,
        contentType: 'file-content',
        location: 'full-file',
        originalLength: rawContent.length
      }
    };
    knowledgeBase.push(entry);
    entriesCreated++;
    console.log(`✅ Added main content entry for ${filePath} (${rawContent.length} chars)`);
  }

  // Process JSX/HTML text content
  if (knowledge.jsxTextContent && knowledge.jsxTextContent.length > 0) {
    console.log(`📄 Found ${knowledge.jsxTextContent.length} text content items in ${filePath}`);
    
    knowledge.jsxTextContent.forEach((text, index) => {
      const cleanText = text.trim();
      if (cleanText.length > 3) {
        const entry: KnowledgeEntry = {
          id: `${filePath}-jsx-text-${index}-${Date.now()}`,
          content: `Text from ${filePath}: ${cleanText}`,
          type: 'text-content',
          filePath,
          keywords: extractKeywords(cleanText),
          lastUpdated: new Date().toISOString(),
          metadata: {
            name: `Text content from ${filePath}`,
            contentType: 'jsx-text',
            location: `text-${index}`
          }
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`✅ Added JSX text: "${cleanText.substring(0, 50)}..."`);
      }
    });
  }
  
  // Process comments with more lenient filtering
  if (knowledge.jsDocComments && knowledge.jsDocComments.length > 0) {
    knowledge.jsDocComments.forEach((comment, index) => {
      const cleanComment = comment.trim();
      if (cleanComment.length > 5) {
        const entry: KnowledgeEntry = {
          id: `${filePath}-jsdoc-${index}-${Date.now()}`,
          content: `Documentation from ${filePath}: ${cleanComment}`,
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
        console.log(`✅ Added JSDoc comment from ${filePath}`);
      }
    });
  }

  // Process inline comments
  if (knowledge.inlineComments && knowledge.inlineComments.length > 0) {
    knowledge.inlineComments.forEach((comment, index) => {
      const cleanComment = comment.trim();
      if (cleanComment.length > 3) {
        const entry: KnowledgeEntry = {
          id: `${filePath}-inline-${index}-${Date.now()}`,
          content: `Comment from ${filePath}: ${cleanComment}`,
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
        console.log(`✅ Added inline comment from ${filePath}`);
      }
    });
  }

  // Function processing
  if (knowledge.functions && knowledge.functions.length > 0) {
    knowledge.functions.forEach((func, index) => {
      if (func.name && func.name.length > 0) {
        const funcContent = `Function in ${filePath}: ${func.name}${func.params ? `\nParameters: ${func.params}` : ''}${func.body ? `\nImplementation: ${func.body.substring(0, 500)}` : ''}`;
        
        const entry: KnowledgeEntry = {
          id: `${filePath}-function-${index}-${Date.now()}`,
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
        console.log(`✅ Added function: ${func.name} from ${filePath}`);
      }
    });
  }

  // Export processing
  if (knowledge.exports && Object.keys(knowledge.exports).length > 0) {
    Object.entries(knowledge.exports).forEach(([key, value], index) => {
      if (key && key.length > 0) {
        const entry: KnowledgeEntry = {
          id: `${filePath}-export-${index}-${Date.now()}`,
          content: `Export from ${filePath}: ${key}${value !== key ? ` = ${value}` : ''}`,
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
        console.log(`✅ Added export: ${key} from ${filePath}`);
      }
    });
  }

  // Structured data processing
  if (knowledge.structuredData && Object.keys(knowledge.structuredData).length > 0) {
    Object.entries(knowledge.structuredData).forEach(([key, value], index) => {
      if (value && typeof value === 'string' && value.length > 10) {
        const entry: KnowledgeEntry = {
          id: `${filePath}-data-${index}-${Date.now()}`,
          content: `Data from ${filePath} (${key}): ${value.substring(0, 1000)}`,
          type: 'structured-data',
          filePath,
          keywords: extractKeywords(`${key} ${value}`),
          lastUpdated: new Date().toISOString(),
          metadata: {
            name: key,
            dataType: 'structured',
            category: 'data'
          }
        };
        knowledgeBase.push(entry);
        entriesCreated++;
        console.log(`✅ Added structured data: ${key} from ${filePath}`);
      }
    });
  }

  console.log(`📊 Total entries created for ${filePath}: ${entriesCreated}`);
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

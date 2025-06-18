
import { getFileContent, getRepositoryContents } from '../githubConnector';
import { extractKnowledge, ExtractedKnowledge } from '../codeParser';
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
    const knowledge: ExtractedKnowledge = extractKnowledge(content, filePath);
    
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
    
    // Add markdown content if available
    if (knowledge.markdownMetadata) {
      const metadata = knowledge.markdownMetadata;
      const contentType = filePath.includes('/posts/') || filePath.includes('/blog/') ? 'blog post' : 'page';
      
      knowledgeBase.push({
        type: 'export',
        content: `${contentType}: ${metadata.title || 'Untitled'} ${metadata.description ? '- ' + metadata.description : ''}`,
        filePath,
        metadata: { ...metadata, contentType },
        keywords: extractKeywords(`${contentType} ${metadata.title || ''} ${metadata.description || ''} ${metadata.tags?.join(' ') || ''}`),
      });
    }
    
    // Add page routing information if available
    if (knowledge.pageRouting) {
      const routing = knowledge.pageRouting;
      knowledgeBase.push({
        type: 'export',
        content: `${routing.type || 'file'}: ${routing.route || filePath} ${routing.dynamic ? '(dynamic)' : ''}`,
        filePath,
        metadata: routing,
        keywords: extractKeywords(`page route ${routing.type || ''} ${routing.route || ''} ${routing.dynamic ? 'dynamic' : ''}`),
      });
    }
    
    // Add CMS configuration if available
    if (knowledge.cmsConfig) {
      const config = knowledge.cmsConfig;
      knowledgeBase.push({
        type: 'export',
        content: `CMS: ${config.platform || 'Unknown'} with content types: ${config.contentTypes?.join(', ') || 'none'} ${config.collections ? 'collections: ' + config.collections.join(', ') : ''}`,
        filePath,
        metadata: config,
        keywords: extractKeywords(`cms ${config.platform || ''} ${config.contentTypes?.join(' ') || ''} ${config.collections?.join(' ') || ''}`),
      });
    }
    
    // Add content counts if available
    if (knowledge.contentCounts) {
      const counts = knowledge.contentCounts;
      const countContent = [];
      
      if (counts.posts) countContent.push(`${counts.posts} posts`);
      if (counts.pages) countContent.push(`${counts.pages} pages`);
      if (counts.files) countContent.push(`${counts.files} files`);
      if (counts.directories) countContent.push(`${counts.directories} directories`);
      
      if (countContent.length > 0) {
        knowledgeBase.push({
          type: 'comment',
          content: `Content count: ${countContent.join(', ')}`,
          filePath,
          metadata: counts,
          keywords: extractKeywords(`content count ${countContent.join(' ')} posts pages files`),
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
        // Process a wider range of files including markdown and config files
        const supportedExtensions = ['.js', '.ts', '.tsx', '.jsx', '.md', '.mdx', '.json', '.yml', '.yaml'];
        const hasValidExtension = supportedExtensions.some(ext => item.name.endsWith(ext));
        
        if (hasValidExtension) {
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

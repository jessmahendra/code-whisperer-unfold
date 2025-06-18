import { getFileContent, getRepositoryContents } from '../githubConnector';
import { extractKnowledge, ExtractedKnowledge } from '../codeParser';
import { KnowledgeEntry } from './types';
import { extractKeywords } from './keywordUtils';

// Cache for processed files to avoid redundant processing
const processedFilesCache: Set<string> = new Set();

/**
 * Processes a file by extracting knowledge from its content
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
    
    console.log(`Processing file: ${filePath}`);
    
    // Get file content
    const content = await getFileContent(filePath);
    
    // Skip GitHub metadata files that don't contain useful application code
    if (isGitHubMetadataFile(filePath)) {
      console.log(`Skipping GitHub metadata file: ${filePath}`);
      return;
    }
    
    // Extract knowledge
    const knowledge: ExtractedKnowledge = extractKnowledge(content, filePath);
    
    // Add meaningful content based on file type
    if (isGhostFile(filePath)) {
      await processGhostFile(filePath, content, knowledge, knowledgeBase);
    } else {
      await processGeneralFile(filePath, content, knowledge, knowledgeBase);
    }
    
    console.log(`Successfully processed file: ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

/**
 * Check if file is a GitHub metadata file that should be skipped
 */
function isGitHubMetadataFile(filePath: string): boolean {
  const githubMetadataPatterns = [
    '.github/CODE_OF_CONDUCT.md',
    '.github/CONTRIBUTING.md',
    '.github/workflows/',
    '.github/scripts/',
    'bump-version.js'
  ];
  
  return githubMetadataPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Check if file is part of Ghost application
 */
function isGhostFile(filePath: string): boolean {
  const ghostPatterns = [
    'ghost/core/',
    'ghost/admin/',
    'apps/portal/',
    'apps/admin-x-',
    'apps/signup-form/',
    'apps/comments-ui/'
  ];
  
  return ghostPatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Process Ghost-specific files with enhanced knowledge extraction
 */
async function processGhostFile(
  filePath: string,
  content: string,
  knowledge: ExtractedKnowledge,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Enhanced Ghost-specific content extraction
  
  // Add JSDoc comments with Ghost context
  for (const comment of knowledge.jsDocComments) {
    const ghostContext = extractGhostContext(comment, filePath);
    knowledgeBase.push({
      type: 'comment',
      content: `${comment}${ghostContext ? ` [${ghostContext}]` : ''}`,
      filePath,
      keywords: extractKeywords(comment + ' ' + ghostContext),
    });
  }
  
  // Add function definitions with Ghost service context
  for (const func of knowledge.functions) {
    const serviceType = determineGhostServiceType(filePath);
    const funcContent = `function ${func.name}(${func.params}) { ... }`;
    knowledgeBase.push({
      type: 'function',
      content: `Ghost ${serviceType}: ${funcContent}`,
      filePath,
      metadata: { ...func, serviceType },
      keywords: extractKeywords(funcContent + ' ' + func.name + ' ' + serviceType),
    });
  }
  
  // Process Ghost-specific patterns
  if (filePath.includes('members')) {
    await processGhostMembershipContent(content, filePath, knowledgeBase);
  }
  
  if (filePath.includes('api')) {
    await processGhostApiContent(content, filePath, knowledgeBase);
  }
  
  if (filePath.includes('admin')) {
    await processGhostAdminContent(content, filePath, knowledgeBase);
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
}

/**
 * Process general (non-Ghost) files
 */
async function processGeneralFile(
  filePath: string,
  content: string,
  knowledge: ExtractedKnowledge,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Add JSDoc comments
  for (const comment of knowledge.jsDocComments) {
    knowledgeBase.push({
      type: 'comment',
      content: comment,
      filePath,
      keywords: extractKeywords(comment),
    });
  }
  
  // Add function definitions
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
  
  // Add exports
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
}

/**
 * Extract Ghost-specific context from comments
 */
function extractGhostContext(comment: string, filePath: string): string {
  if (filePath.includes('members')) return 'Membership System';
  if (filePath.includes('subscription')) return 'Subscription Management';
  if (filePath.includes('payment')) return 'Payment Processing';
  if (filePath.includes('auth')) return 'Authentication';
  if (filePath.includes('mail')) return 'Email System';
  if (filePath.includes('admin')) return 'Admin Interface';
  if (filePath.includes('api')) return 'API Layer';
  if (filePath.includes('posts')) return 'Content Management';
  if (filePath.includes('themes')) return 'Theme System';
  return '';
}

/**
 * Determine Ghost service type based on file path
 */
function determineGhostServiceType(filePath: string): string {
  if (filePath.includes('services/members')) return 'Member Service';
  if (filePath.includes('services/auth')) return 'Auth Service';
  if (filePath.includes('services/mail')) return 'Mail Service';
  if (filePath.includes('services/themes')) return 'Theme Service';
  if (filePath.includes('api/')) return 'API Controller';
  if (filePath.includes('models/')) return 'Data Model';
  if (filePath.includes('admin/')) return 'Admin Component';
  return 'Core Service';
}

/**
 * Process Ghost membership-related content
 */
async function processGhostMembershipContent(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Extract membership-specific patterns
  const membershipPatterns = [
    /subscription.*expir/gi,
    /member.*tier/gi,
    /payment.*process/gi,
    /stripe.*integration/gi,
    /membership.*upgrade/gi,
    /free.*member/gi
  ];
  
  for (const pattern of membershipPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        const context = extractSurroundingContext(content, match);
        knowledgeBase.push({
          type: 'content',
          content: `Ghost Membership: ${context}`,
          filePath,
          keywords: extractKeywords(`membership ${match} ${context}`),
        });
      }
    }
  }
}

/**
 * Process Ghost API-related content
 */
async function processGhostApiContent(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Extract API endpoint information
  const apiPatterns = [
    /router\.(get|post|put|delete)\s*\(['"](.*?)['"],/g,
    /app\.(get|post|put|delete)\s*\(['"](.*?)['"],/g
  ];
  
  for (const pattern of apiPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, method, endpoint] = match;
      knowledgeBase.push({
        type: 'export',
        content: `Ghost API Endpoint: ${method.toUpperCase()} ${endpoint}`,
        filePath,
        metadata: { method: method.toUpperCase(), endpoint },
        keywords: extractKeywords(`api endpoint ${method} ${endpoint}`),
      });
    }
  }
}

/**
 * Process Ghost admin-related content
 */
async function processGhostAdminContent(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Extract admin component and route information
  if (content.includes('component') || content.includes('Component')) {
    const componentMatches = content.match(/export.*Component|class.*Component/g);
    if (componentMatches) {
      for (const match of componentMatches) {
        knowledgeBase.push({
          type: 'export',
          content: `Ghost Admin Component: ${match}`,
          filePath,
          keywords: extractKeywords(`admin component ${match}`),
        });
      }
    }
  }
}

/**
 * Extract surrounding context for a match
 */
function extractSurroundingContext(content: string, match: string): string {
  const index = content.indexOf(match);
  if (index === -1) return match;
  
  const start = Math.max(0, index - 100);
  const end = Math.min(content.length, index + match.length + 100);
  return content.substring(start, end).trim();
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
        const supportedExtensions = ['.js', '.ts', '.tsx', '.jsx', '.md', '.mdx', '.json', '.yml', '.yaml', '.hbs'];
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

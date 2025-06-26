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
    
    // Store the actual file content for business logic extraction
    await storeActualFileContent(filePath, content, knowledgeBase);
    
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
 * Store the actual file content for business logic extraction
 */
async function storeActualFileContent(
  filePath: string,
  content: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Only store content for files that are likely to contain business logic
  const businessLogicFilePatterns = [
    /\.(js|ts|jsx|tsx|json|yaml|yml|toml|ini|conf|config)$/i,
    /(config|settings|integration|service|api|webhook|provider|client|connector)/i
  ];
  
  const isBusinessLogicFile = businessLogicFilePatterns.some(pattern => 
    pattern.test(filePath)
  );
  
  if (isBusinessLogicFile && content.length > 50) {
    // Store the actual file content
    knowledgeBase.push({
      type: 'content',
      content: content, // Store the actual file content
      filePath,
      keywords: extractKeywords(content),
      metadata: {
        contentType: 'actual-file-content',
        fileSize: content.length,
        fileName: filePath.split('/').pop() || filePath
      }
    });
    
    console.log(`📄 Stored actual content for ${filePath} (${content.length} characters)`);
    
    // Also store a summary for easier searching
    const contentSummary = generateContentSummary(content, filePath);
    if (contentSummary) {
      knowledgeBase.push({
        type: 'content',
        content: contentSummary,
        filePath,
        keywords: extractKeywords(contentSummary),
        metadata: {
          contentType: 'content-summary',
          originalContentLength: content.length
        }
      });
    }
  }
}

/**
 * Generate a summary of file content for easier searching
 */
function generateContentSummary(content: string, filePath: string): string | null {
  const fileName = filePath.split('/').pop() || filePath;
  const lowerContent = content.toLowerCase();
  
  // Extract key information based on file type
  if (fileName.includes('integration') || fileName.includes('service')) {
    // Look for service definitions and configurations
    const serviceMatches = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*\{/g);
    const importMatches = content.match(/import.*from.*['"]([^'"]+)['"]/g);
    const configMatches = content.match(/(\w+)\s*[:=]\s*['"][^'"]+['"]/g);
    
    const summary = [];
    if (serviceMatches) summary.push(`Services: ${serviceMatches.length} defined`);
    if (importMatches) summary.push(`Imports: ${importMatches.length} external packages`);
    if (configMatches) summary.push(`Configs: ${configMatches.length} configuration items`);
    
    if (summary.length > 0) {
      return `Integration File Summary: ${summary.join(', ')}`;
    }
  }
  
  if (fileName.includes('config') || fileName.includes('settings')) {
    // Look for configuration objects
    const configMatches = content.match(/(\w+)\s*[:=]\s*['"][^'"]+['"]/g);
    const objectMatches = content.match(/(\w+)\s*[:=]\s*\{/g);
    
    const summary = [];
    if (configMatches) summary.push(`Settings: ${configMatches.length} configuration values`);
    if (objectMatches) summary.push(`Objects: ${objectMatches.length} configuration objects`);
    
    if (summary.length > 0) {
      return `Configuration File Summary: ${summary.join(', ')}`;
    }
  }
  
  if (fileName.includes('api') || fileName.includes('endpoint')) {
    // Look for API endpoints and routes
    const routeMatches = content.match(/(?:router\.|app\.)(get|post|put|delete|patch)\s*\(/g);
    const endpointMatches = content.match(/['"]([^'"]*\/[^'"]*)['"]/g);
    
    const summary = [];
    if (routeMatches) summary.push(`Routes: ${routeMatches.length} API routes`);
    if (endpointMatches) summary.push(`Endpoints: ${endpointMatches.length} endpoints defined`);
    
    if (summary.length > 0) {
      return `API File Summary: ${summary.join(', ')}`;
    }
  }
  
  // Generic summary for other files
  const lines = content.split('\n').length;
  const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
  const classes = (content.match(/class\s+\w+/g) || []).length;
  
  const summary = [];
  if (lines > 0) summary.push(`${lines} lines`);
  if (functions > 0) summary.push(`${functions} functions`);
  if (classes > 0) summary.push(`${classes} classes`);
  
  if (summary.length > 0) {
    return `File Summary: ${summary.join(', ')}`;
  }
  
  return null;
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
  
  // Extract JSX content for React components (highest priority for Portal Settings)
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    await extractJSXContent(content, filePath, knowledgeBase);
  }
  
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
    const ghostContext = extractGhostContext(func.name, filePath);
    knowledgeBase.push({
      type: 'export',
      content: `Ghost Function: ${func.name}${ghostContext ? ` [${ghostContext}]` : ''}`,
      filePath,
      metadata: func,
      keywords: extractKeywords(`${func.name} ${func.params} ${ghostContext}`),
    });
  }
  
  // Enhanced UI pattern extraction
  await extractUIPatterns(content, filePath, knowledgeBase);
  
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
    for (const cls of knowledge.classes) {
      const ghostContext = extractGhostContext(cls.name, filePath);
      knowledgeBase.push({
        type: 'export',
        content: `Ghost Class: ${cls.name}${ghostContext ? ` [${ghostContext}]` : ''}`,
        filePath,
        metadata: cls,
        keywords: extractKeywords(`class ${cls.name} ${cls.methods.join(' ')} ${ghostContext}`),
      });
    }
  }
  
  // Add markdown content if available
  if (knowledge.markdownMetadata) {
    const metadata = knowledge.markdownMetadata;
    knowledgeBase.push({
      type: 'content',
      content: `Documentation: ${metadata.title || 'Untitled'} - ${metadata.description || ''}`,
      filePath,
      keywords: extractKeywords(`${metadata.title || ''} ${metadata.description || ''}`),
    });
  }
  
  // Add page routing if available
  if (knowledge.pageRouting) {
    const routing = knowledge.pageRouting;
    knowledgeBase.push({
      type: 'export',
      content: `Page Route: ${routing.route || filePath} => ${routing.type || 'page'}`,
      filePath,
      metadata: routing,
      keywords: extractKeywords(`page route ${routing.route || ''} ${routing.type || ''}`),
    });
  }
  
  // Add CMS configuration if available
  if (knowledge.cmsConfig) {
    const config = knowledge.cmsConfig;
    knowledgeBase.push({
      type: 'export',
      content: `CMS Config: ${config.platform || 'Unknown'} with content types: ${config.contentTypes?.join(', ') || 'none'}`,
      filePath,
      metadata: config,
      keywords: extractKeywords(`cms config ${config.platform || ''} ${config.contentTypes?.join(' ') || ''}`),
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
        type: 'export',
        content: `Content Count: ${countContent.join(', ')}`,
        filePath,
        metadata: counts,
        keywords: extractKeywords(`content count ${countContent.join(' ')}`),
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

/**
 * Process Ghost UI components for Portal Settings and Membership
 */
async function processGhostUIComponents(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Extract React component definitions
  const componentMatches = content.match(/export\s+(?:default\s+)?(?:function|const)\s+(\w+)(?:Component|Page|Settings)?/g);
  if (componentMatches) {
    for (const match of componentMatches) {
      const componentName = match.match(/(\w+)(?:Component|Page|Settings)?/)?.[1];
      if (componentName) {
        knowledgeBase.push({
          type: 'export',
          content: `Ghost UI Component: ${componentName} - ${filePath.includes('admin-x-settings') ? 'Portal Settings' : 'Membership'}`,
          filePath,
          metadata: { componentName, type: 'ui-component' },
          keywords: extractKeywords(`component ${componentName} portal settings membership ui`),
        });
      }
    }
  }
  
  // Extract JSX patterns for UI elements
  const jsxPatterns = [
    /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g,  // Headings
    /<title[^>]*>([^<]+)<\/title>/g,   // Titles
    /<label[^>]*>([^<]+)<\/label>/g,   // Labels
    /placeholder\s*=\s*["']([^"']+)["']/g, // Placeholders
    /aria-label\s*=\s*["']([^"']+)["']/g   // ARIA labels
  ];
  
  jsxPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const textContent = match.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
        if (textContent.length > 3) {
          knowledgeBase.push({
            type: 'content',
            content: `UI Element: ${textContent}`,
            filePath,
            metadata: { uiElement: textContent, pattern: pattern.source },
            keywords: extractKeywords(`ui element ${textContent} portal settings membership`),
          });
        }
      });
    }
  });
}

/**
 * Extract UI patterns from file content
 */
async function extractUIPatterns(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  // Look for subtitle-related patterns
  const subtitlePatterns = [
    /subtitle\s*[:=]\s*["']([^"']+)["']/g,
    /className\s*=\s*["'][^"']*subtitle[^"']*["']/g,
    /<h[1-6][^>]*>([^<]*subtitle[^<]*)<\/h[1-6]>/gi
  ];
  
  subtitlePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      knowledgeBase.push({
        type: 'content',
        content: `Subtitle Pattern: ${matches[0]}`,
        filePath,
        metadata: { pattern: 'subtitle', matches: matches.length },
        keywords: extractKeywords('subtitle subheading description label'),
      });
    }
  });
  
  // Look for Portal Settings patterns
  if (content.toLowerCase().includes('portal settings')) {
    knowledgeBase.push({
      type: 'content',
      content: 'Portal Settings Configuration',
      filePath,
      metadata: { pattern: 'portal-settings' },
      keywords: extractKeywords('portal settings configuration admin'),
    });
  }
  
  // Look for Membership patterns
  if (content.toLowerCase().includes('membership')) {
    knowledgeBase.push({
      type: 'content',
      content: 'Membership System Configuration',
      filePath,
      metadata: { pattern: 'membership' },
      keywords: extractKeywords('membership member subscription portal'),
    });
  }
}

/**
 * Enhanced JSX content extraction for complete text content
 */
async function extractJSXContent(
  content: string,
  filePath: string,
  knowledgeBase: KnowledgeEntry[]
): Promise<void> {
  console.log(`🎭 Extracting enhanced JSX content from ${filePath}`);
  
  // Extract complete text blocks
  const textBlocks = extractCompleteTextContent(content, filePath);
  
  // Add each text block as a separate knowledge entry
  textBlocks.forEach((text, index) => {
    if (text.length > 5) { // Only add meaningful text blocks
      knowledgeBase.push({
        type: 'content',
        content: `Text Content: ${text}`,
        filePath,
        keywords: extractKeywords(text),
        metadata: {
          textType: 'jsx-content',
          textIndex: index,
          originalText: text
        }
      });
      
      console.log(`📝 Added text block ${index + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }
  });
  
  // Extract component props and descriptions
  const propMatches = content.match(/(\w+)="([^"]{10,})"/g);
  if (propMatches) {
    propMatches.forEach((match, index) => {
      const [propName, propValue] = match.split('=');
      const value = propValue.replace(/"/g, '').trim();
      
      if (value.length > 10 && !value.includes('http') && !value.includes('className')) {
        knowledgeBase.push({
          type: 'content',
          content: `Component Prop: ${propName}="${value}"`,
          filePath,
          keywords: extractKeywords(`${propName} ${value}`),
          metadata: {
            textType: 'component-prop',
            propName: propName,
            propValue: value
          }
        });
      }
    });
  }
  
  // Extract string literals that look like descriptions
  const stringMatches = content.match(/"([^"]{15,})"/g);
  if (stringMatches) {
    stringMatches.forEach((match, index) => {
      const text = match.replace(/"/g, '').trim();
      
      // Filter out URLs, class names, and other non-descriptive strings
      if (text.length > 15 && 
          !text.includes('http') && 
          !text.includes('className') && 
          !text.includes('import') &&
          !text.includes('export') &&
          text.includes(' ')) { // Must contain spaces to be descriptive
        
        knowledgeBase.push({
          type: 'content',
          content: `String Literal: ${text}`,
          filePath,
          keywords: extractKeywords(text),
          metadata: {
            textType: 'string-literal',
            originalText: text
          }
        });
        
        console.log(`💬 Added string literal: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      }
    });
  }
  
  // Extract template literals
  const templateMatches = content.match(/`([^`]{15,})`/g);
  if (templateMatches) {
    templateMatches.forEach((match, index) => {
      const text = match.replace(/`/g, '').trim();
      
      if (text.length > 15 && !text.includes('${')) {
        knowledgeBase.push({
          type: 'content',
          content: `Template Literal: ${text}`,
          filePath,
          keywords: extractKeywords(text),
          metadata: {
            textType: 'template-literal',
            originalText: text
          }
        });
      }
    });
  }
  
  // Extract comments that might contain descriptions
  const commentMatches = content.match(/\/\*([^*]+)\*\//g);
  if (commentMatches) {
    commentMatches.forEach((match, index) => {
      const text = match.replace(/\/\*|\*\//g, '').trim();
      
      if (text.length > 10) {
        knowledgeBase.push({
          type: 'content',
          content: `Comment: ${text}`,
          filePath,
          keywords: extractKeywords(text),
          metadata: {
            textType: 'comment',
            originalText: text
          }
        });
      }
    });
  }
  
  console.log(`✅ Enhanced JSX extraction complete for ${filePath}: ${textBlocks.length} text blocks, ${propMatches?.length || 0} props, ${stringMatches?.length || 0} strings`);
}

/**
 * Extract complete text content from JSX/TSX files
 */
function extractCompleteTextContent(content: string, filePath: string): string[] {
  const textBlocks: string[] = [];
  
  // Extract JSX text content (text between tags)
  const jsxTextMatches = content.match(/>([^<>{}\n]+)</g);
  if (jsxTextMatches) {
    jsxTextMatches.forEach(match => {
      const text = match.replace(/[<>]/g, '').trim();
      if (text.length > 3 && !text.match(/^[a-z]+$/)) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract string literals that look like descriptions
  const stringLiteralMatches = content.match(/"([^"]{10,})"/g);
  if (stringLiteralMatches) {
    stringLiteralMatches.forEach(match => {
      const text = match.replace(/"/g, '').trim();
      if (text.length > 10 && !text.includes('http') && !text.includes('className')) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract template literals
  const templateLiteralMatches = content.match(/`([^`]{10,})`/g);
  if (templateLiteralMatches) {
    templateLiteralMatches.forEach(match => {
      const text = match.replace(/`/g, '').trim();
      if (text.length > 10 && !text.includes('${')) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract comments that might contain descriptions
  const commentMatches = content.match(/\/\*([^*]+)\*\//g);
  if (commentMatches) {
    commentMatches.forEach(match => {
      const text = match.replace(/\/\*|\*\//g, '').trim();
      if (text.length > 10) {
        textBlocks.push(text);
      }
    });
  }
  
  // Extract JSX attributes that might contain descriptions
  const jsxAttributeMatches = content.match(/(title="([^"]+)"|alt="([^"]+)"|aria-label="([^"]+)")/g);
  if (jsxAttributeMatches) {
    jsxAttributeMatches.forEach(match => {
      const text = match.replace(/title="|alt="|aria-label="|"/g, '').trim();
      if (text.length > 5) {
        textBlocks.push(text);
      }
    });
  }
  
  return [...new Set(textBlocks)]; // Remove duplicates
}

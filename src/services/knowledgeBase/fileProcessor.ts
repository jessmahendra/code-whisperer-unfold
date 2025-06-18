
import { getFileContent, getRepositoryContents } from '../githubConnector';
import { extractKnowledge, ExtractedKnowledge } from '../codeParser';
import { KnowledgeEntry } from './types';
import { extractKeywords } from './keywordUtils';

// Cache for processed files to avoid redundant processing
const processedFilesCache: Set<string> = new Set();

/**
 * Enhanced Ghost-specific content processor
 */
function processGhostSpecificContent(content: string, filePath: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Detect Ghost membership/business logic files
  const isMembershipRelated = ['member', 'subscription', 'stripe', 'payment', 'pricing', 'plan', 'tier'].some(term => 
    lowerPath.includes(term) || lowerContent.includes(term)
  );
  
  if (isMembershipRelated) {
    console.log(`🎯 Processing Ghost membership-related file: ${filePath}`);
    
    // Extract larger chunks of membership content
    const chunks = splitContentIntoChunks(content, 1500);
    chunks.forEach((chunk, index) => {
      entries.push({
        type: 'content',
        content: chunk,
        filePath: `${filePath}#chunk-${index}`,
        keywords: extractKeywords(`ghost membership ${chunk.substring(0, 300)}`),
        metadata: {
          isGhostMembership: true,
          priority: 'high',
          fileType: getFileType(filePath),
          chunkIndex: index
        }
      });
    });
  }
  
  // Detect Ghost admin interface files
  const isAdminRelated = lowerPath.includes('admin') || lowerPath.includes('controller') || lowerPath.includes('component');
  if (isAdminRelated) {
    console.log(`🎛️ Processing Ghost admin interface file: ${filePath}`);
    
    entries.push({
      type: 'content',
      content: content.substring(0, 2000),
      filePath,
      keywords: extractKeywords(`ghost admin interface ${content.substring(0, 400)}`),
      metadata: {
        isGhostAdmin: true,
        priority: 'medium',
        fileType: getFileType(filePath)
      }
    });
  }
  
  // Detect Ghost API files
  const isApiRelated = lowerPath.includes('api') || lowerPath.includes('endpoint') || lowerPath.includes('route');
  if (isApiRelated) {
    console.log(`🔗 Processing Ghost API file: ${filePath}`);
    
    entries.push({
      type: 'content',
      content: content.substring(0, 1500),
      filePath,
      keywords: extractKeywords(`ghost api endpoint ${content.substring(0, 300)}`),
      metadata: {
        isGhostApi: true,
        priority: 'medium',
        fileType: getFileType(filePath)
      }
    });
  }
  
  return entries;
}

/**
 * Enhanced README content processor
 */
function processReadmeContent(content: string, filePath: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  // Split README into sections by headers
  const sections = content.split(/^#+\s+/m).filter(section => section.trim());
  
  // Add full README as primary entry with more content
  entries.push({
    type: 'content',
    content: content.substring(0, 3000), // Increased content size
    filePath,
    keywords: extractKeywords(`readme documentation overview ${content.substring(0, 800)}`),
    metadata: { 
      isReadme: true, 
      priority: 'high',
      fileType: 'documentation',
      sections: sections.length,
      fullContent: true
    }
  });
  
  // Process each section separately for better searchability
  sections.forEach((section, index) => {
    if (section.trim().length > 100) { // Lowered threshold for more sections
      const sectionTitle = section.split('\n')[0].trim();
      entries.push({
        type: 'content',
        content: section.substring(0, 1200), // Increased section content
        filePath: `${filePath}#section-${index}`,
        keywords: extractKeywords(`readme ${sectionTitle} ${section.substring(0, 300)}`),
        metadata: {
          isReadmeSection: true,
          sectionTitle,
          sectionIndex: index,
          priority: 'medium'
        }
      });
    }
  });
  
  console.log(`📖 Enhanced README processing: ${entries.length} entries from ${filePath}`);
  return entries;
}

/**
 * Enhanced JavaScript/TypeScript content processor
 */
function processCodeContent(content: string, filePath: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  // Extract comments and documentation
  const comments = extractCommentsFromCode(content);
  comments.forEach((comment, index) => {
    if (comment.length > 50) {
      entries.push({
        type: 'comment',
        content: comment,
        filePath: `${filePath}#comment-${index}`,
        keywords: extractKeywords(comment),
        metadata: {
          isCodeComment: true,
          priority: 'low',
          fileType: getFileType(filePath)
        }
      });
    }
  });
  
  // Extract function/class definitions with context
  const definitions = extractDefinitionsFromCode(content);
  definitions.forEach((def, index) => {
    entries.push({
      type: 'function',
      content: def,
      filePath: `${filePath}#def-${index}`,
      keywords: extractKeywords(def),
      metadata: {
        isCodeDefinition: true,
        priority: 'medium',
        fileType: getFileType(filePath)
      }
    });
  });
  
  return entries;
}

/**
 * Enhanced Handlebars template processor for Ghost themes
 */
function processHandlebarsContent(content: string, filePath: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  // Extract template content and helpers
  entries.push({
    type: 'content',
    content: content.substring(0, 1000),
    filePath,
    keywords: extractKeywords(`ghost theme template handlebars ${content.substring(0, 200)}`),
    metadata: {
      isGhostTemplate: true,
      priority: 'low',
      fileType: 'handlebars'
    }
  });
  
  // Extract Ghost-specific helpers and features
  const ghostHelpers = extractGhostHelpers(content);
  ghostHelpers.forEach((helper, index) => {
    entries.push({
      type: 'function',
      content: helper,
      filePath: `${filePath}#helper-${index}`,
      keywords: extractKeywords(`ghost helper ${helper}`),
      metadata: {
        isGhostHelper: true,
        priority: 'medium',
        fileType: 'handlebars'
      }
    });
  });
  
  return entries;
}

/**
 * Enhanced JSON configuration processor
 */
function processJsonContent(content: string, filePath: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  
  try {
    const jsonData = JSON.parse(content);
    
    // Special handling for package.json
    if (filePath.endsWith('package.json')) {
      const packageInfo = `Package: ${jsonData.name || 'Unknown'} v${jsonData.version || '0.0.0'}\nDescription: ${jsonData.description || 'No description'}\nDependencies: ${Object.keys(jsonData.dependencies || {}).join(', ')}`;
      
      entries.push({
        type: 'content',
        content: packageInfo,
        filePath,
        keywords: extractKeywords(`package json dependencies ${jsonData.name || ''} ${jsonData.description || ''}`),
        metadata: {
          isPackageJson: true,
          priority: 'medium',
          fileType: 'json'
        }
      });
    } else {
      // Generic JSON processing
      entries.push({
        type: 'content',
        content: JSON.stringify(jsonData, null, 2).substring(0, 1500),
        filePath,
        keywords: extractKeywords(`configuration json ${Object.keys(jsonData).join(' ')}`),
        metadata: {
          isConfig: true,
          priority: 'low',
          fileType: 'json'
        }
      });
    }
  } catch (error) {
    // Invalid JSON, treat as text
    entries.push({
      type: 'content',
      content: content.substring(0, 1000),
      filePath,
      keywords: extractKeywords(content.substring(0, 200)),
      metadata: {
        priority: 'low',
        fileType: 'text'
      }
    });
  }
  
  return entries;
}

/**
 * Split content into meaningful chunks
 */
function splitContentIntoChunks(content: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = content.split(/\n\s*\n/);
  
  let currentChunk = '';
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Extract comments from code
 */
function extractCommentsFromCode(content: string): string[] {
  const comments: string[] = [];
  
  // Single line comments
  const singleLineComments = content.match(/\/\/.*$/gm) || [];
  comments.push(...singleLineComments.map(c => c.replace('//', '').trim()));
  
  // Multi-line comments
  const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
  comments.push(...multiLineComments.map(c => c.replace(/\/\*|\*\//g, '').trim()));
  
  // JSDoc comments
  const jsDocComments = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
  comments.push(...jsDocComments.map(c => c.replace(/\/\*\*|\*\//g, '').trim()));
  
  return comments.filter(c => c.length > 10);
}

/**
 * Extract function and class definitions from code
 */
function extractDefinitionsFromCode(content: string): string[] {
  const definitions: string[] = [];
  
  // Function definitions
  const functions = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?(?:function|\()|class\s+\w+)[\s\S]*?(?=\n\s*(?:function|const|class|export|$))/g) || [];
  definitions.push(...functions.map(f => f.substring(0, 500)));
  
  // Export statements
  const exports = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+[\s\S]*?(?=\n|$)/g) || [];
  definitions.push(...exports.map(e => e.substring(0, 300)));
  
  return definitions.filter(d => d.trim().length > 20);
}

/**
 * Extract Ghost-specific helpers from Handlebars templates
 */
function extractGhostHelpers(content: string): string[] {
  const helpers: string[] = [];
  
  // Ghost helper patterns
  const helperPatterns = [
    /\{\{#[^}]+\}\}/g, // Block helpers
    /\{\{[^#/][^}]+\}\}/g, // Regular helpers
    /\{\{![^}]+\}\}/g // Comments
  ];
  
  helperPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    helpers.push(...matches);
  });
  
  return helpers.filter(h => h.length > 3);
}

/**
 * Get file type from path
 */
function getFileType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  
  const typeMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'md': 'markdown',
    'hbs': 'handlebars',
    'handlebars': 'handlebars',
    'json': 'json',
    'yml': 'yaml',
    'yaml': 'yaml',
    'css': 'css',
    'scss': 'scss',
    'html': 'html'
  };
  
  return typeMap[extension] || 'text';
}

/**
 * Enhanced file processing with Ghost-specific optimizations
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
    
    console.log(`🔍 Processing file: ${filePath}`);
    
    // Get file content
    const content = await getFileContent(filePath);
    
    if (!content || content.trim().length === 0) {
      console.log(`⚠️ Empty file skipped: ${filePath}`);
      return;
    }
    
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';
    const fileExtension = fileName.split('.').pop() || '';
    
    let entries: KnowledgeEntry[] = [];
    
    // Route to appropriate processor based on file type and content
    if (fileName === 'readme.md' || fileName === 'readme.txt' || fileName === 'readme') {
      entries = processReadmeContent(content, filePath);
    } else if (filePath.toLowerCase().includes('ghost') || content.toLowerCase().includes('ghost')) {
      entries = processGhostSpecificContent(content, filePath);
      
      // Also apply standard processing for code files
      if (['js', 'ts', 'tsx', 'jsx'].includes(fileExtension)) {
        entries.push(...processCodeContent(content, filePath));
      }
    } else if (['js', 'ts', 'tsx', 'jsx'].includes(fileExtension)) {
      entries = processCodeContent(content, filePath);
    } else if (['hbs', 'handlebars'].includes(fileExtension)) {
      entries = processHandlebarsContent(content, filePath);
    } else if (fileExtension === 'json') {
      entries = processJsonContent(content, filePath);
    } else if (['md', 'mdx'].includes(fileExtension)) {
      entries = processReadmeContent(content, filePath); // Use enhanced markdown processing
    } else {
      // Fallback: generic content processing
      entries.push({
        type: 'content',
        content: content.substring(0, 1500),
        filePath,
        keywords: extractKeywords(content.substring(0, 300)),
        metadata: {
          priority: 'low',
          fileType: getFileType(filePath)
        }
      });
    }
    
    // Add all entries to knowledge base
    if (entries.length > 0) {
      knowledgeBase.push(...entries);
      console.log(`✅ Processed ${filePath}: ${entries.length} entries added`);
    } else {
      console.log(`⚠️ No entries extracted from ${filePath}`);
    }
    
    // Also run standard knowledge extraction for additional insights
    try {
      const knowledge: ExtractedKnowledge = extractKnowledge(content, filePath);
      
      // Add standard extraction results
      if (knowledge.jsDocComments?.length > 0) {
        knowledge.jsDocComments.forEach((comment, index) => {
          knowledgeBase.push({
            type: 'comment',
            content: comment,
            filePath: `${filePath}#jsdoc-${index}`,
            keywords: extractKeywords(comment),
            metadata: { isJSDoc: true, priority: 'medium' }
          });
        });
      }
      
      if (knowledge.functions?.length > 0) {
        knowledge.functions.forEach((func, index) => {
          const funcContent = `function ${func.name}(${func.params}) { ... }`;
          knowledgeBase.push({
            type: 'function',
            content: funcContent,
            filePath: `${filePath}#func-${index}`,
            metadata: func,
            keywords: extractKeywords(funcContent + ' ' + func.name),
          });
        });
      }
    } catch (standardError) {
      // Standard extraction failed, but that's okay - we have our enhanced extraction
      console.log(`ℹ️ Standard extraction failed for ${filePath}, using enhanced extraction only`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
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
    const contents = await getRepositoryContents(modulePath);
    
    for (const item of contents) {
      if (item.type === 'file') {
        const supportedExtensions = ['.js', '.ts', '.tsx', '.jsx', '.md', '.mdx', '.json', '.yml', '.yaml', '.hbs', '.handlebars'];
        const hasValidExtension = supportedExtensions.some(ext => item.name.endsWith(ext));
        
        if (hasValidExtension) {
          await processFile(item.path, knowledgeBase);
        }
      } else if (item.type === 'dir') {
        const depth = modulePath.split('/').length;
        if (depth < 8) {
          await processModule(item.path, knowledgeBase);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
    throw error;
  }
}

export function clearProcessedFilesCache(): void {
  processedFilesCache.clear();
}

export function getProcessedFileCount(): number {
  return processedFilesCache.size;
}

import { searchKnowledgeWithHistory } from "./knowledgeBaseEnhanced";
import { getLastUpdatedText } from "./knowledgeBaseEnhanced";
import { generateVisualContext } from "./visualContextGenerator";
import { hasAICapabilities, generateAnswerWithAI } from "./aiAnalysis";
import { screenshotService, Screenshot } from "./screenshotService";
import { getCurrentRepository } from "./githubConnector";
import { isUsingMockData, getEnhancedDiagnostics } from "./knowledgeBase";
import { toast } from "sonner";

interface Reference {
  filePath: string;
  lineNumbers?: string;
  snippet?: string;
  lastUpdated?: string;
}

interface Answer {
  text: string;
  confidence: number;
  references: Reference[];
  screenshots?: Screenshot[];
  visualContext?: {
    type: 'flowchart' | 'component' | 'state';
    syntax: string;
  };
}

/**
 * Enhanced query analysis for better answer targeting
 */
function analyzeQuery(query: string): {
  type: 'how-to' | 'what-is' | 'where-is' | 'code-search' | 'content-count' | 'general';
  keywords: string[];
  needsScreenshots: boolean;
  needsCode: boolean;
  isContentQuery: boolean;
} {
  const lowerQuery = query.toLowerCase();
  
  // Determine query type
  let type: 'how-to' | 'what-is' | 'where-is' | 'code-search' | 'content-count' | 'general' = 'general';
  
  if (lowerQuery.includes('how to') || lowerQuery.startsWith('how do') || lowerQuery.startsWith('how can')) {
    type = 'how-to';
  } else if (lowerQuery.startsWith('what is') || lowerQuery.startsWith('what are')) {
    type = 'what-is';
  } else if (lowerQuery.includes('where') || lowerQuery.includes('find') || lowerQuery.includes('locate')) {
    type = 'where-is';
  } else if (lowerQuery.includes('function') || lowerQuery.includes('component') || lowerQuery.includes('class')) {
    type = 'code-search';
  } else if (lowerQuery.includes('how many') || lowerQuery.includes('count') || 
             lowerQuery.includes('number of') || lowerQuery.includes('total')) {
    type = 'content-count';
  }
  
  // Extract keywords
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['how', 'what', 'where', 'the', 'and', 'for', 'with', 'many', 'are', 'there'].includes(word));
  
  // Determine if it's a content-related query
  const contentKeywords = [
    'post', 'posts', 'blog', 'page', 'pages', 'article', 'articles', 
    'content', 'site', 'website', 'count', 'number', 'total'
  ];
  const isContentQuery = contentKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // Determine if screenshots needed
  const screenshotKeywords = [
    'navigate', 'click', 'button', 'settings', 'configure', 'setup',
    'dashboard', 'interface', 'ui', 'menu', 'panel', 'theme'
  ];
  const needsScreenshots = screenshotKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // Determine if code examples needed
  const needsCode = lowerQuery.includes('code') || lowerQuery.includes('implement') || 
                   lowerQuery.includes('function') || lowerQuery.includes('component');
  
  return { type, keywords, needsScreenshots, needsCode, isContentQuery };
}

/**
 * Extracts content counts from knowledge base entries
 */
function extractContentCounts(results: any[]): {
  posts: number;
  pages: number;
  files: number;
  totalContent: number;
} {
  let posts = 0;
  let pages = 0;
  let files = 0;
  
  results.forEach(result => {
    // Check metadata for content counts
    if (result.metadata) {
      if (result.metadata.posts) posts += result.metadata.posts;
      if (result.metadata.pages) pages += result.metadata.pages;
      if (result.metadata.files) files += result.metadata.files;
      
      // Check content type
      if (result.metadata.contentType === 'blog post') posts++;
      if (result.metadata.contentType === 'page') pages++;
    }
    
    // Check content for count patterns
    const countMatches = result.content.match(/(\d+)\s+(posts?|pages?|articles?|files?)/gi);
    if (countMatches) {
      countMatches.forEach(match => {
        const number = parseInt(match.match(/\d+/)[0]);
        if (match.toLowerCase().includes('post')) posts += number;
        if (match.toLowerCase().includes('page')) pages += number;
        if (match.toLowerCase().includes('file')) files += number;
      });
    }
    
    // Count markdown files by file path
    if (result.filePath.endsWith('.md') || result.filePath.endsWith('.mdx')) {
      if (result.filePath.includes('/posts/') || result.filePath.includes('/blog/')) {
        posts++;
      } else if (result.filePath.includes('/pages/')) {
        pages++;
      } else {
        files++;
      }
    }
    
    // Count page routes
    if (result.metadata?.type === 'page' && result.metadata?.route) {
      pages++;
    }
  });
  
  return {
    posts,
    pages,
    files,
    totalContent: posts + pages + files
  };
}

/**
 * Determines if a query would benefit from screenshots
 */
function shouldIncludeScreenshots(query: string): boolean {
  const screenshotKeywords = [
    'how to', 'how do', 'how can', 'where to', 'where is',
    'navigate', 'click', 'button', 'settings', 'configure',
    'setup', 'install', 'access', 'find', 'locate',
    'dashboard', 'interface', 'ui', 'menu', 'panel',
    'dark mode', 'theme', 'appearance', 'design'
  ];
  
  const lowerQuery = query.toLowerCase();
  return screenshotKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Determines the likely URL for the connected repository's running application
 */
function getRepositoryAppUrl(): string | null {
  const currentRepo = getCurrentRepository();
  if (!currentRepo) return null;
  
  const commonPatterns = [
    `https://${currentRepo.repo}.herokuapp.com`,
    `https://${currentRepo.repo}.vercel.app`,
    `https://${currentRepo.repo}.netlify.app`,
    `https://${currentRepo.owner}.github.io/${currentRepo.repo}`,
    `https://${currentRepo.repo}.com`,
    `http://localhost:2368`,
    `http://localhost:3000`,
  ];
  
  if (currentRepo.repo.toLowerCase().includes('ghost')) {
    return `http://localhost:2368`;
  }
  
  return commonPatterns[0];
}

/**
 * Generates relevant screenshots based on the query content
 */
async function generateRelevantScreenshots(query: string): Promise<Screenshot[]> {
  const screenshots: Screenshot[] = [];
  const lowerQuery = query.toLowerCase();
  const appUrl = getRepositoryAppUrl();
  
  if (!appUrl) {
    console.warn('No repository app URL available for screenshots');
    return screenshots;
  }
  
  try {
    if (lowerQuery.includes('ghost')) {
      console.log('Capturing Ghost admin interface screenshots');
      
      const ghostPaths = ['/ghost', '/admin', '/ghost/admin'];
      
      for (const path of ghostPaths) {
        try {
          const ghostScreenshots = await screenshotService.captureGhostAdminFlow(appUrl, path);
          if (ghostScreenshots.length > 0) {
            screenshots.push(...ghostScreenshots);
            break;
          }
        } catch (error) {
          if (error.message.includes('cross-origin') || error.message.includes('Cross-origin')) {
            console.warn('Screenshots unavailable due to browser security restrictions');
            toast.error('Screenshots unavailable: Browser security prevents capturing from external applications. Try accessing your Ghost admin directly.');
            break;
          }
          console.warn(`Failed to capture Ghost admin at path ${path}:`, error);
        }
      }
    }
    
    if (lowerQuery.includes('settings') || lowerQuery.includes('configure')) {
      if (screenshots.length === 0) {
        const settingsScreenshots = await screenshotService.captureRepositorySettings();
        screenshots.push(...settingsScreenshots);
      }
    }
    
    if (lowerQuery.includes('navigate') || lowerQuery.includes('find') || lowerQuery.includes('where')) {
      if (screenshots.length === 0) {
        const navScreenshots = await screenshotService.captureQuestionInput();
        screenshots.push(...navScreenshots);
      }
    }
    
  } catch (error) {
    console.warn('Failed to generate screenshots:', error);
    if (error.message.includes('cross-origin') || error.message.includes('Cross-origin')) {
      toast.error('Screenshots unavailable: Browser security prevents capturing from external applications');
    } else {
      toast.error('Could not capture screenshots from the application');
    }
  }
  
  return screenshots;
}

/**
 * Generates an answer based on a user question
 * @param {string} query - User question
 * @param {Object} [options] - Options for generating the answer
 * @param {boolean} [options.concise] - Whether to generate a concise answer
 * @param {boolean} [options.skipBenefits] - Whether to skip benefits sections
 * @returns {Promise<Answer|null>} Generated answer or null if no answer could be generated
 */
export async function generateAnswer(query: string, options?: { 
  concise?: boolean, 
  skipBenefits?: boolean 
}): Promise<Answer | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  try {
    // Enhanced query analysis
    const queryAnalysis = analyzeQuery(query);
    console.log('Query analysis:', queryAnalysis);
    
    // Get enhanced diagnostics
    const diagnostics = getEnhancedDiagnostics();
    console.log('Knowledge base diagnostics:', {
      size: diagnostics.knowledgeBaseSize,
      usingMock: diagnostics.usingMockData,
      scannedFiles: diagnostics.lastScanDiagnostics.scannedFiles.length
    });
    
    // Enhanced search for content queries
    let searchQuery = query;
    if (queryAnalysis.isContentQuery) {
      // Add content-specific keywords to improve search
      searchQuery = [query, ...queryAnalysis.keywords, 'content', 'page', 'post', 'count'].join(' ');
    } else {
      searchQuery = [query, ...queryAnalysis.keywords].join(' ');
    }
    
    const results = await searchKnowledgeWithHistory(searchQuery);
    
    console.log(`Enhanced search results: ${results.length} entries found for "${query}"`);
    
    if (results.length === 0) {
      console.log("No results found for enhanced query:", query);
      return null;
    }
    
    // Log enhanced result information
    console.log("Enhanced search results summary:");
    results.slice(0, 3).forEach((result, index) => {
      console.log(`${index + 1}. File: ${result.filePath}, Content: ${result.content.substring(0, 100)}...`);
    });
    
    // Generate screenshots if needed
    let screenshots: Screenshot[] = [];
    if (queryAnalysis.needsScreenshots || shouldIncludeScreenshots(query)) {
      screenshots = await generateRelevantScreenshots(query);
    }
    
    // Enhanced AI processing with more context
    if (hasAICapabilities()) {
      try {
        // Prepare enhanced context with more detail
        const context = results.slice(0, 15).map(result => {
          return `File: ${result.filePath}\nType: ${result.type}\nContent: ${result.content.substring(0, 800)}\n${result.metadata ? `Metadata: ${JSON.stringify(result.metadata)}` : ''}\n---`;
        });
        
        console.log(`Sending ${context.length} enhanced context items to AI`);
        
        const aiAnswer = await generateAnswerWithAI(query, context);
        
        if (aiAnswer) {
          const references = results.slice(0, 8).map(result => ({
            filePath: result.filePath,
            snippet: result.content.substring(0, 300) + (result.content.length > 300 ? '...' : ''),
            lastUpdated: result.lastUpdated
          }));
          
          let visualContext = null;
          if (queryAnalysis.type === 'code-search' || query.toLowerCase().includes('flow') || 
              query.toLowerCase().includes('process') || query.toLowerCase().includes('component')) {
            visualContext = generateVisualContext(query, results);
          }
          
          return {
            text: aiAnswer,
            confidence: 0.94,
            references,
            screenshots: screenshots.length > 0 ? screenshots : undefined,
            visualContext: visualContext
          };
        }
      } catch (error) {
        console.error("AI answer generation error:", error);
        toast.error("AI answer generation failed, using enhanced template-based answers");
      }
    }
    
    // Enhanced mock data warning
    if (isUsingMockData()) {
      console.log("Using mock data for answer generation");
      toast.warning("Using sample data - connect your repository for accurate answers", {
        description: `This answer is based on sample data. Scanned ${diagnostics.lastScanDiagnostics.scannedFiles.length} files from your repository.`,
        duration: 6000
      });
    }
    
    // Enhanced repository-specific answer generation
    let answerText = generateEnhancedRepositoryAnswer(query, results, queryAnalysis);
    
    // Enhanced references with more content
    const references = results.slice(0, 8).map(result => ({
      filePath: result.filePath,
      snippet: result.content.substring(0, 400) + (result.content.length > 400 ? '...' : ''),
      lastUpdated: result.lastUpdated
    }));

    // Enhanced visual context generation
    let visualContext = null;
    if (queryAnalysis.needsCode || query.toLowerCase().includes('flow') || 
        query.toLowerCase().includes('process') || query.toLowerCase().includes('component') ||
        query.toLowerCase().includes('state')) {
      visualContext = generateVisualContext(query, results);
    }
    
    // Enhanced confidence calculation
    const confidence = Math.min(0.3 + (results.length * 0.08) + (queryAnalysis.keywords.length * 0.05), 0.88);
    
    console.log("Generated enhanced answer:", answerText.substring(0, 150) + "...");
    
    return {
      text: answerText,
      confidence,
      references,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      visualContext: visualContext
    };
  } catch (error) {
    console.error("Error in enhanced generateAnswer:", error);
    return null;
  }
}

/**
 * Enhanced repository-specific answer generation with better context awareness
 */
function generateEnhancedRepositoryAnswer(
  query: string, 
  results: any[], 
  queryAnalysis: ReturnType<typeof analyzeQuery>
): string {
  const lowerQuery = query.toLowerCase();
  
  // Extract enhanced information from results
  const fileTypes = new Set<string>();
  const functionNames = new Set<string>();
  const exports = new Set<string>();
  const apiRoutes = new Set<string>();
  const componentNames = new Set<string>();
  
  results.forEach(result => {
    const ext = result.filePath.split('.').pop();
    if (ext) fileTypes.add(ext);
    
    if (result.metadata?.name) functionNames.add(result.metadata.name);
    if (result.metadata?.method && result.metadata?.path) {
      apiRoutes.add(`${result.metadata.method} ${result.metadata.path}`);
    }
    
    // Extract component names from file paths
    if (result.filePath.includes('component')) {
      const componentName = result.filePath.split('/').pop()?.replace(/\.(tsx|ts|js|jsx)$/, '');
      if (componentName) componentNames.add(componentName);
    }
    
    // Enhanced export extraction
    const exportMatches = result.content.match(/export\s+(?:const|function|class|default)\s+(\w+)/g);
    if (exportMatches) {
      exportMatches.forEach(match => {
        const name = match.split(/\s+/).pop();
        if (name) exports.add(name);
      });
    }
  });
  
  let answerText = '';
  
  // Enhanced answer generation based on query type and content
  if (queryAnalysis.type === 'content-count') {
    answerText = generateContentCountAnswer(query, results);
  } else if (queryAnalysis.type === 'how-to') {
    answerText = generateHowToAnswer(query, results, { functionNames, componentNames, apiRoutes });
  } else if (queryAnalysis.type === 'what-is') {
    answerText = generateWhatIsAnswer(query, results, { functionNames, exports, componentNames });
  } else if (queryAnalysis.type === 'where-is') {
    answerText = generateWhereIsAnswer(query, results);
  } else if (queryAnalysis.type === 'code-search') {
    answerText = generateCodeSearchAnswer(query, results, { functionNames, exports, componentNames });
  } else {
    // Enhanced general answer
    answerText = generateGeneralAnswer(query, results, { fileTypes, functionNames, exports, apiRoutes, componentNames });
  }
  
  return answerText;
}

/**
 * Generate content count specific answers
 */
function generateContentCountAnswer(query: string, results: any[]): string {
  let answer = `## Content Analysis\n\n`;
  
  const contentCounts = extractContentCounts(results);
  const lowerQuery = query.toLowerCase();
  
  if (contentCounts.totalContent === 0) {
    answer += `I couldn't find specific content count information in the scanned codebase.\n\n`;
    answer += `This could mean:\n`;
    answer += `- Content files might be in directories not yet scanned\n`;
    answer += `- Content might be managed through a CMS or external service\n`;
    answer += `- The repository might not contain content files directly\n\n`;
    
    if (results.length > 0) {
      answer += `However, I found ${results.length} related entries in the codebase that might contain relevant information.\n`;
    }
    
    return answer;
  }
  
  if (lowerQuery.includes('blog') || lowerQuery.includes('post')) {
    answer += `**Blog Posts:** ${contentCounts.posts}\n\n`;
  }
  
  if (lowerQuery.includes('page')) {
    answer += `**Pages:** ${contentCounts.pages}\n\n`;
  }
  
  if (lowerQuery.includes('file')) {
    answer += `**Content Files:** ${contentCounts.files}\n\n`;
  }
  
  if (lowerQuery.includes('total') || lowerQuery.includes('all') || 
      (!lowerQuery.includes('blog') && !lowerQuery.includes('page') && !lowerQuery.includes('file'))) {
    answer += `**Total Content Summary:**\n`;
    answer += `- Blog Posts: ${contentCounts.posts}\n`;
    answer += `- Pages: ${contentCounts.pages}\n`;
    answer += `- Other Content Files: ${contentCounts.files}\n`;
    answer += `- **Total:** ${contentCounts.totalContent}\n\n`;
  }
  
  // Add source information
  if (results.length > 0) {
    answer += `**Sources analyzed:** ${results.length} entries from the codebase\n\n`;
    
    const relevantFiles = results.filter(r => 
      r.filePath.includes('.md') || r.filePath.includes('content') || 
      r.filePath.includes('post') || r.filePath.includes('page')
    ).slice(0, 3);
    
    if (relevantFiles.length > 0) {
      answer += `**Sample content files:**\n`;
      relevantFiles.forEach(file => {
        answer += `- \`${file.filePath}\`\n`;
      });
    }
  }
  
  return answer;
}

/**
 * Generate how-to specific answers
 */
function generateHowToAnswer(
  query: string, 
  results: any[], 
  context: { functionNames: Set<string>; componentNames: Set<string>; apiRoutes: Set<string> }
): string {
  let answer = `## How-To Guide\n\n`;
  
  if (results.length === 0) {
    return answer + `I couldn't find specific implementation details for "${query}" in the codebase.`;
  }
  
  answer += `Based on the codebase analysis, here's how to accomplish this:\n\n`;
  
  // Show relevant code examples
  results.slice(0, 3).forEach((result, index) => {
    answer += `### ${index + 1}. From \`${result.filePath}\`\n\n`;
    answer += `\`\`\`${result.filePath.split('.').pop()}\n`;
    answer += result.content.substring(0, 300);
    answer += result.content.length > 300 ? '\n// ... (truncated)\n' : '\n';
    answer += `\`\`\`\n\n`;
  });
  
  // Add function references if available
  if (context.functionNames.size > 0) {
    answer += `**Relevant Functions:** ${Array.from(context.functionNames).slice(0, 5).join(', ')}\n\n`;
  }
  
  if (context.apiRoutes.size > 0) {
    answer += `**API Endpoints:** ${Array.from(context.apiRoutes).slice(0, 3).join(', ')}\n\n`;
  }
  
  return answer;
}

/**
 * Generate what-is specific answers
 */
function generateWhatIsAnswer(
  query: string, 
  results: any[],
  context: { functionNames: Set<string>; exports: Set<string>; componentNames: Set<string> }
): string {
  let answer = `## Definition and Overview\n\n`;
  
  // Extract the main subject from the query
  const subject = query.replace(/what\s+is\s+/i, '').trim();
  
  const relevantResults = results.filter(r => 
    r.content.toLowerCase().includes(subject.toLowerCase()) ||
    r.filePath.toLowerCase().includes(subject.toLowerCase())
  );
  
  if (relevantResults.length === 0) {
    return answer + `I couldn't find specific information about "${subject}" in the codebase.`;
  }
  
  answer += `**${subject}** appears in the following contexts:\n\n`;
  
  relevantResults.slice(0, 3).forEach((result, index) => {
    answer += `### ${index + 1}. In \`${result.filePath}\`\n\n`;
    
    // Extract relevant sentences containing the subject
    const sentences = result.content.split(/[.!?]+/);
    const relevantSentences = sentences.filter(s => 
      s.toLowerCase().includes(subject.toLowerCase())
    ).slice(0, 2);
    
    if (relevantSentences.length > 0) {
      answer += relevantSentences.join('. ') + '.\n\n';
    } else {
      answer += result.content.substring(0, 200) + '...\n\n';
    }
  });
  
  return answer;
}

/**
 * Generate where-is specific answers
 */
function generateWhereIsAnswer(query: string, results: any[]): string {
  let answer = `## Location Information\n\n`;
  
  if (results.length === 0) {
    return answer + `I couldn't find the requested item in the scanned codebase.`;
  }
  
  answer += `Found in the following locations:\n\n`;
  
  results.slice(0, 5).forEach((result, index) => {
    answer += `**${index + 1}. \`${result.filePath}\`**\n`;
    answer += `${result.content.substring(0, 150)}...\n\n`;
  });
  
  return answer;
}

/**
 * Generate code-search specific answers
 */
function generateCodeSearchAnswer(
  query: string, 
  results: any[],
  context: { functionNames: Set<string>; exports: Set<string>; componentNames: Set<string> }
): string {
  let answer = `## Code Search Results\n\n`;
  
  if (results.length === 0) {
    return answer + `No matching code elements found for "${query}".`;
  }
  
  if (context.functionNames.size > 0) {
    answer += `**Functions Found:** ${Array.from(context.functionNames).join(', ')}\n\n`;
  }
  
  if (context.componentNames.size > 0) {
    answer += `**Components Found:** ${Array.from(context.componentNames).join(', ')}\n\n`;
  }
  
  answer += `**Code Examples:**\n\n`;
  
  results.slice(0, 3).forEach((result, index) => {
    answer += `### ${result.filePath}\n\n`;
    answer += `\`\`\`${result.filePath.split('.').pop()}\n`;
    answer += result.content.substring(0, 400);
    answer += result.content.length > 400 ? '\n// ... (truncated)\n' : '\n';
    answer += `\`\`\`\n\n`;
  });
  
  return answer;
}

/**
 * Generate general answers with enhanced context
 */
function generateGeneralAnswer(
  query: string, 
  results: any[],
  context: { 
    fileTypes: Set<string>; 
    functionNames: Set<string>; 
    exports: Set<string>; 
    apiRoutes: Set<string>;
    componentNames: Set<string>;
  }
): string {
  let answer = `## Analysis Results\n\n`;
  
  answer += `Based on the codebase analysis for "${query}":\n\n`;
  
  if (context.fileTypes.size > 0) {
    answer += `**File Types:** ${Array.from(context.fileTypes).join(', ')}\n`;
  }
  
  if (context.functionNames.size > 0) {
    answer += `**Functions:** ${Array.from(context.functionNames).slice(0, 8).join(', ')}\n`;
  }
  
  if (context.componentNames.size > 0) {
    answer += `**Components:** ${Array.from(context.componentNames).slice(0, 5).join(', ')}\n`;
  }
  
  if (context.apiRoutes.size > 0) {
    answer += `**API Routes:** ${Array.from(context.apiRoutes).slice(0, 3).join(', ')}\n`;
  }
  
  answer += `\n**Total Entries Analyzed:** ${results.length}\n\n`;
  
  if (results.length > 0) {
    answer += `**Sample Code:**\n\n`;
    results.slice(0, 2).forEach(result => {
      answer += `**From \`${result.filePath}\`:**\n`;
      answer += `\`\`\`${result.filePath.split('.').pop()}\n`;
      answer += result.content.substring(0, 300);
      answer += result.content.length > 300 ? '\n// ... (truncated)' : '';
      answer += `\n\`\`\`\n\n`;
    });
  }
  
  return answer;
}

/**
 * Generates repository-specific answers based on actual code content
 */
function generateRepositorySpecificAnswer(query: string, results: any[]): string {
  const lowerQuery = query.toLowerCase();
  
  // Extract actual information from the results
  const fileTypes = new Set<string>();
  const functionNames = new Set<string>();
  const exports = new Set<string>();
  const imports = new Set<string>();
  const apiRoutes = new Set<string>();
  
  results.forEach(result => {
    // Extract file extension
    const ext = result.filePath.split('.').pop();
    if (ext) fileTypes.add(ext);
    
    // Extract function names and exports from metadata
    if (result.metadata?.name) functionNames.add(result.metadata.name);
    if (result.metadata?.method && result.metadata?.path) {
      apiRoutes.add(`${result.metadata.method} ${result.metadata.path}`);
    }
    
    // Extract exports and imports from content
    if (result.content.includes('export')) {
      const exportMatches = result.content.match(/export\s+(?:const|function|class)\s+(\w+)/g);
      if (exportMatches) {
        exportMatches.forEach(match => {
          const name = match.split(/\s+/).pop();
          if (name) exports.add(name);
        });
      }
    }
  });
  
  // Generate answer based on what we actually found
  let answerText = '';
  
  if (lowerQuery.includes('download') || lowerQuery.includes('link')) {
    const downloadRelated = results.filter(r => 
      r.content.toLowerCase().includes('download') || 
      r.filePath.toLowerCase().includes('download') ||
      r.content.includes('href=') ||
      r.content.includes('link')
    );
    
    if (downloadRelated.length > 0) {
      answerText = `## Download Links\n\nBased on the codebase analysis, here are the download-related components found:\n\n`;
      
      downloadRelated.slice(0, 3).forEach(result => {
        answerText += `**${result.filePath}**\n`;
        answerText += `${result.content.substring(0, 150)}...\n\n`;
      });
      
      if (apiRoutes.size > 0) {
        answerText += `**API Endpoints:**\n`;
        Array.from(apiRoutes).slice(0, 3).forEach(route => {
          answerText += `- ${route}\n`;
        });
      }
    } else {
      answerText = `## Download Links\n\nNo specific download links were found in the current codebase scan. `;
      answerText += `This could mean:\n\n- Download functionality might be in files not yet scanned\n`;
      answerText += `- Downloads might be handled through external services\n`;
      answerText += `- The feature might not be implemented yet\n\n`;
      answerText += `**Files scanned:** ${results.length} entries from ${Array.from(fileTypes).join(', ')} files`;
    }
  } else if (lowerQuery.includes('api') || lowerQuery.includes('endpoint')) {
    if (apiRoutes.size > 0) {
      answerText = `## API Endpoints\n\nFound ${apiRoutes.size} API routes in the codebase:\n\n`;
      Array.from(apiRoutes).forEach(route => {
        answerText += `- ${route}\n`;
      });
    } else {
      answerText = `## API Information\n\nNo specific API routes found in the scanned files. `;
      answerText += `The application might use different API patterns or external services.`;
    }
  } else if (lowerQuery.includes('component') || lowerQuery.includes('ui')) {
    const componentFiles = results.filter(r => 
      r.filePath.includes('component') || 
      r.filePath.includes('ui') ||
      r.type === 'function'
    );
    
    if (componentFiles.length > 0) {
      answerText = `## Components\n\nFound ${componentFiles.length} component-related files:\n\n`;
      componentFiles.slice(0, 5).forEach(comp => {
        answerText += `**${comp.filePath}**\n`;
        if (comp.metadata?.name) answerText += `Function: ${comp.metadata.name}\n`;
        answerText += `${comp.content.substring(0, 100)}...\n\n`;
      });
    } else {
      answerText = `## Components\n\nNo specific component files found in the current scan.`;
    }
  } else {
    // Generic answer with actual repository information
    answerText = `## Repository Analysis\n\nBased on the codebase scan, here's what I found:\n\n`;
    
    if (fileTypes.size > 0) {
      answerText += `**File Types:** ${Array.from(fileTypes).join(', ')}\n`;
    }
    
    if (functionNames.size > 0) {
      answerText += `**Functions Found:** ${Array.from(functionNames).slice(0, 5).join(', ')}\n`;
    }
    
    if (exports.size > 0) {
      answerText += `**Exports Found:** ${Array.from(exports).slice(0, 5).join(', ')}\n`;
    }
    
    answerText += `\n**Total Entries:** ${results.length} code entries analyzed\n\n`;
    
    // Add some specific content from the results
    if (results.length > 0) {
      answerText += `**Relevant Code:**\n`;
      results.slice(0, 2).forEach(result => {
        answerText += `\nFrom \`${result.filePath}\`:\n`;
        answerText += `${result.content.substring(0, 200)}...\n`;
      });
    }
  }
  
  return answerText;
}

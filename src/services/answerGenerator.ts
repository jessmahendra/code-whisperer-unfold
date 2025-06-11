
import { searchKnowledgeWithHistory } from "./knowledgeBaseEnhanced";
import { getLastUpdatedText } from "./knowledgeBaseEnhanced";
import { generateVisualContext } from "./visualContextGenerator";
import { hasAICapabilities, generateAnswerWithAI } from "./aiAnalysis";
import { screenshotService, Screenshot } from "./screenshotService";
import { getCurrentRepository } from "./githubConnector";
import { isUsingMockData } from "./knowledgeBase";
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
  
  // Common patterns for repository URLs
  const commonPatterns = [
    `https://${currentRepo.repo}.herokuapp.com`,
    `https://${currentRepo.repo}.vercel.app`,
    `https://${currentRepo.repo}.netlify.app`,
    `https://${currentRepo.owner}.github.io/${currentRepo.repo}`,
    `https://${currentRepo.repo}.com`,
    `http://localhost:2368`, // Ghost default
    `http://localhost:3000`, // Common dev port
  ];
  
  // For Ghost specifically, try the most common patterns
  if (currentRepo.repo.toLowerCase().includes('ghost')) {
    return `http://localhost:2368`; // Ghost's default port
  }
  
  // Return the most likely URL (could be made configurable in the future)
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
    // Ghost-specific screenshot workflows
    if (lowerQuery.includes('ghost')) {
      console.log('Capturing Ghost admin interface screenshots');
      
      // Try different Ghost admin paths
      const ghostPaths = ['/ghost', '/admin', '/ghost/admin'];
      
      for (const path of ghostPaths) {
        try {
          const ghostScreenshots = await screenshotService.captureGhostAdminFlow(appUrl, path);
          if (ghostScreenshots.length > 0) {
            screenshots.push(...ghostScreenshots);
            break; // Found working admin path
          }
        } catch (error) {
          if (error.message.includes('cross-origin') || error.message.includes('Cross-origin')) {
            console.warn('Screenshots unavailable due to browser security restrictions');
            toast.error('Screenshots unavailable: Browser security prevents capturing from external applications. Try accessing your Ghost admin directly.');
            break; // Don't try other paths if it's a cross-origin issue
          }
          console.warn(`Failed to capture Ghost admin at path ${path}:`, error);
        }
      }
    }
    
    // Settings-related questions
    if (lowerQuery.includes('settings') || lowerQuery.includes('configure')) {
      if (screenshots.length === 0) {
        // Fallback to current app screenshots
        const settingsScreenshots = await screenshotService.captureRepositorySettings();
        screenshots.push(...settingsScreenshots);
      }
    }
    
    // Navigation questions
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
  // Simulate a slight processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    // Search the knowledge base with history information
    const results = await searchKnowledgeWithHistory(query);
    
    console.log(`Search results: ${results.length} entries found`);
    console.log(`Using mock data: ${isUsingMockData()}`);
    
    if (results.length === 0) {
      console.log("No results found for query:", query);
      return null;
    }
    
    // Log the first few results for debugging
    console.log("First few search results:");
    results.slice(0, 3).forEach((result, index) => {
      console.log(`${index + 1}. File: ${result.filePath}, Content length: ${result.content.length}`);
    });
    
    // Generate screenshots if the query would benefit from them
    let screenshots: Screenshot[] = [];
    if (shouldIncludeScreenshots(query)) {
      screenshots = await generateRelevantScreenshots(query);
    }
    
    // Check if AI capabilities are available
    if (hasAICapabilities()) {
      try {
        // Prepare context from search results with more detail
        const context = results.slice(0, 10).map(result => {
          return `File: ${result.filePath}\nType: ${result.type}\nContent: ${result.content}\n---`;
        });
        
        console.log(`Sending ${context.length} context items to AI`);
        
        // Use AI to generate an answer
        const aiAnswer = await generateAnswerWithAI(query, context);
        
        if (aiAnswer) {
          // Create references with version information
          const references = results.slice(0, 5).map(result => {
            return {
              filePath: result.filePath,
              snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
              lastUpdated: result.lastUpdated
            };
          });
          
          // Generate visual context if applicable
          let visualContext = null;
          if (query.toLowerCase().includes('flow') || 
              query.toLowerCase().includes('process') ||
              query.toLowerCase().includes('component') ||
              query.toLowerCase().includes('state')) {
            visualContext = generateVisualContext(query, results);
          }
          
          // Return AI-generated answer with high confidence
          return {
            text: aiAnswer,
            confidence: 0.92, // AI answers have higher confidence
            references,
            screenshots: screenshots.length > 0 ? screenshots : undefined,
            visualContext: visualContext
          };
        }
      } catch (error) {
        console.error("Error generating AI answer:", error);
        toast.error("AI answer generation failed, falling back to template-based answers");
        // Fall back to template-based answers
      }
    }
    
    // If we're using mock data, warn the user
    if (isUsingMockData()) {
      console.log("Using mock data for answer generation");
      toast.warning("Using sample data - connect your repository for accurate answers", {
        description: 'This answer is based on sample data, not your actual codebase.',
        duration: 4000
      });
    }
    
    // Generate template-based answer with improved repository-specific logic
    let answerText = generateRepositorySpecificAnswer(query, results);
    
    // Create references with version information
    const references = results.slice(0, 5).map(result => {
      return {
        filePath: result.filePath,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
        lastUpdated: result.lastUpdated
      };
    });

    // Generate visual context if applicable
    let visualContext = null;
    if (query.toLowerCase().includes('flow') || 
        query.toLowerCase().includes('process') ||
        query.toLowerCase().includes('component') ||
        query.toLowerCase().includes('state')) {
      visualContext = generateVisualContext(query, results);
    }
    
    console.log("Generated repository-specific answer:", answerText.substring(0, 100) + "...");
    
    return {
      text: answerText,
      confidence: Math.min(0.4 + (results.length * 0.1), 0.85),
      references,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      visualContext: visualContext
    };
  } catch (error) {
    console.error("Error in generateAnswer:", error);
    return null;
  }
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

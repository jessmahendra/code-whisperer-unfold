
import { getRepositoryContents, getCurrentRepository } from '../githubConnector';
import { KnowledgeEntry } from './types';
import { processModule, processFile } from './fileProcessor';

// Tracks successful path patterns for future reference
let successfulPathPatterns: string[] = [];

/**
 * Gets the default paths to try for Ghost repository structure
 * @param {string|undefined} repoName - Repository name
 * @returns {string[]} Array of paths to try
 */
export function getDefaultPathsToTry(repoName?: string): string[] {
  const basePaths = [
    // Most likely paths based on common Ghost structures
    '', // Root directory
    'core',
    'packages',
    'src',
    'app',
    
    // Server directories
    'core/server',
    'packages/core/server',
    'packages/ghost-core/server',
    'src/server',
    'app/server',
    
    // API directories
    'core/server/api',
    'packages/core/server/api',
    'core/server/services',
    'packages/core/server/services',
    
    // API version paths
    'core/server/api/v2',
    'core/server/api/v3',
    'core/server/api/canary',
    
    // Member-specific paths
    'core/server/services/members',
    'packages/members',
    'packages/members-api',
    
    // Content paths
    'core/server/api/v2/content',
    'core/server/api/v3/content',
    'core/server/api/canary/content',
  ];

  // Add repo name prefix paths if a repo name is provided
  if (repoName) {
    return [
      ...basePaths,
      `${repoName}/core/server`,
      `${repoName}/core/server/services/members`,
      `${repoName}/core/server/api`
    ];
  }
  
  return basePaths;
}

/**
 * Explores repository paths to find and process files
 * @param {KnowledgeEntry[]} knowledgeBase - Reference to the knowledge base
 * @returns {Promise<boolean>} True if any files were processed
 */
export async function exploreRepositoryPaths(
  knowledgeBase: KnowledgeEntry[]
): Promise<boolean> {
  try {
    // Get current repository configuration
    const currentRepo = getCurrentRepository();
    
    if (!currentRepo) {
      console.log('No repository configuration found, using mock data');
      return false;
    }
    
    // Get paths to try
    const pathsToTry = getDefaultPathsToTry(currentRepo.repo);
    
    // If we had successful patterns before, prioritize those
    const allPathsToTry = [...successfulPathPatterns, ...pathsToTry];
    
    console.log(`Attempting to scan ${allPathsToTry.length} possible paths in Ghost repository structure`);
    
    let processedAny = false;
    let successfulPaths = 0;
    
    for (const path of allPathsToTry) {
      try {
        console.log(`Trying path: ${path}`);
        const contents = await getRepositoryContents(path);
        
        if (contents.length > 0) {
          console.log(`Found ${contents.length} items in path: ${path}`);
          
          // Process discovered files and directories
          for (const item of contents) {
            if (item.type === 'file' && (item.name.endsWith('.js') || item.name.endsWith('.ts'))) {
              await processFile(item.path, knowledgeBase);
              processedAny = true;
              successfulPaths++;
            } else if (item.type === 'dir') {
              // Save successful paths for future reference
              if (!successfulPathPatterns.includes(path)) {
                successfulPathPatterns.push(path);
              }
              
              // Process important-looking directories
              if (
                item.name.includes('api') || 
                item.name.includes('service') || 
                item.name.includes('controller') ||
                item.name.includes('model') ||
                item.name.includes('member') ||
                item.name.includes('content') ||
                item.name.includes('subscription')
              ) {
                try {
                  await processModule(item.path, knowledgeBase);
                  processedAny = true;
                  successfulPaths++;
                } catch (dirError) {
                  console.log(`Could not process directory ${item.path}: ${dirError.message}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`Could not access path ${path}: ${error.message}`);
        // Continue trying other paths
      }
    }
    
    console.log(`Processed ${successfulPaths} paths successfully`);
    return processedAny;
  } catch (error) {
    console.error('Error exploring repository paths:', error);
    return false;
  }
}

/**
 * Clears the successful path patterns
 */
export function clearSuccessfulPathPatterns(): void {
  successfulPathPatterns = [];
}


import { getRepositoryContents, getCurrentRepository } from '../githubConnector';
import { KnowledgeEntry } from './types';
import { processModule, processFile } from './fileProcessor';

// Tracks successful path patterns for future reference
let successfulPathPatterns: string[] = [];

/**
 * Gets the default paths to try for a repository structure
 * @param {string|undefined} repoName - Repository name
 * @returns {string[]} Array of paths to try
 */
export function getDefaultPathsToTry(repoName?: string): string[] {
  // Basic repository structure for any repo, not just Ghost
  const basePaths = [
    '', // Root directory
    'src',
    'app',
    'packages',
    'lib',
    'core',
    
    // Common code organization patterns
    'src/api',
    'src/services',
    'src/models',
    'api',
    'services',
    'models',
    'controllers',
    'utils',
    'helpers',
    
    // Common folder names for specific features
    'src/auth',
    'src/users',
    'src/content',
    'auth',
    'users',
    'content',
  ];

  // Add repo name prefix paths if a repo name is provided
  if (repoName) {
    return [
      ...basePaths,
      `${repoName}/src`,
      `${repoName}/app`,
      `${repoName}/packages`,
      `${repoName}/core`
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
    
    console.log(`Exploring repository: ${currentRepo.owner}/${currentRepo.repo}`);
    
    // Try the root first to discover repository structure
    try {
      const rootContents = await getRepositoryContents('');
      console.log(`Found ${rootContents.length} items in the root of the repository`);
      
      // Automatically discover main directories in the repo
      const mainDirs = rootContents.filter(item => item.type === 'dir').map(dir => dir.path);
      if (mainDirs.length > 0) {
        console.log(`Discovered directories: ${mainDirs.join(', ')}`);
        successfulPathPatterns.push(...mainDirs);
      }
    } catch (error) {
      console.log(`Could not access root path: ${error.message}`);
    }
    
    // Get paths to try (use discovered paths first, then fall back to defaults)
    const defaultPaths = getDefaultPathsToTry(currentRepo.repo);
    const allPathsToTry = [...new Set([...successfulPathPatterns, ...defaultPaths])];
    
    console.log(`Attempting to scan ${allPathsToTry.length} possible paths in repository structure`);
    
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
            if (item.type === 'file' && (
              item.name.endsWith('.js') || 
              item.name.endsWith('.ts') || 
              item.name.endsWith('.tsx') || 
              item.name.endsWith('.jsx')
            )) {
              await processFile(item.path, knowledgeBase);
              processedAny = true;
              successfulPaths++;
            } else if (item.type === 'dir') {
              // Save successful paths for future reference
              if (!successfulPathPatterns.includes(path)) {
                successfulPathPatterns.push(path);
              }
              
              // Process important-looking directories or all directories if we haven't found much yet
              const isImportantDir = 
                item.name.includes('api') || 
                item.name.includes('service') || 
                item.name.includes('controller') ||
                item.name.includes('model') ||
                item.name.includes('util') ||
                item.name.includes('helper') ||
                item.name.includes('component') ||
                item.name.includes('module') ||
                successfulPaths < 5; // Process more aggressively if we haven't found much yet
                
              if (isImportantDir) {
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


import { getRepositoryContents, getCurrentRepository, getFileContent } from '../githubConnector';
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
  // For Ghost specifically, try these paths for current repository structure
  if (repoName === 'Ghost') {
    return [
      '', // Root directory
      'ghost',
      'packages', // Modern Ghost uses a packages structure
      'packages/ghost',
      'apps',
      'apps/ghost',
      'apps/admin',
      'core',
      'ghost/core',
      'ghost/admin',
      
      // Current structure paths (Ghost 5.x+)
      'ghost/core/core',
      'ghost/core/core/server',
      'ghost/core/core/frontend',
      'ghost/core/core/shared',
      'ghost/admin/app',
      
      // Current API structure paths
      'ghost/core/core/server/api',
      'ghost/core/core/server/api/endpoints',
      'ghost/core/core/server/api/endpoints/content',
      'ghost/core/core/server/api/endpoints/admin',
      'ghost/core/core/server/api/versions',
      'ghost/core/core/server/api/canary',
      'ghost/core/core/server/api/canary/endpoints',
      
      // Current models and services
      'ghost/core/core/server/models',
      'ghost/core/core/server/services',
      'ghost/core/core/server/services/members',
      'ghost/core/core/server/services/auth',
      'ghost/core/core/server/data',
      
      // Documentation
      'content',
      'docs',
    ];
  }
  
  // Basic repository structure for any repo
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
    'src/components',
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
    
    // First, try to get the root contents to better understand the repository structure
    let rootContents = [];
    try {
      rootContents = await getRepositoryContents('');
      console.log(`Found ${rootContents.length} items in the root of the repository:`, 
        rootContents.map(item => item.name).join(', '));
        
      if (rootContents.length > 0) {
        // Check if this is a monorepo by looking for directories like "ghost" or "core" or "packages"
        const mainDirs = rootContents
          .filter(item => item.type === 'dir')
          .map(dir => dir.path);
          
        if (mainDirs.length > 0) {
          console.log(`Discovered directories: ${mainDirs.join(', ')}`);
          successfulPathPatterns.push(...mainDirs);
          
          // If it's a GitHub monorepo, first try to explore those main dirs
          for (const dir of mainDirs) {
            try {
              console.log(`Exploring main directory: ${dir}`);
              const dirContents = await getRepositoryContents(dir);
              if (dirContents.length > 0) {
                console.log(`Found ${dirContents.length} items in ${dir} directory`);
                // Add subdirectories to successful patterns
                const subDirs = dirContents
                  .filter(item => item.type === 'dir')
                  .map(subDir => `${dir}/${subDir.name}`);
                  
                if (subDirs.length > 0) {
                  console.log(`Adding subdirectories: ${subDirs.join(', ')}`);
                  successfulPathPatterns.push(...subDirs);
                  
                  // For Ghost, try to go one level deeper since structure is complex
                  if (currentRepo.repo === "Ghost") {
                    for (const subDir of subDirs) {
                      try {
                        const subContents = await getRepositoryContents(subDir);
                        const subSubDirs = subContents
                          .filter(item => item.type === 'dir')
                          .map(subSubDir => `${subDir}/${subSubDir.name}`);
                        
                        if (subSubDirs.length > 0) {
                          console.log(`Adding nested subdirectories: ${subSubDirs.join(', ')}`);
                          successfulPathPatterns.push(...subSubDirs);
                        }
                      } catch (error) {
                        console.log(`Error exploring subdirectory ${subDir}:`, error.message);
                      }
                    }
                  }
                }
                
                // Process JS/TS files in this directory
                const files = dirContents.filter(item => 
                  item.type === 'file' && 
                  (item.name.endsWith('.js') || 
                   item.name.endsWith('.ts') || 
                   item.name.endsWith('.tsx') || 
                   item.name.endsWith('.jsx') ||
                   item.name.endsWith('.md'))
                );
                
                for (const file of files) {
                  await processFile(file.path, knowledgeBase);
                }
                
                if (files.length > 0) {
                  console.log(`Processed ${files.length} files in ${dir} directory`);
                }
              }
            } catch (error) {
              console.log(`Error exploring ${dir} directory:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error exploring root directory:', error.message);
    }
    
    // Special handling for Ghost repo - use updated paths based on current Ghost structure
    if (currentRepo.repo === "Ghost" && currentRepo.owner === "TryGhost") {
      console.log("Using specialized path exploration for Ghost repository");
      
      // Try the most current Ghost paths directly
      const ghostSpecificPaths = [
        // Current structure (Ghost 5.x+)
        'ghost/core/core/server/services/members',
        'ghost/core/core/server/services/auth',
        'ghost/core/core/server/api/canary/content',
        'ghost/core/core/server/api/canary/endpoints',
        'ghost/core/core/server/models',
        'ghost/core/core/frontend/services',
        'ghost/core/core/server/data/schema',
        'ghost/core/core/server/data/migrations',
        'ghost/admin/app/routes',
        'ghost/admin/app/components',
        'ghost/admin/app/templates'
      ];
      
      for (const path of ghostSpecificPaths) {
        try {
          console.log(`Trying Ghost-specific path: ${path}`);
          const contents = await getRepositoryContents(path);
          
          if (contents && contents.length > 0) {
            console.log(`Found ${contents.length} items in Ghost-specific path: ${path}`);
            successfulPathPatterns.push(path);
            
            // Process JavaScript/TypeScript files in this directory
            const files = contents.filter(item => 
              item.type === 'file' && 
              (item.name.endsWith('.js') || item.name.endsWith('.ts'))
            );
            
            for (const file of files) {
              try {
                await processFile(file.path, knowledgeBase);
              } catch (fileError) {
                console.log(`Could not process Ghost file ${file.path}: ${fileError.message}`);
              }
            }
            
            if (files.length > 0) {
              console.log(`Processed ${files.length} files in Ghost-specific path: ${path}`);
            }
          } else {
            console.log(`No contents found for ${path}`);
          }
        } catch (error) {
          console.log(`Could not access Ghost-specific path ${path}: ${error.message}`);
        }
      }
    }
    
    // Get paths to try (use discovered paths first, then fall back to defaults)
    const defaultPaths = getDefaultPathsToTry(currentRepo.repo);
    const allPathsToTry = [...new Set([...successfulPathPatterns, ...defaultPaths])];
    
    console.log(`Attempting to scan ${allPathsToTry.length} possible paths in repository structure`);
    
    let processedAny = false;
    let successfulPaths = 0;
    const maxPathsToTry = currentRepo.repo === "Ghost" ? 40 : 20; // Higher limit for Ghost repo
    let attemptedPaths = 0;
    
    for (const path of allPathsToTry) {
      if (attemptedPaths >= maxPathsToTry) {
        console.log(`Reached maximum path attempt limit (${maxPathsToTry})`);
        break;
      }
      
      attemptedPaths++;
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
              item.name.endsWith('.jsx') ||
              item.name.endsWith('.md')  // Include markdown files for documentation
            )) {
              try {
                // Try to load file content first to verify access
                await getFileContent(item.path);
                await processFile(item.path, knowledgeBase);
                processedAny = true;
                successfulPaths++;
              } catch (fileError) {
                console.log(`Could not process file ${item.path}: ${fileError.message}`);
              }
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

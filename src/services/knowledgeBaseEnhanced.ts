import { searchKnowledge } from './knowledgeBase';
import { fetchCommitHistory } from './githubClient';
import { getCurrentRepository } from './githubConnector';

// Store search history to provide context for future queries
let searchHistory: { query: string, timestamp: number }[] = [];
const MAX_HISTORY_LENGTH = 10;

// Cache for file last updated information
const lastUpdatedCache: Record<string, string> = {};

/**
 * Records a search query in search history
 * @param {string} query - Search query to record
 */
function recordSearch(query: string): void {
  searchHistory.unshift({
    query,
    timestamp: Date.now()
  });
  
  // Keep history limited to reasonable size
  if (searchHistory.length > MAX_HISTORY_LENGTH) {
    searchHistory.pop();
  }
}

/**
 * Gets the last updated date for a file from GitHub API
 * @param {string} filePath - File path
 * @returns {Promise<string>} Last updated date or 'Unknown'
 */
async function getLastUpdatedDate(filePath: string): Promise<string> {
  // Return from cache if available
  if (lastUpdatedCache[filePath]) {
    return lastUpdatedCache[filePath];
  }
  
  try {
    const repo = getCurrentRepository();
    if (!repo) {
      return 'Unknown';
    }
    
    const history = await fetchCommitHistory(repo.owner, repo.repo, filePath, 1);
    if (history && history.length > 0) {
      lastUpdatedCache[filePath] = history[0].date;
      return history[0].date;
    }
    
    return 'Unknown';
  } catch (error) {
    console.error(`Error fetching commit history for ${filePath}:`, error);
    return 'Unknown';
  }
}

/**
 * Searches the knowledge base with history context
 * @param {string} query - Search query
 * @returns {Promise<Array>} Enhanced search results with version information
 */
export async function searchKnowledgeWithHistory(query: string): Promise<Array<any>> {
  // Record this search
  recordSearch(query);
  
  // Combine current query with recent history for context
  const contextualizedQuery = [
    query,
    ...searchHistory
      .slice(1, 3)  // Use only 2 most recent queries for context
      .map(item => item.query)
  ].join(' ');
  
  // Get base results from knowledge base
  const results = searchKnowledge(contextualizedQuery);
  
  // Enhance results with version information
  const enhancedResults = await Promise.all(
    results.map(async (result) => {
      const lastUpdated = await getLastUpdatedDate(result.filePath);
      return { ...result, lastUpdated };
    })
  );
  
  return enhancedResults;
}

/**
 * Returns the last updated text for a specific file
 * @param {string} filePath - File path
 * @returns {Promise<string>} Last updated text
 */
export async function getLastUpdatedText(filePath: string): Promise<string> {
  const lastUpdated = await getLastUpdatedDate(filePath);
  if (lastUpdated === 'Unknown') {
    return 'Last updated: Unknown';
  }
  
  try {
    const date = new Date(lastUpdated);
    return `Last updated: ${date.toLocaleDateString()}`;
  } catch (error) {
    return `Last updated: ${lastUpdated}`;
  }
}

/**
 * Clears search history and caches
 */
export function clearSearchHistory(): void {
  searchHistory = [];
  Object.keys(lastUpdatedCache).forEach(key => delete lastUpdatedCache[key]);
}

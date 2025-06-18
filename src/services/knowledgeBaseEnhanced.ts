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

/**
 * Enhanced search function with better keyword matching and README prioritization
 * @param {string} query - Search query
 * @param {KnowledgeEntry[]} entries - Knowledge base entries
 * @param {SearchOptions} options - Search options
 * @returns {Promise<KnowledgeEntry[]>} Enhanced search results
 */
export async function enhancedSearch(
  query: string,
  entries: KnowledgeEntry[],
  options: SearchOptions = {}
): Promise<KnowledgeEntry[]> {
  const {
    limit = 10,
    minScore = 0.1,
    prioritizeReadme = false,
    includeContent = true
  } = options;

  console.log(`🔍 Enhanced search: "${query}" (README priority: ${prioritizeReadme})`);
  
  if (!query.trim() || entries.length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);
  
  // Calculate relevance scores for each entry
  const scoredEntries = entries.map(entry => {
    let score = 0;
    
    // Keyword matching (primary scoring mechanism)
    if (entry.keywords && entry.keywords.length > 0) {
      const keywordMatches = entry.keywords.filter(keyword => 
        queryWords.some(word => keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase()))
      );
      score += (keywordMatches.length / entry.keywords.length) * 0.6;
    }
    
    // Direct content matching (secondary scoring)
    if (includeContent && entry.content) {
      const contentMatches = queryWords.filter(word => 
        entry.content.toLowerCase().includes(word)
      );
      score += (contentMatches.length / queryWords.length) * 0.3;
    }
    
    // File path matching
    const pathMatches = queryWords.filter(word => 
      entry.filePath.toLowerCase().includes(word)
    );
    score += (pathMatches.length / queryWords.length) * 0.1;
    
    // README prioritization boost
    if (prioritizeReadme && (entry.metadata?.isReadme || entry.filePath.toLowerCase().includes('readme'))) {
      score += 0.5; // Strong boost for README files
    }
    
    // Priority metadata boost
    if (entry.metadata?.priority === 'high') {
      score += 0.2;
    }
    
    return {
      entry,
      score,
      reasons: {
        keywordMatches: entry.keywords ? entry.keywords.filter(k => 
          queryWords.some(w => k.toLowerCase().includes(w) || w.includes(k.toLowerCase()))
        ) : [],
        contentMatch: includeContent ? queryWords.some(w => entry.content.toLowerCase().includes(w)) : false,
        pathMatch: queryWords.some(w => entry.filePath.toLowerCase().includes(w)),
        isReadme: entry.metadata?.isReadme || entry.filePath.toLowerCase().includes('readme'),
        priority: entry.metadata?.priority
      }
    };
  });

  // Filter and sort by score
  const filteredEntries = scoredEntries
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`🔍 Found ${filteredEntries.length} relevant entries (min score: ${minScore})`);
  
  // Log top results for debugging
  if (filteredEntries.length > 0) {
    console.log('Top search results:');
    filteredEntries.slice(0, 3).forEach(({ entry, score, reasons }, index) => {
      console.log(`  ${index + 1}. ${entry.filePath} (score: ${score.toFixed(3)})`, reasons);
    });
  }

  // Return the actual entries, not the scored objects
  return filteredEntries.map(({ entry }) => entry);
}

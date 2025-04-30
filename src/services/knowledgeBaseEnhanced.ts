
import { searchKnowledge as originalSearchKnowledge } from './knowledgeBase';
import { enrichKnowledgeItem, getHistoryForFiles } from './gitHistoryService';
import { KnowledgeEntry } from './knowledgeBase';

interface EnhancedKnowledgeEntry extends KnowledgeEntry {
  lastUpdated?: string;
  changeFrequency?: 'high' | 'medium' | 'low';
  history?: Array<{
    sha: string;
    date: string;
    message: string;
    author: string;
  }>;
}

/**
 * Cache for file history data to avoid redundant API calls
 */
const historyCache: Record<string, any> = {};

/**
 * Searches the knowledge base and enhances results with version information
 * @param {string} query - Search query
 * @returns {Promise<EnhancedKnowledgeEntry[]>} Enhanced knowledge entries
 */
export async function searchKnowledgeWithHistory(query: string): Promise<EnhancedKnowledgeEntry[]> {
  // Get basic search results
  const results = originalSearchKnowledge(query);
  
  if (results.length === 0) {
    return [];
  }
  
  // Extract unique file paths
  const filePaths = Array.from(new Set(results.map(item => item.filePath)));
  
  // Get history for all files (using cache when available)
  let fileHistories: Record<string, any> = {};
  const uncachedPaths = filePaths.filter(path => !historyCache[path]);
  
  if (uncachedPaths.length > 0) {
    const newHistories = await getHistoryForFiles(uncachedPaths);
    
    // Update cache
    Object.entries(newHistories).forEach(([path, history]) => {
      historyCache[path] = history;
    });
  }
  
  // Combine cached and new histories
  fileHistories = filePaths.reduce((acc, path) => {
    acc[path] = historyCache[path];
    return acc;
  }, {} as Record<string, any>);
  
  // Enhance results with history data
  const enhancedResults = results.map(item => {
    const fileHistory = fileHistories[item.filePath];
    if (!fileHistory) {
      return item as EnhancedKnowledgeEntry;
    }
    
    return enrichKnowledgeItem(item, fileHistory.commits) as EnhancedKnowledgeEntry;
  });
  
  return enhancedResults;
}

/**
 * Formats the timeline of changes for display
 * @param {EnhancedKnowledgeEntry} entry - Knowledge entry with history
 * @returns {string} Formatted timeline text
 */
export function formatTimeline(entry: EnhancedKnowledgeEntry): string {
  if (!entry.history || entry.history.length === 0) {
    return 'No history available';
  }
  
  return entry.history.map(commit => {
    const date = new Date(commit.date).toLocaleDateString();
    return `${date}: ${commit.message} (${commit.author})`;
  }).join('\n');
}

/**
 * Gets last updated information as a formatted string
 * @param {EnhancedKnowledgeEntry} entry - Knowledge entry with history
 * @returns {string} Formatted last updated text
 */
export function getLastUpdatedText(entry: EnhancedKnowledgeEntry): string {
  if (!entry.lastUpdated || entry.lastUpdated === 'Unknown') {
    return 'Last updated: Unknown';
  }
  
  const date = new Date(entry.lastUpdated).toLocaleDateString();
  const author = entry.history && entry.history.length > 0 ? entry.history[0].author : 'Unknown';
  
  return `Last updated: ${date} by ${author}`;
}

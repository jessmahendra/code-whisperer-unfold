
/**
 * Service for interacting with Git repository history
 */

interface CommitInfo {
  sha: string;
  date: string;
  message: string;
  author: string;
}

interface FileHistory {
  filePath: string;
  commits: CommitInfo[];
  lastUpdated: string;
  changeFrequency: 'high' | 'medium' | 'low';
}

/**
 * Fetches commit history for a specific file
 * @param {string} repoOwner - Repository owner
 * @param {string} repoName - Repository name
 * @param {string} filePath - Path to the file
 * @returns {Promise<CommitInfo[]>} Array of commit information
 */
export async function getFileHistory(
  repoOwner: string,
  repoName: string, 
  filePath: string
): Promise<CommitInfo[]> {
  try {
    // For demo purposes, we'll mock the GitHub API response
    // In a real implementation, this would call the GitHub API
    console.log(`Fetching history for ${filePath}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate some mock commits based on the file path
    // to make the history data look realistic
    const mockCommits = generateMockCommits(filePath);
    
    return mockCommits;
  } catch (error) {
    console.error('Error fetching file history:', error);
    return [];
  }
}

/**
 * Generates mock commits for demo purposes
 * @param {string} filePath - Path to the file
 * @returns {CommitInfo[]} Array of mock commit information
 */
function generateMockCommits(filePath: string): CommitInfo[] {
  // Extract filename for more realistic mock data
  const fileName = filePath.split('/').pop() || filePath;
  
  // Generate a variable number of commits based on the file path length
  // to create some variety in the mock data
  const commitCount = (filePath.length % 5) + 2;
  const commits: CommitInfo[] = [];
  
  const now = new Date();
  
  for (let i = 0; i < commitCount; i++) {
    // Go back in time for each commit
    const commitDate = new Date(now);
    commitDate.setDate(now.getDate() - i * 10);
    
    commits.push({
      sha: generateMockSha(),
      date: commitDate.toISOString(),
      message: generateMockCommitMessage(fileName, i),
      author: MOCK_AUTHORS[i % MOCK_AUTHORS.length]
    });
  }
  
  return commits;
}

/**
 * Generates a mock SHA for commit
 * @returns {string} Mock SHA string
 */
function generateMockSha(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a realistic mock commit message
 * @param {string} fileName - Name of the file
 * @param {number} index - Index of the commit
 * @returns {string} Mock commit message
 */
function generateMockCommitMessage(fileName: string, index: number): string {
  const messages = [
    `Update ${fileName} to fix bug`,
    `Refactor ${fileName} for better performance`,
    `Add new features to ${fileName}`,
    `Documentation improvements in ${fileName}`,
    `Fix typo in ${fileName}`,
    `Initial commit for ${fileName}`,
    `Merge pull request for ${fileName}`
  ];
  
  return messages[index % messages.length];
}

// Mock author data
const MOCK_AUTHORS = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Miller'];

/**
 * Calculates change frequency based on commit history
 * @param {CommitInfo[]} history - File commit history
 * @returns {string} Change frequency category
 */
export function calculateChangeFrequency(history: CommitInfo[]): 'high' | 'medium' | 'low' {
  if (!history || history.length === 0) return 'low';
  
  if (history.length > 10) return 'high';
  if (history.length > 5) return 'medium';
  return 'low';
}

/**
 * Enriches a knowledge item with history data
 * @param {any} item - Knowledge item to enrich
 * @param {CommitInfo[]} history - File commit history
 * @returns {any} Enriched knowledge item
 */
export function enrichKnowledgeItem(item: any, history: CommitInfo[]): any {
  if (!history || history.length === 0) {
    return {
      ...item,
      lastUpdated: 'Unknown',
      changeFrequency: 'low',
      history: []
    };
  }
  
  return {
    ...item,
    lastUpdated: history[0]?.date || 'Unknown',
    changeFrequency: calculateChangeFrequency(history),
    history: history.slice(0, 5), // Last 5 changes
  };
}

/**
 * Gets history for multiple files
 * @param {string[]} filePaths - Array of file paths
 * @returns {Promise<Record<string, FileHistory>>} Map of file paths to histories
 */
export async function getHistoryForFiles(
  filePaths: string[]
): Promise<Record<string, FileHistory>> {
  const result: Record<string, FileHistory> = {};
  
  for (const filePath of filePaths) {
    const commits = await getFileHistory('TryGhost', 'Ghost', filePath);
    
    result[filePath] = {
      filePath,
      commits,
      lastUpdated: commits[0]?.date || 'Unknown',
      changeFrequency: calculateChangeFrequency(commits)
    };
  }
  
  return result;
}


import { Octokit } from "@octokit/rest";
import { toast } from "sonner";

// Singleton instance for the GitHub client
let octokitInstance: Octokit | null = null;

/**
 * Initialize the GitHub client with a personal access token
 * @param token GitHub personal access token
 * @returns Boolean indicating if initialization was successful
 */
export function initGithubClient(token: string): boolean {
  try {
    // Clear any previous instance
    octokitInstance = null;
    
    // Create a new Octokit instance with the token
    octokitInstance = new Octokit({
      auth: token
    });
    
    console.log("GitHub client initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize GitHub client:", error);
    toast.error("Failed to initialize GitHub client", {
      description: error instanceof Error ? error.message : "Unknown error occurred"
    });
    return false;
  }
}

/**
 * Check if the GitHub client is initialized
 * @returns Boolean indicating if client is ready
 */
export function isGithubClientInitialized(): boolean {
  return octokitInstance !== null;
}

/**
 * Clear the current GitHub client instance
 */
export function clearGithubClient(): void {
  octokitInstance = null;
}

/**
 * Get repository contents from GitHub API
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path within the repository
 * @returns Repository contents
 */
export async function fetchRepositoryContents(owner: string, repo: string, path: string = "") {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    console.log(`Fetching repository contents for ${owner}/${repo}/${path}`);
    
    const response = await octokitInstance.repos.getContent({
      owner,
      repo,
      path
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching repository contents for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Get file content from GitHub API
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path to the file
 * @returns File content as a string
 */
export async function fetchFileContent(owner: string, repo: string, path: string) {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    console.log(`Fetching file content for ${owner}/${repo}/${path}`);
    
    const response = await octokitInstance.repos.getContent({
      owner,
      repo,
      path
    });

    // GitHub returns an array if path is a directory, or an object if it's a file
    if (Array.isArray(response.data)) {
      throw new Error(`Path ${path} is a directory, not a file`);
    }

    // Type assertion to access the content property
    const fileData = response.data as { content?: string; encoding?: string };
    
    if (!fileData.content) {
      throw new Error(`No content found for file ${path}`);
    }

    // GitHub API returns content as base64
    // Use browser-compatible base64 decoding
    try {
      // Remove whitespace and line breaks from the base64 string
      const cleanBase64 = fileData.content.replace(/\s/g, '');
      
      // Decode base64 string using browser-compatible approach
      const binary = atob(cleanBase64);
      
      // Handle Unicode characters properly
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
      }
      
      // Convert bytes to string using TextDecoder
      return new TextDecoder('utf-8').decode(bytes);
    } catch (decodeError) {
      console.error("Failed to decode file content:", decodeError);
      throw new Error(`Failed to decode content for ${path}: ${decodeError.message}`);
    }
  } catch (error) {
    console.error(`Error fetching file content for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Get commit history for a file
 * @param owner Repository owner
 * @param repo Repository name
 * @param path Path to the file
 * @param limit Maximum number of commits to return
 * @returns Array of commit information
 */
export async function fetchCommitHistory(owner: string, repo: string, path: string, limit: number = 10) {
  if (!octokitInstance) {
    throw new Error("GitHub client not initialized");
  }

  try {
    const response = await octokitInstance.repos.listCommits({
      owner,
      repo,
      path,
      per_page: limit
    });

    return response.data.map(item => ({
      sha: item.sha,
      date: item.commit.author?.date || new Date().toISOString(),
      message: item.commit.message,
      author: item.commit.author?.name || 'Unknown'
    }));
  } catch (error) {
    console.error(`Error fetching commit history for ${owner}/${repo}/${path}:`, error);
    throw error;
  }
}

/**
 * Validate GitHub token by attempting to get the authenticated user
 * @param token GitHub personal access token to validate
 * @returns User information if valid, null otherwise
 */
export async function validateGithubToken(token: string) {
  try {
    console.log("Validating GitHub token...");
    const tempClient = new Octokit({ auth: token });
    const response = await tempClient.users.getAuthenticated();
    console.log("Token validation successful:", response.data.login);
    return response.data;
  } catch (error) {
    console.error("Token validation failed:", error);
    toast.error("Invalid GitHub token", {
      description: "Make sure your token has the 'repo' scope and is valid."
    });
    return null;
  }
}

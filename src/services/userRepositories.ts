
export interface UserRepository {
  id: string;
  owner: string;
  repo: string;
  token: string;
  nickname?: string;
  createdAt: string;
  lastUsed: string;
  paths?: string[];
}

// Storage keys
const USER_REPOS_KEY = 'unfold_user_repositories';
const ACTIVE_REPO_ID_KEY = 'unfold_active_repository';

/**
 * Generate a unique ID for a repository
 */
function generateRepositoryId(owner: string, repo: string): string {
  return `${owner}-${repo}-${Date.now()}`;
}

/**
 * Get all user repositories
 */
export function getUserRepositories(): UserRepository[] {
  try {
    const reposString = localStorage.getItem(USER_REPOS_KEY);
    if (!reposString) return [];
    
    const repos = JSON.parse(reposString) as UserRepository[];
    return repos;
  } catch (error) {
    console.error('Error retrieving user repositories:', error);
    return [];
  }
}

/**
 * Save a new repository or update an existing one
 */
export function saveUserRepository(
  owner: string, 
  repo: string, 
  token: string, 
  nickname?: string
): UserRepository {
  const repos = getUserRepositories();
  
  // Check if repository already exists
  const existingRepo = repos.find(r => r.owner === owner && r.repo === repo);
  
  if (existingRepo) {
    // Update existing repository
    existingRepo.token = token;
    existingRepo.nickname = nickname;
    existingRepo.lastUsed = new Date().toISOString();
    
    localStorage.setItem(USER_REPOS_KEY, JSON.stringify(repos));
    return existingRepo;
  } else {
    // Create new repository
    const newRepo: UserRepository = {
      id: generateRepositoryId(owner, repo),
      owner,
      repo,
      token,
      nickname,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    repos.push(newRepo);
    localStorage.setItem(USER_REPOS_KEY, JSON.stringify(repos));
    return newRepo;
  }
}

/**
 * Remove a repository
 */
export function removeUserRepository(repositoryId: string): void {
  const repos = getUserRepositories();
  const filteredRepos = repos.filter(r => r.id !== repositoryId);
  
  localStorage.setItem(USER_REPOS_KEY, JSON.stringify(filteredRepos));
  
  // If the removed repo was active, clear the active repo
  if (getActiveRepositoryId() === repositoryId) {
    clearActiveRepository();
  }
}

/**
 * Get the active repository ID
 */
export function getActiveRepositoryId(): string | null {
  return localStorage.getItem(ACTIVE_REPO_ID_KEY);
}

/**
 * Set the active repository
 */
export function setActiveRepository(repositoryId: string): void {
  const repos = getUserRepositories();
  const repo = repos.find(r => r.id === repositoryId);
  
  if (!repo) {
    throw new Error(`Repository with ID ${repositoryId} not found`);
  }
  
  // Update last used timestamp
  repo.lastUsed = new Date().toISOString();
  localStorage.setItem(USER_REPOS_KEY, JSON.stringify(repos));
  
  // Set as active
  localStorage.setItem(ACTIVE_REPO_ID_KEY, repositoryId);
}

/**
 * Clear the active repository
 */
export function clearActiveRepository(): void {
  localStorage.removeItem(ACTIVE_REPO_ID_KEY);
}

/**
 * Get the currently active repository
 */
export function getActiveRepository(): UserRepository | null {
  const activeId = getActiveRepositoryId();
  if (!activeId) return null;
  
  const repos = getUserRepositories();
  return repos.find(r => r.id === activeId) || null;
}

/**
 * Migrate existing repository config to new system
 */
export function migrateExistingConfig(): void {
  // Check if we already have user repositories
  const existingRepos = getUserRepositories();
  if (existingRepos.length > 0) return;
  
  // Check for old repository config
  try {
    const oldConfigString = localStorage.getItem('unfold_repo_config');
    if (!oldConfigString) return;
    
    const oldConfig = JSON.parse(oldConfigString);
    if (oldConfig.owner && oldConfig.repo && oldConfig.token) {
      console.log('Migrating existing repository configuration...');
      
      const migratedRepo = saveUserRepository(
        oldConfig.owner,
        oldConfig.repo,
        oldConfig.token,
        `${oldConfig.owner}/${oldConfig.repo}`
      );
      
      setActiveRepository(migratedRepo.id);
      
      // Remove old config
      localStorage.removeItem('unfold_repo_config');
      
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.error('Error migrating existing config:', error);
  }
}

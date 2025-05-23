
// User repositories service - simplified version that uses the existing repository config
import { getRepositoryConfig, saveRepositoryConfig, clearRepositoryConfig } from './repositoryConfig';

export interface UserRepository {
  id: string;
  owner: string;
  repo: string;
  token: string;
  nickname?: string;
  createdAt: string;
  lastUsed: string;
}

export function getUserRepositories(): UserRepository[] {
  const config = getRepositoryConfig();
  if (!config) return [];
  
  return [{
    id: 'current',
    owner: config.owner,
    repo: config.repo,
    token: config.token,
    nickname: undefined,
    createdAt: config.lastAccessed,
    lastUsed: config.lastAccessed
  }];
}

export function saveUserRepository(owner: string, repo: string, token: string, nickname?: string): UserRepository {
  saveRepositoryConfig({ owner, repo, token });
  
  return {
    id: 'current',
    owner,
    repo,
    token,
    nickname,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
}

export function removeUserRepository(id: string): void {
  clearRepositoryConfig();
}

export function getActiveRepository(): UserRepository | null {
  const repos = getUserRepositories();
  return repos.length > 0 ? repos[0] : null;
}

export function setActiveRepository(id: string): void {
  // Since we only support one repository, this is a no-op
}

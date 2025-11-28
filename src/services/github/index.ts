// Re-export all public APIs for backward compatibility

// Client functions
export { makeClient, makeApolloClient, purgeApolloCacheFiles, inspectCacheStatus } from './client';

// Repository operations
export {
  getViewerLogin,
  fetchViewerOrganizations,
  checkOrganizationIsEnterprise,
  fetchViewerReposPage,
  fetchViewerReposPageUnified,
  searchRepositoriesUnified,
  getStarredRepositories,
  fetchRepositoryById,
  getRepositoryFromCache,
  type Organization,
  type ReposPageResult,
  type OwnerAffiliation
} from './repositories';

// Mutation operations
export {
  archiveRepositoryById,
  unarchiveRepositoryById,
  changeRepositoryVisibility,
  renameRepositoryById,
  starRepository,
  unstarRepository
} from './mutations';

// REST API operations
export {
  deleteRepositoryRest,
  syncForkWithUpstream,
  fetchRestRateLimits
} from './rest';

// Cache operations
export {
  updateCacheAfterDelete,
  updateCacheAfterArchive,
  updateCacheAfterVisibilityChange,
  updateCacheAfterRename,
  updateCacheWithRepository
} from './cache';

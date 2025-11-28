/**
 * GitHub Service API - Public Interface
 *
 * This module provides a unified API for interacting with GitHub's GraphQL and REST APIs.
 * It includes repository operations, mutations, caching, and client management.
 *
 * @module services/github
 */

/**
 * Client factory functions for GitHub API communication
 * @see {@link ./client}
 */
export { makeClient, makeApolloClient, purgeApolloCacheFiles, inspectCacheStatus } from './client';

/**
 * Repository query operations
 * @see {@link ./repositories}
 */
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

/**
 * Repository mutation operations (archive, rename, visibility, star)
 * @see {@link ./mutations}
 */
export {
  archiveRepositoryById,
  unarchiveRepositoryById,
  changeRepositoryVisibility,
  renameRepositoryById,
  starRepository,
  unstarRepository
} from './mutations';

/**
 * REST API operations (delete, fork sync, rate limits)
 * @see {@link ./rest}
 */
export {
  deleteRepositoryRest,
  syncForkWithUpstream,
  fetchRestRateLimits
} from './rest';

/**
 * Apollo cache management operations
 * @see {@link ./cache}
 */
export {
  updateCacheAfterDelete,
  updateCacheAfterArchive,
  updateCacheAfterVisibilityChange,
  updateCacheAfterRename,
  updateCacheWithRepository
} from './cache';

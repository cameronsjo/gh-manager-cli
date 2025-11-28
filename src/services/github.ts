// This file is now a re-export barrel for backward compatibility
// The implementation has been refactored into focused modules in ./github/

export {
  // Client functions
  makeClient,
  makeApolloClient,
  purgeApolloCacheFiles,
  inspectCacheStatus,

  // Repository operations
  getViewerLogin,
  fetchViewerOrganizations,
  checkOrganizationIsEnterprise,
  fetchViewerReposPage,
  fetchViewerReposPageUnified,
  searchRepositoriesUnified,
  getStarredRepositories,
  fetchRepositoryById,
  getRepositoryFromCache,

  // Mutation operations
  archiveRepositoryById,
  unarchiveRepositoryById,
  changeRepositoryVisibility,
  renameRepositoryById,
  starRepository,
  unstarRepository,

  // REST API operations
  deleteRepositoryRest,
  syncForkWithUpstream,
  fetchRestRateLimits,

  // Cache operations
  updateCacheAfterDelete,
  updateCacheAfterArchive,
  updateCacheAfterVisibilityChange,
  updateCacheAfterRename,
  updateCacheWithRepository,

  // Types
  type Organization,
  type ReposPageResult,
  type OwnerAffiliation
} from './github/index';

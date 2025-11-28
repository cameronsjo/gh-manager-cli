import type { RepoNode } from '../../types';
import { logger } from '../../lib/logger';
import { makeApolloClient } from './client';

/**
 * Updates Apollo cache after repository deletion
 *
 * Evicts the deleted repository from the cache and runs garbage collection
 * to remove any dangling references. Fails silently if Apollo Client is unavailable.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repositoryId - GitHub node ID of the deleted repository (format: "R_...")
 * @returns Promise that resolves when cache is updated
 * @example
 * ```typescript
 * await deleteRepositoryRest(token, owner, repo);
 * await updateCacheAfterDelete(token, repositoryId);
 * ```
 */
export async function updateCacheAfterDelete(token: string, repositoryId: string): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;

    // Evict the repository from cache
    ap.client.cache.evict({ id: `Repository:${repositoryId}` });
    ap.client.cache.gc();
  } catch (error) {
    logger.debug('Failed to update cache after delete', { error, repositoryId });
  }
}

/**
 * Updates Apollo cache after repository archive/unarchive operation
 *
 * Modifies the isArchived field in the cached repository data without refetching.
 * Fails silently if Apollo Client is unavailable.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param isArchived - New archived status (true for archived, false for unarchived)
 * @returns Promise that resolves when cache is updated
 * @example
 * ```typescript
 * await archiveRepositoryById(client, repositoryId);
 * await updateCacheAfterArchive(token, repositoryId, true);
 * ```
 */
export async function updateCacheAfterArchive(token: string, repositoryId: string, isArchived: boolean): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;

    // Update the isArchived field in cache
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        isArchived: () => isArchived
      }
    });
  } catch (error) {
    logger.debug('Failed to update cache after archive', { error, repositoryId, isArchived });
  }
}

/**
 * Updates Apollo cache after repository visibility change
 *
 * Modifies both visibility and isPrivate fields in the cached repository data.
 * Note that INTERNAL repositories are not considered private in the traditional sense.
 * Fails silently if Apollo Client is unavailable.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param visibility - New visibility setting (PUBLIC, PRIVATE, or INTERNAL)
 * @returns Promise that resolves when cache is updated
 * @example
 * ```typescript
 * await changeRepositoryVisibility(client, repositoryId, 'PRIVATE', token);
 * await updateCacheAfterVisibilityChange(token, repositoryId, 'PRIVATE');
 * ```
 */
export async function updateCacheAfterVisibilityChange(token: string, repositoryId: string, visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL'): Promise<void> {
  logger.info('Updating cache after repository visibility change', {
    repositoryId,
    visibility
  });

  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;

    // Update both visibility and isPrivate fields in cache
    // Note: Internal repos are not private in the traditional sense
    const isPrivate = visibility === 'PRIVATE';
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        visibility: () => visibility,
        isPrivate: () => isPrivate
      }
    });
  } catch (error) {
    logger.debug('Failed to update cache after visibility change', { error, repositoryId, visibility });
  }
}

/**
 * Updates Apollo cache after repository rename operation
 *
 * Modifies both name and nameWithOwner fields in the cached repository data.
 * Fails silently if Apollo Client is unavailable.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param newName - New repository name (without owner prefix)
 * @param nameWithOwner - New full repository name (format: "owner/repo")
 * @returns Promise that resolves when cache is updated
 * @example
 * ```typescript
 * await renameRepositoryById(client, repositoryId, 'new-name');
 * await updateCacheAfterRename(token, repositoryId, 'new-name', 'owner/new-name');
 * ```
 */
export async function updateCacheAfterRename(
  token: string,
  repositoryId: string,
  newName: string,
  nameWithOwner: string
): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;

    // Update the repository in cache
    ap.client.cache.modify({
      id: `Repository:${repositoryId}`,
      fields: {
        name: () => newName,
        nameWithOwner: () => nameWithOwner
      }
    });
  } catch (error) {
    logger.debug('Failed to update cache after rename', { error, repositoryId, newName, nameWithOwner });
  }
}

/**
 * Writes or updates a complete repository object in Apollo cache
 *
 * Writes a full repository fragment to the cache, useful for updating cache
 * after fetching fresh data from the API. Fails silently if Apollo Client is unavailable.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repository - Complete repository object to write to cache
 * @returns Promise that resolves when cache is updated
 * @example
 * ```typescript
 * const repo = await fetchRepositoryById(client, repositoryId);
 * if (repo) {
 *   await updateCacheWithRepository(token, repo);
 * }
 * ```
 */
export async function updateCacheWithRepository(token: string, repository: RepoNode): Promise<void> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return;

    // Write the updated repository data to cache
    ap.client.cache.writeFragment({
      id: `Repository:${repository.id}`,
      fragment: ap.gql`
        fragment UpdatedRepository on Repository {
          id
          name
          nameWithOwner
          description
          url
          pushedAt
          updatedAt
          isPrivate
          isArchived
          isFork
          stargazerCount
          forkCount
          diskUsage
          primaryLanguage {
            name
            color
          }
          parent {
            nameWithOwner
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }
          }
          defaultBranchRef {
            name
            target {
              ... on Commit {
                history(first: 0) {
                  totalCount
                }
              }
            }
          }
        }
      `,
      data: repository
    });
  } catch (error) {
    logger.debug('Failed to update cache with repository', { error, repositoryId: repository.id });
  }
}

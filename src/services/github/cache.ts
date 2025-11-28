import type { RepoNode } from '../../types';
import { logger } from '../../lib/logger';
import { makeApolloClient } from './client';

// Cache update functions
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

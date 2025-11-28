import { logger } from '../../lib/logger';
import { makeClient } from './client';
import { GET_REPO_DETAILS_QUERY } from './queries';

/**
 * Archives a repository by its GitHub node ID
 *
 * Archived repositories are read-only. Users can view and fork the repository,
 * but cannot push to it or open new issues/pull requests.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @returns Promise that resolves when the repository is archived
 * @throws {Error} If the mutation fails or user lacks permissions
 * @example
 * ```typescript
 * const client = makeClient(token);
 * await archiveRepositoryById(client, 'R_kgDOAbCdEf');
 * console.log('Repository archived successfully');
 * ```
 */
export async function archiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Archiving repository', {
    repositoryId
  });

  const mutation = /* GraphQL */ `
    mutation ArchiveRepo($repositoryId: ID!) {
      archiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully archived repository', {
      repositoryId
    });
  } catch (error: any) {
    logger.error('Failed to archive repository', {
      repositoryId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Unarchives a previously archived repository by its GitHub node ID
 *
 * Restores full repository functionality, allowing pushes, issues, and pull requests.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @returns Promise that resolves when the repository is unarchived
 * @throws {Error} If the mutation fails or user lacks permissions
 * @example
 * ```typescript
 * const client = makeClient(token);
 * await unarchiveRepositoryById(client, 'R_kgDOAbCdEf');
 * console.log('Repository unarchived successfully');
 * ```
 */
export async function unarchiveRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string
): Promise<void> {
  logger.info('Unarchiving repository', {
    repositoryId
  });

  const mutation = /* GraphQL */ `
    mutation UnarchiveRepo($repositoryId: ID!) {
      unarchiveRepository(input: { repositoryId: $repositoryId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { repositoryId });
    logger.info('Successfully unarchived repository', {
      repositoryId
    });
  } catch (error: any) {
    logger.error('Failed to unarchive repository', {
      repositoryId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Changes repository visibility (public, private, or internal)
 *
 * Uses GitHub REST API as GraphQL doesn't support visibility changes.
 * INTERNAL visibility is only available for repositories in GitHub Enterprise organizations.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param visibility - Target visibility: PUBLIC, PRIVATE, or INTERNAL
 * @param token - GitHub personal access token (required for REST API call)
 * @returns Promise resolving to object containing the repository's nameWithOwner
 * @throws {Error} If repository not found, user lacks permissions, or API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const result = await changeRepositoryVisibility(
 *   client,
 *   'R_kgDOAbCdEf',
 *   'PRIVATE',
 *   token
 * );
 * console.log(`Changed visibility for ${result.nameWithOwner}`);
 * ```
 */
export async function changeRepositoryVisibility(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL',
  token: string
): Promise<{ nameWithOwner: string }> {
  // First, get the repository details to get the owner and name
  const result: any = await client(GET_REPO_DETAILS_QUERY, { id: repositoryId });
  const repo = result.node;

  if (!repo || !repo.nameWithOwner) {
    throw new Error('Repository not found');
  }

  const [owner, name] = repo.nameWithOwner.split('/');

  // Use REST API to change visibility since GraphQL doesn't support it
  // Use the visibility field directly (supports public, private, internal)
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'gh-manager-cli'
    },
    body: JSON.stringify({
      visibility: visibility.toLowerCase() // API expects lowercase
    })
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to change repository visibility', {
      status: response.status,
      statusText: response.statusText,
      error,
      owner,
      name,
      visibility
    });
    throw new Error(`Failed to change visibility: ${error}`);
  }

  logger.info('Successfully changed repository visibility', {
    owner,
    name,
    newVisibility: visibility,
    nameWithOwner: repo.nameWithOwner
  });

  return { nameWithOwner: repo.nameWithOwner };
}

/**
 * Renames a repository by its GitHub node ID
 *
 * Changes the repository name while preserving the owner. GitHub automatically
 * sets up redirects from the old name to the new name.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param newName - New repository name (without owner prefix)
 * @returns Promise that resolves when the repository is renamed
 * @throws {Error} If the mutation fails, name is taken, or user lacks permissions
 * @example
 * ```typescript
 * const client = makeClient(token);
 * await renameRepositoryById(client, 'R_kgDOAbCdEf', 'my-new-repo-name');
 * console.log('Repository renamed successfully');
 * ```
 */
export async function renameRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  newName: string
): Promise<void> {
  logger.info('Renaming repository', {
    repositoryId,
    newName
  });

  const mutation = /* GraphQL */ `
    mutation RenameRepo($repositoryId: ID!, $name: String!) {
      updateRepository(input: { repositoryId: $repositoryId, name: $name }) {
        repository {
          id
          name
          nameWithOwner
        }
      }
    }
  `;

  try {
    const result: any = await client(mutation, { repositoryId, name: newName });

    logger.info('Repository renamed successfully', {
      repositoryId,
      newName: result?.updateRepository?.repository?.name
    });
  } catch (error: any) {
    logger.error('Failed to rename repository', {
      repositoryId,
      newName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Stars a repository
 *
 * Adds the repository to the authenticated user's starred repositories list.
 * Stars are used to show appreciation and bookmark repositories.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param starrableId - GitHub node ID of the repository (format: "R_...")
 * @returns Promise that resolves when the repository is starred
 * @throws {Error} If the mutation fails or repository not found
 * @example
 * ```typescript
 * const client = makeClient(token);
 * await starRepository(client, 'R_kgDOAbCdEf');
 * console.log('Repository starred successfully');
 * ```
 */
export async function starRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Starring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation StarRepo($starrableId: ID!) {
      addStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully starred repository', {
      starrableId
    });
  } catch (error: any) {
    logger.error('Failed to star repository', {
      starrableId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Unstars a repository
 *
 * Removes the repository from the authenticated user's starred repositories list.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param starrableId - GitHub node ID of the repository (format: "R_...")
 * @returns Promise that resolves when the repository is unstarred
 * @throws {Error} If the mutation fails or repository not found
 * @example
 * ```typescript
 * const client = makeClient(token);
 * await unstarRepository(client, 'R_kgDOAbCdEf');
 * console.log('Repository unstarred successfully');
 * ```
 */
export async function unstarRepository(
  client: ReturnType<typeof makeClient>,
  starrableId: string
): Promise<void> {
  logger.info('Unstarring repository', {
    starrableId
  });

  const mutation = /* GraphQL */ `
    mutation UnstarRepo($starrableId: ID!) {
      removeStar(input: { starrableId: $starrableId }) {
        clientMutationId
      }
    }
  `;

  try {
    await client(mutation, { starrableId });
    logger.info('Successfully unstarred repository', {
      starrableId
    });
  } catch (error: any) {
    logger.error('Failed to unstar repository', {
      starrableId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

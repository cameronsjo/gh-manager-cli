import type { RestRateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';

/**
 * Deletes a repository using GitHub REST API
 *
 * Permanently deletes a repository. This action is irreversible and cannot be undone.
 * GraphQL does not support repository deletion, so REST API is required.
 *
 * @param token - GitHub personal access token with delete_repo scope
 * @param owner - Repository owner username or organization name
 * @param repo - Repository name (without owner prefix)
 * @returns Promise that resolves when repository is deleted (HTTP 204)
 * @throws {Error} If deletion fails, user lacks permissions, or repository not found
 * @example
 * ```typescript
 * await deleteRepositoryRest(token, 'octocat', 'hello-world');
 * console.log('Repository deleted successfully');
 * ```
 */
export async function deleteRepositoryRest(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  logger.info('Deleting repository', {
    owner,
    repo,
    url
  });

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'gh-manager-cli'
    }
  } as any);

  if (res.status === 204) {
    logger.info('Successfully deleted repository', {
      owner,
      repo,
      status: res.status
    });
    return; // No Content = success
  }

  let msg = `GitHub REST delete failed (status ${res.status})`;
  try {
    const body: any = await res.json();
    if (body && body.message) msg += `: ${body.message}`;
  } catch {
    // ignore
  }

  logger.error('Failed to delete repository', {
    status: res.status,
    error: msg,
    owner,
    repo
  });

  throw new Error(msg);
}

/**
 * Syncs a forked repository with its upstream parent
 *
 * Merges commits from the upstream repository's default branch into the fork's branch.
 * Returns different status codes based on sync result: 200 for successful merge,
 * 204 if already up-to-date, 409 for conflicts, 422 if branch cannot be synced.
 *
 * @param token - GitHub personal access token
 * @param owner - Fork owner username or organization name
 * @param repo - Fork repository name (without owner prefix)
 * @param branch - Target branch to sync (defaults to 'main')
 * @returns Promise resolving to sync result with message and merge type
 * @throws {Error} If sync fails due to conflicts, invalid branch, or API error
 * @example
 * ```typescript
 * const result = await syncForkWithUpstream(token, 'octocat', 'my-fork', 'main');
 * console.log(`Sync result: ${result.message}`);
 * ```
 */
export async function syncForkWithUpstream(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<{ message: string; merge_type: string; base_branch: string }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/merge-upstream`;

  logger.info('Syncing fork with upstream', {
    owner,
    repo,
    branch,
    url
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'gh-manager-cli'
    },
    body: JSON.stringify({ branch })
  } as any);

  if (res.status === 204) {
    // Already up to date
    logger.info('Fork already up-to-date with upstream', {
      owner,
      repo,
      branch,
      status: res.status
    });
    return { message: 'Already up-to-date', merge_type: 'none', base_branch: branch };
  }

  if (res.status === 200) {
    const body: any = await res.json();
    logger.info('Successfully synced fork with upstream', {
      owner,
      repo,
      branch,
      status: res.status,
      mergeType: body.merge_type,
      message: body.message
    });
    return body as { message: string; merge_type: string; base_branch: string };
  }

  let msg = `Fork sync failed (status ${res.status})`;
  try {
    const body: any = await res.json();
    if (body && body.message) {
      msg += `: ${body.message}`;
      if (res.status === 409) {
        msg += ' (conflicts detected - manual merge required)';
      }
      if (res.status === 422) {
        msg += ' (branch could not be synced)';
      }
    }
  } catch {
    // ignore
  }

  logger.error('Failed to sync fork with upstream', {
    status: res.status,
    error: msg,
    owner,
    repo,
    branch
  });

  throw new Error(msg);
}

/**
 * Fetches current GitHub REST and GraphQL API rate limit information
 *
 * Returns rate limit data for both core REST API and GraphQL API endpoints,
 * including remaining requests and reset timestamps.
 *
 * @param token - GitHub personal access token or OAuth token
 * @returns Promise resolving to rate limit info for both APIs, or null if request fails
 * @example
 * ```typescript
 * const limits = await fetchRestRateLimits(token);
 * if (limits) {
 *   console.log(`GraphQL: ${limits.graphql.remaining}/${limits.graphql.limit}`);
 *   console.log(`REST: ${limits.core.remaining}/${limits.core.limit}`);
 * }
 * ```
 */
export async function fetchRestRateLimits(token: string): Promise<RestRateLimitInfo | null> {
  try {
    logger.debug('Fetching REST API rate limits');

    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'gh-manager-cli'
      }
    });

    if (!response.ok) {
      logger.error('Failed to fetch REST rate limits', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data: any = await response.json();

    logger.debug('Successfully fetched REST rate limits', {
      core: data.resources?.core,
      graphql: data.resources?.graphql
    });

    return {
      core: data.resources?.core || { limit: 0, remaining: 0, reset: 0 },
      graphql: data.resources?.graphql || { limit: 0, remaining: 0, reset: 0 }
    };
  } catch (error: any) {
    logger.error('Error fetching REST rate limits', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

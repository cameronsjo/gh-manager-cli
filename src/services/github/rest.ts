import type { RestRateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';

// GitHub GraphQL does not support deleting repos. Use REST: DELETE /repos/{owner}/{repo}
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

// Fetch REST API rate limits
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

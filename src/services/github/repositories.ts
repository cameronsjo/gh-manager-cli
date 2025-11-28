import type { RepoNode, RateLimitInfo } from '../../types';
import { logger } from '../../lib/logger';
import { makeClient, makeApolloClient } from './client';
import {
  VIEWER_LOGIN_QUERY,
  VIEWER_ORGANIZATIONS_QUERY,
  CHECK_ORG_ENTERPRISE_QUERY,
  VIEWER_REPOS_QUERY,
  ORG_REPOS_QUERY,
  STARRED_REPOS_QUERY,
  SEARCH_REPOS_QUERY,
  GET_REPOSITORY_BY_ID_QUERY
} from './queries';

/**
 * Represents a GitHub organization
 */
export interface Organization {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  isEnterprise?: boolean;
}

/**
 * Result of a paginated repository query
 */
export interface ReposPageResult {
  nodes: RepoNode[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit?: RateLimitInfo;
}

/**
 * Types of repository ownership affiliation for filtering
 */
export type OwnerAffiliation = 'OWNER' | 'COLLABORATOR' | 'ORGANIZATION_MEMBER';

/**
 * Fetches the authenticated user's GitHub login username
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @returns Promise resolving to the viewer's login username
 * @throws {Error} If authentication fails or API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const login = await getViewerLogin(client);
 * console.log(`Logged in as: ${login}`);
 * ```
 */
export async function getViewerLogin(
  client: ReturnType<typeof makeClient>
): Promise<string> {
  try {
    logger.debug('Fetching viewer login');
    const res: any = await client(VIEWER_LOGIN_QUERY);
    logger.info(`Successfully fetched viewer login: ${res.viewer.login}`);
    return res.viewer.login as string;
  } catch (error: any) {
    logger.error('Failed to fetch viewer login', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Fetches all organizations the authenticated user belongs to
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @returns Promise resolving to array of organizations
 * @throws {Error} If API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const orgs = await fetchViewerOrganizations(client);
 * orgs.forEach(org => console.log(org.login));
 * ```
 */
export async function fetchViewerOrganizations(
  client: ReturnType<typeof makeClient>
): Promise<Organization[]> {
  const res: any = await client(VIEWER_ORGANIZATIONS_QUERY);
  return res.viewer.organizations.nodes as Organization[];
}

/**
 * Checks if an organization is part of a GitHub Enterprise
 *
 * Determines enterprise status by checking for the presence of enterprise owners.
 * Returns false if the query fails or the organization is not enterprise.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param orgLogin - Organization login name to check
 * @returns Promise resolving to true if organization is enterprise, false otherwise
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const isEnterprise = await checkOrganizationIsEnterprise(client, 'my-org');
 * console.log(`Enterprise: ${isEnterprise}`);
 * ```
 */
export async function checkOrganizationIsEnterprise(
  client: ReturnType<typeof makeClient>,
  orgLogin: string
): Promise<boolean> {
  logger.info('Checking if organization is enterprise', {
    orgLogin
  });

  try {
    // The most reliable way to check if an org is enterprise is to check if it has enterpriseOwners
    // This field is only present and returns data for organizations that belong to an enterprise
    const res: any = await client(CHECK_ORG_ENTERPRISE_QUERY, { orgLogin });

    // If the organization has enterprise owners, it's part of an enterprise
    // The field will return null or throw an error for non-enterprise orgs
    const isEnterprise = res.organization?.enterpriseOwners?.totalCount > 0;

    logger.info('Organization enterprise status checked', {
      orgLogin,
      isEnterprise
    });

    return isEnterprise;
  } catch (error) {
    // If the query fails, it's likely not an enterprise org
    return false;
  }
}

/**
 * Fetches a page of repositories using Octokit GraphQL client
 *
 * Supports both personal and organization repository queries with flexible filtering
 * and sorting options. Can optionally include fork tracking information.
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param first - Number of repositories to fetch per page
 * @param after - Cursor for pagination (from previous query's endCursor)
 * @param orderBy - Sort configuration with field and direction
 * @param includeForkTracking - Whether to include detailed fork commit tracking data
 * @param ownerAffiliations - Filter by repository affiliation types
 * @param organizationLogin - Optional organization login for org-specific queries
 * @param privacy - Filter by repository visibility (PUBLIC or PRIVATE)
 * @returns Promise resolving to paginated repository results
 * @throws {Error} If API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const result = await fetchViewerReposPage(
 *   client,
 *   15,
 *   null,
 *   { field: 'UPDATED_AT', direction: 'DESC' }
 * );
 * console.log(`Fetched ${result.nodes.length} repositories`);
 * ```
 */
export async function fetchViewerReposPage(
  client: ReturnType<typeof makeClient>,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true,
  ownerAffiliations: OwnerAffiliation[] = ['OWNER'],
  organizationLogin?: string,
  privacy?: 'PUBLIC' | 'PRIVATE'
): Promise<ReposPageResult> {
  logger.debug('Using Octokit client for fetching repos', {
    first,
    after,
    organizationLogin,
    privacy
  });
  // Default to UPDATED_AT DESC if not specified
  const sortField = orderBy?.field || 'UPDATED_AT';
  const sortDirection = orderBy?.direction || 'DESC';

  // Build GraphQL query conditionally based on fork tracking preference and context (personal vs org)
  const isOrgContext = !!organizationLogin;

  // For organization context
  if (isOrgContext) {
    const query = /* GraphQL */ `
      query OrgRepos(
        $first: Int!
        $after: String
        $sortField: RepositoryOrderField!
        $sortDirection: OrderDirection!
        $orgLogin: String!
        $privacy: RepositoryPrivacy
      ) {
        rateLimit {
          limit
          remaining
          resetAt
        }
        organization(login: $orgLogin) {
          repositories(
            first: $first
            after: $after
            orderBy: { field: $sortField, direction: $sortDirection }
            privacy: $privacy
          ) {
            totalCount
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              id
              name
              nameWithOwner
              description
              visibility
              isPrivate
              isFork
              isArchived
              stargazerCount
              forkCount
              viewerHasStarred
              primaryLanguage {
                name
                color
              }
              updatedAt
              pushedAt
              diskUsage
              owner {
                __typename
                login
              }
              ${includeForkTracking ? `
              parent {
                nameWithOwner
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
              defaultBranchRef {
                name
                target {
                  ... on Commit {
                    history(first: 0) {
                      totalCount
                    }
                  }
                }
              }` : `
              parent {
                nameWithOwner
              }
              defaultBranchRef { name }
              `}
            }
          }
        }
      }
    `;

    const res: any = await client(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      orgLogin: organizationLogin,
      privacy: privacy ?? null,
    });

    const data = res.organization.repositories;
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
    };
  }

  // For personal context (viewer's repositories)
  const query = /* GraphQL */ `
    query ViewerRepos(
      $first: Int!
      $after: String
      $sortField: RepositoryOrderField!
      $sortDirection: OrderDirection!
      $affiliations: [RepositoryAffiliation!]!
      $privacy: RepositoryPrivacy
    ) {
      rateLimit {
        limit
        remaining
        resetAt
      }
      viewer {
        repositories(
          ownerAffiliations: $affiliations
          first: $first
          after: $after
          orderBy: { field: $sortField, direction: $sortDirection }
          privacy: $privacy
        ) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            id
            name
            nameWithOwner
            description
            visibility
            isPrivate
            isFork
            isArchived
            stargazerCount
            forkCount
            primaryLanguage {
              name
              color
            }
            updatedAt
            pushedAt
            diskUsage
            ${includeForkTracking ? `
            parent {
              nameWithOwner
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
            defaultBranchRef {
              name
              target {
                ... on Commit {
                  history(first: 0) {
                    totalCount
                  }
                }
              }
            }` : `
            parent {
              nameWithOwner
            }
            defaultBranchRef { name }
            `}
          }
        }
      }
    }
  `;

  try {
    const res: any = await client(query, {
      first,
      after: after ?? null,
      sortField,
      sortDirection,
      affiliations: ownerAffiliations,
      privacy: privacy ?? null,
    });

    const data = res.viewer.repositories;
    logger.info(`Octokit successfully fetched ${data.nodes.length} repositories`);
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
    };
  } catch (error: any) {
    logger.error('Octokit query failed', {
      error: error.message,
      stack: error.stack,
      status: error.status,
      response: error.response
    });
    throw error;
  }
}

/**
 * Unified entry point for fetching repositories with automatic client selection
 *
 * Attempts to use Apollo Client with caching first, falling back to Octokit if Apollo fails.
 * This is the recommended function for fetching repositories as it provides caching and
 * performance benefits.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param first - Number of repositories to fetch per page
 * @param after - Cursor for pagination (from previous query's endCursor)
 * @param orderBy - Sort configuration with field and direction
 * @param includeForkTracking - Whether to include detailed fork commit tracking data
 * @param fetchPolicy - Apollo cache policy: 'cache-first' or 'network-only'
 * @param ownerAffiliations - Filter by repository affiliation types
 * @param organizationLogin - Optional organization login for org-specific queries
 * @param privacy - Filter by repository visibility (PUBLIC or PRIVATE)
 * @returns Promise resolving to paginated repository results with rate limit info
 * @throws {Error} If both Apollo and Octokit clients fail
 * @example
 * ```typescript
 * const result = await fetchViewerReposPageUnified(
 *   token,
 *   15,
 *   null,
 *   { field: 'UPDATED_AT', direction: 'DESC' },
 *   true,
 *   'cache-first'
 * );
 * console.log(`Fetched ${result.nodes.length} of ${result.totalCount} repos`);
 * ```
 */
export async function fetchViewerReposPageUnified(
  token: string,
  first: number,
  after?: string | null,
  orderBy?: { field: string; direction: string },
  includeForkTracking: boolean = true,
  fetchPolicy: 'cache-first' | 'network-only' = 'cache-first',
  ownerAffiliations: OwnerAffiliation[] = ['OWNER'],
  organizationLogin?: string,
  privacy?: 'PUBLIC' | 'PRIVATE'
): Promise<ReposPageResult> {
  const isApolloEnabled = true; // Apollo is the default, with Octokit as fallback
  const debug = process.env.GH_MANAGER_DEBUG === '1';
  const isOrgContext = !!organizationLogin;

  logger.info('Fetching repositories', {
    fetchPolicy,
    isOrgContext,
    organizationLogin,
    first,
    after,
    privacy,
    ownerAffiliations
  });

  if (debug) {
    console.log(`🔍 Apollo enabled: ${isApolloEnabled}, Policy: ${fetchPolicy}, After: ${after || 'null'}, Context: ${isOrgContext ? 'Organization' : 'Personal'}`);
  }

  try {
    if (isApolloEnabled) {
      if (debug) console.log('🚀 Attempting Apollo Client...');
      logger.debug('Attempting to use Apollo Client');
      const ap = await makeApolloClient(token);
      const sortField = (orderBy?.field || 'UPDATED_AT');
      const sortDirection = (orderBy?.direction || 'DESC');

      // Different query based on context (personal vs organization)
      let q;
      let variables: any = { first, after: after ?? null, sortField, sortDirection, privacy: privacy ?? null };

      if (isOrgContext) {
        // Organization context
        variables.orgLogin = organizationLogin;
        q = (ap.gql as any)`
          query OrgRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $orgLogin: String!, $privacy: RepositoryPrivacy) {
            rateLimit { limit remaining resetAt }
            organization(login: $orgLogin) {
              repositories(first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }, privacy: $privacy) {
                totalCount
                pageInfo { endCursor hasNextPage }
                nodes {
                  id
                  name
                  nameWithOwner
                  description
                  visibility
                  isPrivate
                  isFork
                  isArchived
                  stargazerCount
                  forkCount
                  viewerHasStarred
                  owner { __typename login }
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  ${includeForkTracking ? `
                  parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
                  defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
                  parent { nameWithOwner }
                  defaultBranchRef { name }`}
                }
              }
            }
          }
        `;
      } else {
        // Personal context
        variables.affiliations = ownerAffiliations;
        q = (ap.gql as any)`
          query ViewerRepos($first: Int!, $after: String, $sortField: RepositoryOrderField!, $sortDirection: OrderDirection!, $affiliations: [RepositoryAffiliation!]!, $privacy: RepositoryPrivacy) {
            rateLimit { limit remaining resetAt }
            viewer {
              repositories(ownerAffiliations: $affiliations, first: $first, after: $after, orderBy: { field: $sortField, direction: $sortDirection }, privacy: $privacy) {
                totalCount
                pageInfo { endCursor hasNextPage }
                nodes {
                  id
                  name
                  nameWithOwner
                  description
                  visibility
                  isPrivate
                  isFork
                  isArchived
                  stargazerCount
                  forkCount
                  viewerHasStarred
                  owner { __typename login }
                  primaryLanguage { name color }
                  updatedAt
                  pushedAt
                  diskUsage
                  ${includeForkTracking ? `
                  parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
                  defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
                  parent { nameWithOwner }
                  defaultBranchRef { name }`}
                }
              }
            }
          }
        `;
      }

      const startTime = Date.now();
      logger.debug('Executing Apollo query', { variables });
      const res = await ap.client.query({
        query: q,
        variables,
        fetchPolicy,
      });
      const duration = Date.now() - startTime;

      logger.info(`Apollo query completed in ${duration}ms`, {
        duration,
        fromCache: res.loading === false && duration < 50,
        networkStatus: res.networkStatus
      });

      if (debug) {
        console.log(`⚡ Apollo query completed in ${duration}ms`);
        console.log(`📊 From cache: ${res.loading === false && duration < 50 ? 'YES' : 'NO'}`);
        console.log(`🔄 Network status: ${res.networkStatus}`);
      }

      // Extract data based on context
      const data = isOrgContext
        ? res.data.organization.repositories
        : res.data.viewer.repositories;

      logger.info(`Successfully fetched ${data.nodes.length} repositories`, {
        totalCount: data.totalCount,
        hasNextPage: data.pageInfo.hasNextPage
      });

      return {
        nodes: data.nodes as RepoNode[],
        endCursor: data.pageInfo.endCursor,
        hasNextPage: data.pageInfo.hasNextPage,
        totalCount: data.totalCount,
        rateLimit: res.data.rateLimit as RateLimitInfo,
      };
    }
  } catch (e: any) {
    logger.error('Apollo query failed', {
      error: e.message,
      stack: e.stack,
      graphQLErrors: e.graphQLErrors,
      networkError: e.networkError
    });
    if (debug) console.log(`❌ Apollo failed, falling back to Octokit:`, e.message);
    // Fallback to Octokit path if Apollo not available
  }

  logger.warn('Falling back to Octokit client');
  if (debug) console.log('📡 Using Octokit fallback...');
  const octo = makeClient(token);
  return fetchViewerReposPage(octo, first, after, orderBy, includeForkTracking, ownerAffiliations, organizationLogin, privacy);
}

/**
 * Searches repositories using GitHub's search API with Apollo Client
 *
 * Performs server-side search across repository names and descriptions. Supports both
 * personal and organization contexts. Uses network-only fetch policy by default for
 * up-to-date search results.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param viewer - Authenticated user's login name
 * @param text - Search query text to match against repo names and descriptions
 * @param first - Number of repositories to fetch per page
 * @param after - Cursor for pagination (from previous query's endCursor)
 * @param sortKey - Sort field (not used by GitHub Search API but kept for compatibility)
 * @param sortDir - Sort direction (not used by GitHub Search API but kept for compatibility)
 * @param includeForkTracking - Whether to include detailed fork commit tracking data
 * @param fetchPolicy - Apollo cache policy: 'network-only' or 'cache-first'
 * @param organizationLogin - Optional organization login to scope search to org repos
 * @returns Promise resolving to paginated search results with rate limit info
 * @throws {Error} If search query fails or Apollo Client encounters an error
 * @example
 * ```typescript
 * const results = await searchRepositoriesUnified(
 *   token,
 *   'octocat',
 *   'machine learning',
 *   15,
 *   null,
 *   'UPDATED_AT',
 *   'DESC',
 *   true,
 *   'network-only',
 *   'my-org'
 * );
 * console.log(`Found ${results.totalCount} repositories`);
 * ```
 */
export async function searchRepositoriesUnified(
  token: string,
  viewer: string,
  text: string,
  first: number,
  after?: string | null,
  sortKey: string = 'UPDATED_AT',
  sortDir: string = 'DESC',
  includeForkTracking: boolean = true,
  fetchPolicy: 'network-only' | 'cache-first' = 'network-only',
  organizationLogin?: string
): Promise<ReposPageResult> {
  // GitHub search API doesn't support sort in query string - remove it
  // Include forks in search results with fork:true
  // Use org: for organization context, user: for personal context
  const searchContext = organizationLogin ? `org:${organizationLogin}` : `user:${viewer}`;
  const q = `${text} ${searchContext} in:name,description fork:true`;


  try {
    const ap = await makeApolloClient(token);
    const queryDoc = (ap.gql as any)`
      query SearchRepos($q: String!, $first: Int!, $after: String) {
        rateLimit { limit remaining resetAt }
        search(query: $q, type: REPOSITORY, first: $first, after: $after) {
          repositoryCount
          pageInfo { endCursor hasNextPage }
          nodes {
            ... on Repository {
              id
              name
              nameWithOwner
              description
              visibility
              isPrivate
              isFork
              isArchived
              stargazerCount
              forkCount
              viewerHasStarred
              owner { __typename login }
              primaryLanguage { name color }
              updatedAt
              pushedAt
              diskUsage
              ${includeForkTracking ? `
              parent { nameWithOwner defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } } }
              defaultBranchRef { name target { ... on Commit { history(first: 0) { totalCount } } } }` : `
              parent { nameWithOwner }
              defaultBranchRef { name }`}
            }
          }
        }
      }
    `;
    const res = await ap.client.query({
      query: queryDoc,
      variables: { q, first, after: after ?? null },
      fetchPolicy,
    });
    const data = res.data.search;
    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.repositoryCount,
      rateLimit: res.data.rateLimit as RateLimitInfo,
    };
  } catch (e: any) {
    // Log errors to stderr only in debug mode
    const debug = process.env.GH_MANAGER_DEBUG === '1';
    if (debug) {
      process.stderr.write(`\n❌ Search failed: ${e.message}\n`);
      if (e.graphQLErrors) {
        process.stderr.write(`GraphQL errors: ${JSON.stringify(e.graphQLErrors, null, 2)}\n`);
      }
      if (e.networkError) {
        process.stderr.write(`Network error: ${e.networkError.message}\n`);
      }
    }
    // Re-throw the error so we can see it in the UI
    throw e;
  }
}

/**
 * Fetches repositories starred by the authenticated user
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param first - Number of starred repositories to fetch per page
 * @param after - Cursor for pagination (from previous query's endCursor)
 * @returns Promise resolving to paginated starred repository results
 * @throws {Error} If API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const starred = await getStarredRepositories(client, 20);
 * console.log(`You have starred ${starred.totalCount} repositories`);
 * starred.nodes.forEach(repo => console.log(repo.nameWithOwner));
 * ```
 */
export async function getStarredRepositories(
  client: ReturnType<typeof makeClient>,
  first: number,
  after?: string
): Promise<{
  nodes: RepoNode[];
  endCursor?: string;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit: RateLimitInfo;
}> {
  logger.info('Fetching starred repositories', {
    first,
    after
  });

  try {
    const res: any = await client(STARRED_REPOS_QUERY, {
      first,
      after: after ?? null,
    });

    const data = res.viewer.starredRepositories;

    logger.info('Successfully fetched starred repositories', {
      count: data.nodes?.length || 0,
      totalCount: data.totalCount
    });

    return {
      nodes: data.nodes as RepoNode[],
      endCursor: data.pageInfo.endCursor,
      hasNextPage: data.pageInfo.hasNextPage,
      totalCount: data.totalCount,
      rateLimit: res.rateLimit as RateLimitInfo,
    };
  } catch (error: any) {
    logger.error('Failed to fetch starred repositories', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Fetches a single repository by its GitHub node ID
 *
 * @param client - GitHub GraphQL client instance created by makeClient
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @param includeForkTracking - Whether to include detailed fork commit tracking data
 * @returns Promise resolving to repository data or null if not found
 * @throws {Error} If API request fails
 * @example
 * ```typescript
 * const client = makeClient(token);
 * const repo = await fetchRepositoryById(client, 'R_kgDOAbCdEf', true);
 * if (repo) console.log(repo.nameWithOwner);
 * ```
 */
export async function fetchRepositoryById(
  client: ReturnType<typeof makeClient>,
  repositoryId: string,
  includeForkTracking: boolean = true
): Promise<RepoNode | null> {
  const result: any = await client(GET_REPOSITORY_BY_ID_QUERY, {
    id: repositoryId,
    includeForkTracking
  });

  return result.node;
}

/**
 * Attempts to retrieve repository data from Apollo cache
 *
 * Reads repository fragment from Apollo Client's normalized cache without making
 * a network request. Returns null if repository is not in cache or Apollo Client
 * is not available.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param repositoryId - GitHub node ID of the repository (format: "R_...")
 * @returns Promise resolving to cached repository data or null if not cached
 * @example
 * ```typescript
 * const cached = await getRepositoryFromCache(token, 'R_kgDOAbCdEf');
 * if (cached) {
 *   console.log('Using cached data:', cached.nameWithOwner);
 * } else {
 *   console.log('Not in cache, need to fetch');
 * }
 * ```
 */
export async function getRepositoryFromCache(token: string, repositoryId: string): Promise<RepoNode | null> {
  try {
    const ap = await makeApolloClient(token);
    if (!ap || !ap.client) return null;

    const cached = ap.client.cache.readFragment({
      id: `Repository:${repositoryId}`,
      fragment: ap.gql`
        fragment CachedRepository on Repository {
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
      `
    });

    return cached as RepoNode | null;
  } catch {
    return null;
  }
}

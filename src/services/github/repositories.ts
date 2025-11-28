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

export interface Organization {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  isEnterprise?: boolean;
}

export interface ReposPageResult {
  nodes: RepoNode[];
  endCursor: string | null;
  hasNextPage: boolean;
  totalCount: number;
  rateLimit?: RateLimitInfo;
}

export type OwnerAffiliation = 'OWNER' | 'COLLABORATOR' | 'ORGANIZATION_MEMBER';

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

export async function fetchViewerOrganizations(
  client: ReturnType<typeof makeClient>
): Promise<Organization[]> {
  const res: any = await client(VIEWER_ORGANIZATIONS_QUERY);
  return res.viewer.organizations.nodes as Organization[];
}

// Check if an organization is enterprise by checking enterpriseOwners field
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

// Unified entry point - Apollo Client is the default with Octokit fallback
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

// Server-side search repositories for the viewer (Apollo-first, network-only by default)
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

// Fetch starred repositories
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

// Try to get repository from cache first
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

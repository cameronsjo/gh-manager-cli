import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchViewerReposPageUnified,
  searchRepositoriesUnified,
  getStarredRepositories,
  getRepositoryFromCache,
  checkOrganizationIsEnterprise,
} from '../repositories';
import type { RepoNode, RateLimitInfo } from '../../../types';

// Mock dependencies
vi.mock('fs');
vi.mock('env-paths');
vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Apollo Client
const mockApolloClient = {
  query: vi.fn(),
  cache: {
    readFragment: vi.fn(),
    writeFragment: vi.fn(),
    evict: vi.fn(),
    modify: vi.fn(),
  },
};

const mockGql = vi.fn((strings: TemplateStringsArray) => strings.join(''));

vi.mock('../client', () => ({
  makeClient: vi.fn(() => vi.fn()),
  makeApolloClient: vi.fn(() => Promise.resolve({
    client: mockApolloClient,
    gql: mockGql,
  })),
  purgeApolloCacheFiles: vi.fn(),
  inspectCacheStatus: vi.fn(),
}));

describe('fetchViewerReposPageUnified', () => {
  const mockToken = 'ghp_test_token';

  // Create mock repo in GraphQL response format (with issues/pullRequests objects)
  const createMockRepoRaw = (id: string, name: string, overrides?: Record<string, unknown>) => ({
    id,
    name,
    nameWithOwner: `testuser/${name}`,
    description: `Description for ${name}`,
    visibility: 'PUBLIC',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 10,
    forkCount: 5,
    viewerHasStarred: false,
    primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
    updatedAt: '2025-01-01T00:00:00Z',
    pushedAt: '2025-01-01T00:00:00Z',
    diskUsage: 1024,
    parent: null,
    defaultBranchRef: { name: 'main' },
    owner: { __typename: 'User', login: 'testuser' },
    issues: { totalCount: 3 },
    pullRequests: { totalCount: 2 },
    ...overrides,
  });

  // Create expected mapped repo (with both raw GraphQL fields and mapped openIssueCount/openPRCount)
  const createMockRepo = (id: string, name: string, overrides?: Partial<RepoNode> & Record<string, unknown>): RepoNode => ({
    id,
    name,
    nameWithOwner: `testuser/${name}`,
    description: `Description for ${name}`,
    visibility: 'PUBLIC',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 10,
    forkCount: 5,
    viewerHasStarred: false,
    primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
    updatedAt: '2025-01-01T00:00:00Z',
    pushedAt: '2025-01-01T00:00:00Z',
    diskUsage: 1024,
    parent: null,
    defaultBranchRef: { name: 'main' },
    owner: { __typename: 'User', login: 'testuser' },
    // Raw GraphQL fields (spread from original node)
    issues: { totalCount: 3 },
    pullRequests: { totalCount: 2 },
    // Mapped fields
    openIssueCount: 3,
    openPRCount: 2,
    ...overrides,
  } as RepoNode);

  const mockRateLimit: RateLimitInfo = {
    limit: 5000,
    remaining: 4999,
    resetAt: '2025-01-01T01:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch repositories with Apollo Client successfully', async () => {
    // Raw format from GraphQL (with issues/pullRequests objects)
    const mockReposRaw = [
      createMockRepoRaw('R_1', 'repo1'),
      createMockRepoRaw('R_2', 'repo2'),
      createMockRepoRaw('R_3', 'repo3'),
    ];
    // Expected mapped format (with openIssueCount/openPRCount)
    const expectedRepos = [
      createMockRepo('R_1', 'repo1'),
      createMockRepo('R_2', 'repo2'),
      createMockRepo('R_3', 'repo3'),
    ];

    mockApolloClient.query.mockResolvedValue({
      data: {
        viewer: {
          repositories: {
            totalCount: 3,
            pageInfo: {
              endCursor: 'cursor_1',
              hasNextPage: false,
            },
            nodes: mockReposRaw,
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    const result = await fetchViewerReposPageUnified(mockToken, 50);

    expect(result).toEqual({
      nodes: expectedRepos,
      endCursor: 'cursor_1',
      hasNextPage: false,
      totalCount: 3,
      rateLimit: mockRateLimit,
    });

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          first: 50,
          after: null,
          sortField: 'UPDATED_AT',
          sortDirection: 'DESC',
        }),
        fetchPolicy: 'cache-first',
      })
    );
  });

  it('should handle pagination with endCursor', async () => {
    const mockReposRaw = [
      createMockRepoRaw('R_4', 'repo4'),
      createMockRepoRaw('R_5', 'repo5'),
    ];

    mockApolloClient.query.mockResolvedValue({
      data: {
        viewer: {
          repositories: {
            totalCount: 100,
            pageInfo: {
              endCursor: 'cursor_2',
              hasNextPage: true,
            },
            nodes: mockReposRaw,
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    const result = await fetchViewerReposPageUnified(
      mockToken,
      50,
      'cursor_1'
    );

    expect(result.hasNextPage).toBe(true);
    expect(result.endCursor).toBe('cursor_2');
    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          after: 'cursor_1',
        }),
      })
    );
  });

  it('should handle different sort options', async () => {
    mockApolloClient.query.mockResolvedValue({
      data: {
        viewer: {
          repositories: {
            totalCount: 1,
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
            nodes: [createMockRepoRaw('R_1', 'repo1')],
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    await fetchViewerReposPageUnified(
      mockToken,
      50,
      null,
      { field: 'STARGAZERS', direction: 'DESC' }
    );

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          sortField: 'STARGAZERS',
          sortDirection: 'DESC',
        }),
      })
    );
  });

  it('should fetch organization repositories', async () => {
    const mockOrgReposRaw = [
      createMockRepoRaw('R_1', 'org-repo1', {
        nameWithOwner: 'myorg/org-repo1',
        owner: { __typename: 'Organization', login: 'myorg' },
      }),
    ];
    const expectedOrgRepos = [
      createMockRepo('R_1', 'org-repo1', {
        nameWithOwner: 'myorg/org-repo1',
        owner: { __typename: 'Organization', login: 'myorg' },
      }),
    ];

    mockApolloClient.query.mockResolvedValue({
      data: {
        organization: {
          repositories: {
            totalCount: 1,
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
            nodes: mockOrgReposRaw,
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    const result = await fetchViewerReposPageUnified(
      mockToken,
      50,
      null,
      undefined,
      true,
      'cache-first',
      ['OWNER'],
      'myorg'
    );

    expect(result.nodes).toEqual(expectedOrgRepos);
    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          orgLogin: 'myorg',
        }),
      })
    );
  });

  it('should filter by privacy', async () => {
    const mockPrivateReposRaw = [
      createMockRepoRaw('R_1', 'private-repo', {
        visibility: 'PRIVATE',
        isPrivate: true,
      }),
    ];

    mockApolloClient.query.mockResolvedValue({
      data: {
        viewer: {
          repositories: {
            totalCount: 1,
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
            nodes: mockPrivateReposRaw,
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    await fetchViewerReposPageUnified(
      mockToken,
      50,
      null,
      undefined,
      true,
      'cache-first',
      ['OWNER'],
      undefined,
      'PRIVATE'
    );

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          privacy: 'PRIVATE',
        }),
      })
    );
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network error: Failed to fetch');
    mockApolloClient.query.mockRejectedValue(networkError);

    // Apollo should fail and fall back to Octokit
    await expect(fetchViewerReposPageUnified(mockToken, 50)).rejects.toThrow();
  });

  it('should handle rate limit errors', async () => {
    const rateLimitError = {
      message: 'API rate limit exceeded',
      errors: [{ type: 'RATE_LIMITED' }],
    };

    mockApolloClient.query.mockRejectedValue(rateLimitError);

    await expect(fetchViewerReposPageUnified(mockToken, 50)).rejects.toThrow();
  });

  it('should use network-only fetch policy when specified', async () => {
    mockApolloClient.query.mockResolvedValue({
      data: {
        viewer: {
          repositories: {
            totalCount: 0,
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
            nodes: [],
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    await fetchViewerReposPageUnified(
      mockToken,
      50,
      null,
      undefined,
      true,
      'network-only'
    );

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: 'network-only',
      })
    );
  });
});

describe('searchRepositoriesUnified', () => {
  const mockToken = 'ghp_test_token';
  const mockViewer = 'testuser';

  // Create mock repo in GraphQL response format for search results
  const createMockRepoRaw = (id: string, name: string) => ({
    id,
    name,
    nameWithOwner: `testuser/${name}`,
    description: `Search result for ${name}`,
    visibility: 'PUBLIC',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 5,
    forkCount: 2,
    viewerHasStarred: false,
    primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
    updatedAt: '2025-01-01T00:00:00Z',
    pushedAt: '2025-01-01T00:00:00Z',
    diskUsage: 512,
    parent: null,
    defaultBranchRef: { name: 'main' },
    owner: { __typename: 'User', login: 'testuser' },
    issues: { totalCount: 3 },
    pullRequests: { totalCount: 2 },
  });

  // Create expected mapped repo (with both raw and mapped fields)
  const createMockRepo = (id: string, name: string): RepoNode => ({
    id,
    name,
    nameWithOwner: `testuser/${name}`,
    description: `Search result for ${name}`,
    visibility: 'PUBLIC',
    isPrivate: false,
    isFork: false,
    isArchived: false,
    stargazerCount: 5,
    forkCount: 2,
    viewerHasStarred: false,
    primaryLanguage: { name: 'JavaScript', color: '#f1e05a' },
    updatedAt: '2025-01-01T00:00:00Z',
    pushedAt: '2025-01-01T00:00:00Z',
    diskUsage: 512,
    parent: null,
    defaultBranchRef: { name: 'main' },
    owner: { __typename: 'User', login: 'testuser' },
    issues: { totalCount: 3 },
    pullRequests: { totalCount: 2 },
    openIssueCount: 3,
    openPRCount: 2,
  } as RepoNode);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search repositories successfully', async () => {
    // Raw format from GraphQL API
    const mockResultsRaw = [
      createMockRepoRaw('R_1', 'search-repo1'),
      createMockRepoRaw('R_2', 'search-repo2'),
    ];
    // Expected mapped format
    const expectedResults = [
      createMockRepo('R_1', 'search-repo1'),
      createMockRepo('R_2', 'search-repo2'),
    ];

    mockApolloClient.query.mockResolvedValue({
      data: {
        search: {
          repositoryCount: 2,
          pageInfo: {
            endCursor: 'search_cursor',
            hasNextPage: false,
          },
          nodes: mockResultsRaw,
        },
        rateLimit: {
          limit: 5000,
          remaining: 4998,
          resetAt: '2025-01-01T01:00:00Z',
        },
      },
    });

    const result = await searchRepositoriesUnified(
      mockToken,
      mockViewer,
      'search-repo',
      50
    );

    expect(result.nodes).toEqual(expectedResults);
    expect(result.totalCount).toBe(2);
    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          q: expect.stringContaining('search-repo'),
          first: 50,
        }),
        fetchPolicy: 'network-only',
      })
    );
  });

  it('should construct search query for personal repositories', async () => {
    mockApolloClient.query.mockResolvedValue({
      data: {
        search: {
          repositoryCount: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
          nodes: [],
        },
        rateLimit: { limit: 5000, remaining: 5000, resetAt: '2025-01-01T01:00:00Z' },
      },
    });

    await searchRepositoriesUnified(mockToken, mockViewer, 'test', 50);

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          q: 'test user:testuser in:name,description fork:true',
        }),
      })
    );
  });

  it('should construct search query for organization repositories', async () => {
    mockApolloClient.query.mockResolvedValue({
      data: {
        search: {
          repositoryCount: 0,
          pageInfo: { endCursor: null, hasNextPage: false },
          nodes: [],
        },
        rateLimit: { limit: 5000, remaining: 5000, resetAt: '2025-01-01T01:00:00Z' },
      },
    });

    await searchRepositoriesUnified(
      mockToken,
      mockViewer,
      'test',
      50,
      null,
      'UPDATED_AT',
      'DESC',
      true,
      'network-only',
      'myorg'
    );

    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          q: 'test org:myorg in:name,description fork:true',
        }),
      })
    );
  });

  it('should handle search with pagination', async () => {
    const mockResultsRaw = [createMockRepoRaw('R_3', 'page2-repo')];

    mockApolloClient.query.mockResolvedValue({
      data: {
        search: {
          repositoryCount: 100,
          pageInfo: {
            endCursor: 'search_cursor_2',
            hasNextPage: true,
          },
          nodes: mockResultsRaw,
        },
        rateLimit: { limit: 5000, remaining: 4997, resetAt: '2025-01-01T01:00:00Z' },
      },
    });

    const result = await searchRepositoriesUnified(
      mockToken,
      mockViewer,
      'test',
      50,
      'search_cursor_1'
    );

    expect(result.hasNextPage).toBe(true);
    expect(result.endCursor).toBe('search_cursor_2');
    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          after: 'search_cursor_1',
        }),
      })
    );
  });

  it('should handle search errors', async () => {
    const searchError = new Error('Search query failed');
    mockApolloClient.query.mockRejectedValue(searchError);

    await expect(
      searchRepositoriesUnified(mockToken, mockViewer, 'test', 50)
    ).rejects.toThrow('Search query failed');
  });
});

describe('getStarredRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch starred repositories', async () => {
    const mockClient = vi.fn();
    // Raw format from GraphQL API
    const mockStarredReposRaw = [
      {
        id: 'R_1',
        name: 'starred-repo',
        nameWithOwner: 'otheruser/starred-repo',
        description: 'A starred repository',
        visibility: 'PUBLIC' as const,
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 100,
        forkCount: 20,
        viewerHasStarred: true,
        primaryLanguage: { name: 'Python', color: '#3572A5' },
        updatedAt: '2025-01-01T00:00:00Z',
        pushedAt: '2025-01-01T00:00:00Z',
        diskUsage: 2048,
        parent: null,
        defaultBranchRef: { name: 'main' },
        owner: { __typename: 'User' as const, login: 'otheruser' },
        issues: { totalCount: 5 },
        pullRequests: { totalCount: 3 },
      },
    ];
    // Expected mapped format
    const expectedStarredRepos = [
      {
        id: 'R_1',
        name: 'starred-repo',
        nameWithOwner: 'otheruser/starred-repo',
        description: 'A starred repository',
        visibility: 'PUBLIC' as const,
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 100,
        forkCount: 20,
        viewerHasStarred: true,
        primaryLanguage: { name: 'Python', color: '#3572A5' },
        updatedAt: '2025-01-01T00:00:00Z',
        pushedAt: '2025-01-01T00:00:00Z',
        diskUsage: 2048,
        parent: null,
        defaultBranchRef: { name: 'main' },
        owner: { __typename: 'User' as const, login: 'otheruser' },
        issues: { totalCount: 5 },
        pullRequests: { totalCount: 3 },
        openIssueCount: 5,
        openPRCount: 3,
      },
    ];

    mockClient.mockResolvedValue({
      viewer: {
        starredRepositories: {
          totalCount: 1,
          pageInfo: {
            endCursor: 'starred_cursor',
            hasNextPage: false,
          },
          nodes: mockStarredReposRaw,
        },
      },
      rateLimit: {
        limit: 5000,
        remaining: 4999,
        resetAt: '2025-01-01T01:00:00Z',
      },
    });

    const result = await getStarredRepositories(mockClient, 50);

    expect(result.nodes).toEqual(expectedStarredRepos);
    expect(result.totalCount).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('should handle pagination for starred repositories', async () => {
    const mockClient = vi.fn();

    mockClient.mockResolvedValue({
      viewer: {
        starredRepositories: {
          totalCount: 100,
          pageInfo: {
            endCursor: 'starred_cursor_2',
            hasNextPage: true,
          },
          nodes: [],
        },
      },
      rateLimit: {
        limit: 5000,
        remaining: 4998,
        resetAt: '2025-01-01T01:00:00Z',
      },
    });

    const result = await getStarredRepositories(mockClient, 50, 'starred_cursor_1');

    expect(result.hasNextPage).toBe(true);
    expect(mockClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        after: 'starred_cursor_1',
      })
    );
  });
});

describe('getRepositoryFromCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve repository from cache', async () => {
    // Raw format from cache (with issues/pullRequests objects)
    const mockRepoRaw = {
      id: 'R_cached',
      name: 'cached-repo',
      nameWithOwner: 'testuser/cached-repo',
      description: 'From cache',
      visibility: 'PUBLIC',
      isPrivate: false,
      isFork: false,
      isArchived: false,
      stargazerCount: 15,
      forkCount: 3,
      primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
      updatedAt: '2025-01-01T00:00:00Z',
      pushedAt: '2025-01-01T00:00:00Z',
      diskUsage: 1024,
      parent: null,
      defaultBranchRef: { name: 'main' },
      issues: { totalCount: 4 },
      pullRequests: { totalCount: 1 },
    };
    // Expected mapped format
    const expectedRepo = {
      id: 'R_cached',
      name: 'cached-repo',
      nameWithOwner: 'testuser/cached-repo',
      description: 'From cache',
      visibility: 'PUBLIC',
      isPrivate: false,
      isFork: false,
      isArchived: false,
      stargazerCount: 15,
      forkCount: 3,
      primaryLanguage: { name: 'TypeScript', color: '#2b7489' },
      updatedAt: '2025-01-01T00:00:00Z',
      pushedAt: '2025-01-01T00:00:00Z',
      diskUsage: 1024,
      parent: null,
      defaultBranchRef: { name: 'main' },
      issues: { totalCount: 4 },
      pullRequests: { totalCount: 1 },
      openIssueCount: 4,
      openPRCount: 1,
    };

    mockApolloClient.cache.readFragment.mockReturnValue(mockRepoRaw);

    const result = await getRepositoryFromCache('ghp_token', 'R_cached');

    expect(result).toEqual(expectedRepo);
    expect(mockApolloClient.cache.readFragment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'Repository:R_cached',
      })
    );
  });

  it('should return null if repository not in cache', async () => {
    mockApolloClient.cache.readFragment.mockReturnValue(null);

    const result = await getRepositoryFromCache('ghp_token', 'R_notfound');

    expect(result).toBeNull();
  });

  it('should handle cache read errors gracefully', async () => {
    mockApolloClient.cache.readFragment.mockImplementation(() => {
      throw new Error('Cache read error');
    });

    const result = await getRepositoryFromCache('ghp_token', 'R_error');

    expect(result).toBeNull();
  });
});

describe('checkOrganizationIsEnterprise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for enterprise organization', async () => {
    const mockClient = vi.fn();

    mockClient.mockResolvedValue({
      organization: {
        enterpriseOwners: {
          totalCount: 1,
        },
      },
    });

    const result = await checkOrganizationIsEnterprise(mockClient, 'enterprise-org');

    expect(result).toBe(true);
    expect(mockClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orgLogin: 'enterprise-org',
      })
    );
  });

  it('should return false for non-enterprise organization', async () => {
    const mockClient = vi.fn();

    mockClient.mockResolvedValue({
      organization: {
        enterpriseOwners: {
          totalCount: 0,
        },
      },
    });

    const result = await checkOrganizationIsEnterprise(mockClient, 'regular-org');

    expect(result).toBe(false);
  });

  it('should return false on query errors', async () => {
    const mockClient = vi.fn();

    mockClient.mockRejectedValue(new Error('Organization not found'));

    const result = await checkOrganizationIsEnterprise(mockClient, 'nonexistent-org');

    expect(result).toBe(false);
  });
});

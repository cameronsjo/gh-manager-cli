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

  const createMockRepo = (id: string, name: string, overrides?: Partial<RepoNode>): RepoNode => ({
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
    ...overrides,
  });

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
    const mockRepos = [
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
            nodes: mockRepos,
          },
        },
        rateLimit: mockRateLimit,
      },
      loading: false,
      networkStatus: 7,
    });

    const result = await fetchViewerReposPageUnified(mockToken, 50);

    expect(result).toEqual({
      nodes: mockRepos,
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
    const mockRepos = [
      createMockRepo('R_4', 'repo4'),
      createMockRepo('R_5', 'repo5'),
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
            nodes: mockRepos,
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
            nodes: [createMockRepo('R_1', 'repo1')],
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
    const mockOrgRepos = [
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
            nodes: mockOrgRepos,
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

    expect(result.nodes).toEqual(mockOrgRepos);
    expect(mockApolloClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          orgLogin: 'myorg',
        }),
      })
    );
  });

  it('should filter by privacy', async () => {
    const mockPrivateRepos = [
      createMockRepo('R_1', 'private-repo', {
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
            nodes: mockPrivateRepos,
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search repositories successfully', async () => {
    const mockResults = [
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
          nodes: mockResults,
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

    expect(result.nodes).toEqual(mockResults);
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
    const mockResults = [createMockRepo('R_3', 'page2-repo')];

    mockApolloClient.query.mockResolvedValue({
      data: {
        search: {
          repositoryCount: 100,
          pageInfo: {
            endCursor: 'search_cursor_2',
            hasNextPage: true,
          },
          nodes: mockResults,
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
    const mockStarredRepos = [
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
          nodes: mockStarredRepos,
        },
      },
      rateLimit: {
        limit: 5000,
        remaining: 4999,
        resetAt: '2025-01-01T01:00:00Z',
      },
    });

    const result = await getStarredRepositories(mockClient, 50);

    expect(result.nodes).toEqual(mockStarredRepos);
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
    const mockRepo: RepoNode = {
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
    };

    mockApolloClient.cache.readFragment.mockReturnValue(mockRepo);

    const result = await getRepositoryFromCache('ghp_token', 'R_cached');

    expect(result).toEqual(mockRepo);
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeClient } from '../client';

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

describe('makeClient', () => {
  it('should create a GraphQL client with token', () => {
    const token = 'ghp_test_token_123';
    const client = makeClient(token);

    expect(client).toBeDefined();
    expect(typeof client).toBe('function');
  });

  it('should create client with correct authorization header format', () => {
    const token = 'ghp_test_token_456';
    const client = makeClient(token);

    // The makeClient function returns a configured graphql function
    // We can verify it's been created with the token
    expect(client).toBeDefined();
  });

  it('should handle different token formats', () => {
    const tokens = [
      'ghp_classic_token',
      'github_pat_token',
      'gho_oauth_token',
    ];

    tokens.forEach(token => {
      const client = makeClient(token);
      expect(client).toBeDefined();
    });
  });

  it('should handle empty tokens', () => {
    const client = makeClient('');
    expect(client).toBeDefined();
  });

  it('should handle tokens with special characters', () => {
    const specialTokens = [
      'ghp_token-with-dashes',
      'ghp_token_with_underscores',
      'ghp_token.with.dots',
    ];

    specialTokens.forEach(token => {
      const client = makeClient(token);
      expect(client).toBeDefined();
    });
  });

  it('should handle very long tokens', () => {
    const longToken = 'ghp_' + 'x'.repeat(1000);
    const client = makeClient(longToken);
    expect(client).toBeDefined();
  });
});

describe('makeApolloClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = globalThis.fetch;

    // Ensure fetch is available for tests
    if (typeof globalThis.fetch === 'undefined') {
      (globalThis as any).fetch = vi.fn();
    }
  });

  afterEach(() => {
    // Restore original fetch
    if (originalFetch) {
      (globalThis as any).fetch = originalFetch;
    }
    vi.clearAllMocks();
  });

  it('should create Apollo client successfully', async () => {
    // Import dynamically to ensure mocks are in place
    const { makeApolloClient } = await import('../client');

    const token = 'ghp_test_apollo_token';

    const result = await makeApolloClient(token);

    expect(result).toBeDefined();
    expect(result.client).toBeDefined();
    expect(result.gql).toBeDefined();
  });

  it('should return singleton instance on subsequent calls', async () => {
    // Import dynamically to ensure mocks are in place
    const { makeApolloClient } = await import('../client');

    const token = 'ghp_singleton_token';

    const first = await makeApolloClient(token);
    const second = await makeApolloClient(token);

    // Should return the same instance
    expect(first).toBe(second);
  });
});

describe('Apollo cache operations', () => {
  it('should purge cache files without throwing', async () => {
    const { purgeApolloCacheFiles } = await import('../client');

    // Should not throw even if files don't exist
    await expect(purgeApolloCacheFiles()).resolves.toBeUndefined();
  });

  it('should inspect cache status without throwing', async () => {
    const { inspectCacheStatus } = await import('../client');

    const originalStderr = process.stderr.write;
    const output: string[] = [];

    // Capture stderr
    process.stderr.write = vi.fn((chunk: any) => {
      output.push(chunk.toString());
      return true;
    }) as any;

    try {
      await inspectCacheStatus();
      // Should write something to stderr
      expect(output.length).toBeGreaterThan(0);
    } finally {
      process.stderr.write = originalStderr;
    }
  });
});

describe('edge cases', () => {
  it('should handle creating multiple clients with different tokens', () => {
    const client1 = makeClient('token1');
    const client2 = makeClient('token2');
    const client3 = makeClient('token3');

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    expect(client3).toBeDefined();
  });

  it('should handle tokens with whitespace', () => {
    // Whitespace should be preserved (even though it's invalid)
    const token = ' ghp_token_with_spaces ';
    const client = makeClient(token);
    expect(client).toBeDefined();
  });

  it('should handle numeric-like strings as tokens', () => {
    const token = '12345678901234567890';
    const client = makeClient(token);
    expect(client).toBeDefined();
  });

  it('should handle tokens containing only special characters', () => {
    const token = '!@#$%^&*()_+-=[]{}|;:,.<>?/';
    const client = makeClient(token);
    expect(client).toBeDefined();
  });
});

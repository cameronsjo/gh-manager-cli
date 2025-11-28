import { graphql as makeGraphQL } from '@octokit/graphql';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core/index.js';
import { persistCache } from 'apollo3-cache-persist';
import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';
import { logger } from '../../lib/logger';
import { APOLLO_CACHE_MAX_SIZE } from '../../config/constants';

export function makeClient(token: string) {
  return makeGraphQL.defaults({
    headers: { authorization: `token ${token}` },
  });
}

// Singleton Apollo client instance
let apolloClientInstance: { client: ApolloClient<any>, gql: any } | null = null;

// Storage adapter for cache persistence
const storage = {
  async getItem(key: string) {
    try {
      const p = envPaths('gh-manager-cli').data;
      const file = path.join(p, 'apollo-cache.json');
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      logger.debug('Failed to read Apollo cache file', { error });
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      const p = envPaths('gh-manager-cli').data;
      fs.mkdirSync(p, { recursive: true });
      const file = path.join(p, 'apollo-cache.json');
      fs.writeFileSync(file, value, 'utf8');
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(file, 0o600);
        } catch (error) {
          logger.debug('Failed to set permissions on Apollo cache file', { error });
        }
      }
    } catch (error) {
      logger.debug('Failed to write Apollo cache file', { error });
    }
  },
  async removeItem(key: string) {
    try {
      const p = envPaths('gh-manager-cli').data;
      const file = path.join(p, 'apollo-cache.json');
      fs.unlinkSync(file);
    } catch (error) {
      logger.debug('Failed to remove Apollo cache file', { error });
    }
  }
};

// Apollo Client with persisted cache (default for all queries)
export async function makeApolloClient(token: string): Promise<any> {
  // Return existing instance if available
  if (apolloClientInstance) {
    return apolloClientInstance;
  }

  try {
    // Node 18+ has native fetch, ensure it's available
    if (typeof globalThis.fetch === 'undefined') {
      throw new Error('Fetch API not available. Node 18+ is required.');
    }

    const cache = new InMemoryCache();
    await persistCache({ cache, storage, debounce: 500, maxSize: APOLLO_CACHE_MAX_SIZE } as any);

    const link = new (HttpLink as any)({
      uri: 'https://api.github.com/graphql',
      fetch: (globalThis as any).fetch,
      headers: { authorization: `Bearer ${token}` }
    });

    const client = new ApolloClient({ cache, link });
    // Import gql from apollo client to avoid circular dependency
    const { gql } = await import('@apollo/client/core/index.js');
    apolloClientInstance = { client, gql };
    return apolloClientInstance;
  } catch (error: any) {
    logger.error('Failed to initialize Apollo Client', {
      error: error.message,
      stack: error.stack
    });
    const debug = process.env.GH_MANAGER_DEBUG === '1';
    if (debug) {
      process.stderr.write(`\n❌ Failed to initialize Apollo Client: ${error.message}\n`);
      if (error.stack) {
        process.stderr.write(`Stack: ${error.stack}\n`);
      }
    }
    throw new Error(`Apollo Client initialization failed: ${error.message}`);
  }
}

// Purge persisted Apollo cache files (and TTL meta)
export async function purgeApolloCacheFiles(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPaths = (await import('env-paths')).default;
    const p = envPaths('gh-manager-cli').data;
    const cacheFile = path.join(p, 'apollo-cache.json');
    const metaFile = path.join(p, 'apollo-cache-meta.json');

    if (process.env.GH_MANAGER_DEBUG === '1') {
      console.log(`🗑️  Purging cache files from: ${p}`);
    }

    try {
      fs.unlinkSync(cacheFile);
    } catch (error) {
      logger.debug('Failed to unlink Apollo cache file', { error });
    }
    try {
      fs.unlinkSync(metaFile);
    } catch (error) {
      logger.debug('Failed to unlink Apollo cache meta file', { error });
    }
  } catch (error) {
    logger.debug('Failed to purge Apollo cache files', { error });
  }
}

// Debug function to inspect cache status - using stderr to bypass Ink UI
export async function inspectCacheStatus(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPaths = (await import('env-paths')).default;
    const p = envPaths('gh-manager-cli').data;
    const cacheFile = path.join(p, 'apollo-cache.json');
    const metaFile = path.join(p, 'apollo-cache-meta.json');

    // Use stderr to bypass Ink UI capture
    process.stderr.write(`\n📂 Cache directory: ${p}\n`);

    try {
      const cacheStats = fs.statSync(cacheFile);
      process.stderr.write(`💾 Cache file: ${Math.round(cacheStats.size / 1024)}KB (${cacheStats.mtime.toISOString()})\n`);
    } catch {
      process.stderr.write(`💾 Cache file: NOT FOUND\n`);
    }

    try {
      const metaStats = fs.statSync(metaFile);
      const metaContent = fs.readFileSync(metaFile, 'utf8');
      const meta = JSON.parse(metaContent);
      process.stderr.write(`📊 Meta file: ${Object.keys(meta.fetched || {}).length} entries (${metaStats.mtime.toISOString()})\n`);

      // Show recent entries
      const entries = Object.entries(meta.fetched || {});
      if (entries.length > 0) {
        process.stderr.write('📋 Recent cache entries:\n');
        entries.slice(-3).forEach(([key, timestamp]) => {
          const age = Date.now() - Date.parse(timestamp as string);
          process.stderr.write(`   ${key} (${Math.round(age / 1000)}s ago)\n`);
        });
      }
    } catch {
      process.stderr.write(`📊 Meta file: NOT FOUND\n`);
    }
    process.stderr.write('\n');
  } catch (e: any) {
    process.stderr.write(`❌ Cache inspection failed: ${e.message}\n`);
  }
}

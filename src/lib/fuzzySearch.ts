/**
 * Fuzzy search utilities using Fuse.js for repository filtering
 *
 * @module lib/fuzzySearch
 */

import Fuse from 'fuse.js';
import type { RepoNode } from '../types';

/**
 * Fuse.js configuration options for repository search
 *
 * Weighted search across multiple repository fields:
 * - Repository name (40% weight) - primary identifier
 * - Full name with owner (30% weight) - namespace-qualified name
 * - Description (20% weight) - project description
 * - Primary language (10% weight) - programming language
 *
 * Threshold of 0.4 provides balanced fuzzy matching:
 * - 0.0 = exact match required
 * - 1.0 = match anything
 */
const fuseOptions: Fuse.IFuseOptions<RepoNode> = {
  keys: [
    { name: 'name', weight: 0.4 },
    { name: 'nameWithOwner', weight: 0.3 },
    { name: 'description', weight: 0.2 },
    { name: 'primaryLanguage.name', weight: 0.1 }
  ],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true
};

/**
 * Creates a Fuse.js searcher instance for the given repository items
 *
 * @param items - Array of repository nodes to search
 * @returns Configured Fuse.js instance
 */
export function createFuzzySearcher(items: RepoNode[]): Fuse<RepoNode> {
  return new Fuse(items, fuseOptions);
}

/**
 * Performs fuzzy filtering on repository items using the search query
 *
 * Used for local client-side filtering when search query is too short
 * for server-side GitHub API search (< 3 characters).
 *
 * @param items - Array of repository nodes to filter
 * @param query - Search query string
 * @returns Filtered array of repository nodes matching the query
 */
export function fuzzyFilter(items: RepoNode[], query: string): RepoNode[] {
  if (!query || query.length < 1) {
    return items;
  }

  const fuse = new Fuse(items, fuseOptions);
  return fuse.search(query).map(result => result.item);
}

/**
 * Core type definitions for gh-manager-cli
 *
 * @module types
 */

/**
 * Utility type representing a value that may be null
 */
export type Maybe<T> = T | null;

/**
 * Brand type for creating nominal types
 *
 * Prevents accidental mixing of semantically different strings by adding
 * a compile-time brand to the type. This is a zero-runtime-cost type safety feature.
 *
 * @template T - Base type to brand (usually string)
 * @template TBrand - Brand identifier string
 */
declare const brand: unique symbol;
export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

/**
 * Branded type for GitHub repository IDs
 *
 * Ensures type safety when handling repository identifiers. Prevents accidentally
 * passing organization IDs or user IDs where repository IDs are expected.
 *
 * @example
 * ```typescript
 * const repoId: RepositoryId = 'R_kgDOAbCdEf' as RepositoryId;
 * ```
 */
export type RepositoryId = Brand<string, 'RepositoryId'>;

/**
 * Branded type for GitHub organization IDs
 *
 * Ensures type safety when handling organization identifiers.
 *
 * @example
 * ```typescript
 * const orgId: OrganizationId = 'O_kgDOAbCdEf' as OrganizationId;
 * ```
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;

/**
 * Branded type for GitHub user IDs
 *
 * Ensures type safety when handling user identifiers.
 *
 * @example
 * ```typescript
 * const userId: UserId = 'U_kgDOAbCdEf' as UserId;
 * ```
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Represents a programming language with optional color for UI display
 */
export interface Language {
  name: string;
  color?: string | null;
}

/**
 * Complete repository node from GitHub GraphQL API
 *
 * Contains all repository information needed for display and operations
 * in the gh-manager-cli TUI.
 */
export interface RepoNode {
  id: string;
  name: string;
  nameWithOwner: string;
  description: Maybe<string>;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazerCount: number;
  forkCount: number;
  viewerHasStarred?: boolean;
  primaryLanguage: Maybe<Language>;
  updatedAt: string; // ISO
  pushedAt: string; // ISO
  diskUsage: number; // KB
  parent: Maybe<{
    nameWithOwner: string;
    defaultBranchRef?: {
      name?: string;
      target?: {
        history?: {
          totalCount: number;
        }
      }
    } | null;
  }>;
  defaultBranchRef: Maybe<{
    name?: string;
    target?: {
      history?: {
        totalCount: number;
      }
    }
  }>;
  owner?: {
    __typename: 'Organization' | 'User';
    login: string;
  };
}

/**
 * GraphQL pagination information
 *
 * Provides cursor-based pagination data for traversing result sets.
 */
export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

/**
 * GitHub GraphQL API rate limit information
 *
 * Tracks remaining API quota and reset time for GraphQL endpoint.
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string; // ISO timestamp
}

/**
 * GitHub REST API rate limit information
 *
 * Provides rate limit data for both core REST API and GraphQL endpoints
 * as returned by the /rate_limit REST endpoint.
 */
export interface RestRateLimitInfo {
  core: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp (seconds since epoch)
  };
  graphql: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp (seconds since epoch)
  };
}

/**
 * Combined rate limit information from multiple sources
 *
 * Aggregates rate limit data from both GraphQL queries and REST API calls.
 */
export interface CombinedRateLimitInfo {
  graphql?: RateLimitInfo;
  rest?: RestRateLimitInfo;
}

/**
 * Represents a GitHub organization
 *
 * Contains organization metadata for display in organization switcher.
 */
export interface OrganizationNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}

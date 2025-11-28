export type Maybe<T> = T | null;

/**
 * Brand type for creating nominal types
 * Prevents accidental mixing of semantically different strings
 */
declare const brand: unique symbol;
export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

/**
 * Branded type for GitHub repository IDs
 * Ensures type safety when handling repository identifiers
 */
export type RepositoryId = Brand<string, 'RepositoryId'>;

/**
 * Branded type for GitHub organization IDs
 * Ensures type safety when handling organization identifiers
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;

/**
 * Branded type for GitHub user IDs
 * Ensures type safety when handling user identifiers
 */
export type UserId = Brand<string, 'UserId'>;

export interface Language {
  name: string;
  color?: string | null;
}

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

export interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string; // ISO
}

export interface RestRateLimitInfo {
  core: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
  };
  graphql: {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
  };
}

export interface CombinedRateLimitInfo {
  graphql?: RateLimitInfo;
  rest?: RestRateLimitInfo;
}

export interface OrganizationNode {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}

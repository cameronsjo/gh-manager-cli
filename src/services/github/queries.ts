// GraphQL query definitions and fragments

// Shared repository fragment for common fields
export const REPO_FRAGMENT_WITH_FORK_TRACKING = /* GraphQL */ `
  fragment RepoFields on Repository {
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
    owner {
      __typename
      login
    }
    primaryLanguage {
      name
      color
    }
    updatedAt
    pushedAt
    diskUsage
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
    }
  }
`;

export const REPO_FRAGMENT_WITHOUT_FORK_TRACKING = /* GraphQL */ `
  fragment RepoFieldsSimple on Repository {
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
    owner {
      __typename
      login
    }
    primaryLanguage {
      name
      color
    }
    updatedAt
    pushedAt
    diskUsage
    parent {
      nameWithOwner
    }
    defaultBranchRef {
      name
    }
  }
`;

export const VIEWER_LOGIN_QUERY = /* GraphQL */ `
  query ViewerLogin {
    viewer {
      login
    }
  }
`;

export const VIEWER_ORGANIZATIONS_QUERY = /* GraphQL */ `
  query ViewerOrganizations {
    viewer {
      organizations(first: 100) {
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const CHECK_ORG_ENTERPRISE_QUERY = /* GraphQL */ `
  query CheckOrgEnterprise($orgLogin: String!) {
    organization(login: $orgLogin) {
      enterpriseOwners(first: 1) {
        totalCount
      }
    }
  }
`;

export const VIEWER_REPOS_QUERY = /* GraphQL */ `
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
          parent {
            nameWithOwner
          }
          defaultBranchRef { name }
        }
      }
    }
  }
`;

export const ORG_REPOS_QUERY = /* GraphQL */ `
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
          parent {
            nameWithOwner
          }
          defaultBranchRef { name }
        }
      }
    }
  }
`;

export const STARRED_REPOS_QUERY = /* GraphQL */ `
  query StarredRepos($first: Int!, $after: String) {
    rateLimit {
      limit
      remaining
      resetAt
    }
    viewer {
      starredRepositories(
        first: $first
        after: $after
        orderBy: { field: STARRED_AT, direction: DESC }
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
          owner {
            __typename
            login
          }
          primaryLanguage {
            name
            color
          }
          updatedAt
          pushedAt
          diskUsage
          parent {
            nameWithOwner
          }
          defaultBranchRef { name }
        }
      }
    }
  }
`;

export const SEARCH_REPOS_QUERY = /* GraphQL */ `
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
          parent { nameWithOwner }
          defaultBranchRef { name }
        }
      }
    }
  }
`;

export const GET_REPO_DETAILS_QUERY = /* GraphQL */ `
  query GetRepoDetails($id: ID!) {
    node(id: $id) {
      ... on Repository {
        nameWithOwner
        owner {
          login
        }
        name
      }
    }
  }
`;

export const GET_REPOSITORY_BY_ID_QUERY = /* GraphQL */ `
  query GetRepository($id: ID!, $includeForkTracking: Boolean!) {
    node(id: $id) {
      ... on Repository {
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
        parent @include(if: $includeForkTracking) {
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
        defaultBranchRef @include(if: $includeForkTracking) {
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
    }
  }
`;

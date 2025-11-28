import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { RepoNode } from '../../../../types';
import { RepoRow } from '../../../components/repo';
import { SlowSpinner } from '../../../components/common';
import { MIN_SEARCH_LENGTH } from '../../../../config/constants';

interface RepoListContentProps {
  // Filter state
  filterMode: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  onFilterSubmit: () => void;
  starsMode: boolean;

  // Visible items and windowing
  visibleItems: RepoNode[];
  windowStart: number;
  windowEnd: number;
  cursor: number;
  terminalWidth: number;
  spacingLines: number;
  forkTracking: boolean;

  // Multi-select
  multiSelectMode: boolean;
  selectedRepos: Set<string>;

  // Search state
  searchActive: boolean;
  searchLoading: boolean;
  loading: boolean;

  // Loading more
  loadingMore: boolean;
  hasNextPage: boolean;

  // List dimensions
  listHeight: number;
}

export function RepoListContent(props: RepoListContentProps): JSX.Element {
  const {
    filterMode,
    filter,
    onFilterChange,
    onFilterSubmit,
    starsMode,
    visibleItems,
    windowStart,
    windowEnd,
    cursor,
    terminalWidth,
    spacingLines,
    forkTracking,
    multiSelectMode,
    selectedRepos,
    searchActive,
    searchLoading,
    loading,
    loadingMore,
    hasNextPage,
    listHeight,
  } = props;

  return (
    <>
      {/* Filter input */}
      {filterMode && (
        <Box marginBottom={1}>
          <Text>Search: </Text>
          <TextInput
            value={filter}
            onChange={onFilterChange}
            onSubmit={onFilterSubmit}
            placeholder={starsMode ? "Type to filter starred repositories..." : "Type to search (3+ chars for server search)..."}
          />
        </Box>
      )}

      {/* Repository list */}
      <Box flexDirection="column" height={listHeight}>
        {(filterMode && filter.trim().length > 0 && filter.trim().length < MIN_SEARCH_LENGTH) ? (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color="gray" dimColor>Type at least {MIN_SEARCH_LENGTH} characters to search</Text>
          </Box>
        ) : (
          visibleItems.slice(windowStart, windowEnd).map((repo, i) => {
            const idx = windowStart + i;
            return (
              <RepoRow
                key={repo.nameWithOwner}
                repo={repo}
                selected={filterMode && searchActive ? false : idx === cursor}
                index={idx + 1}
                maxWidth={terminalWidth - 6}
                spacingLines={spacingLines}
                forkTracking={forkTracking}
                starsMode={starsMode}
                multiSelectMode={multiSelectMode}
                isMultiSelected={selectedRepos.has((repo as any).id)}
              />
            );
          })
        )}

        {/* Infinite scroll loading indicator */}
        {loadingMore && hasNextPage && (
          <Box justifyContent="center" alignItems="center" marginTop={1}>
            <Box flexDirection="row">
              <Box width={2} flexShrink={0} flexGrow={0} marginRight={1}>
                <Text color="cyan">
                  <SlowSpinner />
                </Text>
              </Box>
              <Text color="cyan">Loading more repositories...</Text>
            </Box>
          </Box>
        )}

        {!loading && !searchLoading && visibleItems.length === 0 && (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color="gray" dimColor>
              {searchActive ? 'No repositories match your search' : (filter ? 'No repositories match your filter' : 'No repositories found')}
            </Text>
          </Box>
        )}
      </Box>
    </>
  );
}

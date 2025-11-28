import React from 'react';
import { Box, Text } from 'ink';
import type { OwnerContext } from '../../../../config/config';

interface RepoListFooterProps {
  terminalWidth: number;
  modalOpen: boolean;
  multiSelectMode: boolean;
  selectedReposCount: number;
  starsMode: boolean;
  ownerContext: OwnerContext;
  copyToast: string | null;
  cloneToast: string | null;
  debugMessages?: string[];
}

export function RepoListFooter({
  terminalWidth,
  modalOpen,
  multiSelectMode,
  selectedReposCount,
  starsMode,
  ownerContext,
  copyToast,
  cloneToast,
  debugMessages = [],
}: RepoListFooterProps): JSX.Element {
  return (
    <>
      {/* Help footer - condensed, aligned shortcuts */}
      <Box marginTop={1} paddingX={1} flexDirection="column">
        {/* Multi-select indicator */}
        {multiSelectMode && (
          <Box width={terminalWidth} justifyContent="center" marginBottom={1}>
            <Text color="cyan" bold>
              Multi-Select: {selectedReposCount} selected • Space Toggle • Ctrl+A All • M Exit • Shift+C Clone
            </Text>
          </Box>
        )}
        {/* Condensed shortcuts in aligned columns */}
        <Box width={terminalWidth} justifyContent="center">
          <Text color="gray" dimColor={modalOpen ? true : undefined}>
            {starsMode ? (
              // Stars mode shortcuts - condensed
              '↑↓ Nav  / Search  S Sort  D Dir  T Dense  I Info  C Copy  U Unstar  W Org  R Refresh  Q Quit'
            ) : multiSelectMode ? (
              // Multi-select mode shortcuts - condensed
              '↑↓ Nav  Space Select  Ctrl+A All  M Exit  Shift+C Clone  Q Quit'
            ) : (
              // Normal mode shortcuts - condensed into logical groups
              `↑↓/G Nav  / Search  S Sort  D Dir  T Dense  ${ownerContext === 'personal' ? 'Shift+S Stars  ' : ''}V Vis  M Multi  Shift+C Clone  ⏎ Open`
            )}
          </Text>
        </Box>
        {!multiSelectMode && !starsMode && (
          <Box width={terminalWidth} justifyContent="center">
            <Text color="gray" dimColor={modalOpen ? true : undefined}>
              I Info  C Copy  Ctrl+S Star  Ctrl+R Rename  Ctrl+A Archive  Ctrl+V ChangeVis  Ctrl+F Sync  Del Delete
            </Text>
          </Box>
        )}
        <Box width={terminalWidth} justifyContent="center">
          <Text color="gray" dimColor={modalOpen ? true : undefined}>
            {multiSelectMode || starsMode ? '' : 'K Cache  W Org  R Refresh  Ctrl+L Logout  Q Quit'}
          </Text>
        </Box>
        {/* Sponsorship */}
        <Box width={terminalWidth} justifyContent="center" marginTop={1}>
          <Text color="yellow" dimColor={modalOpen ? true : undefined}>
            💖 github.com/sponsors/wiiiimm
          </Text>
        </Box>
      </Box>

      {/* Debug panel */}
      {process.env.GH_MANAGER_DEBUG === '1' && debugMessages.length > 0 && (
        <Box marginTop={1} borderStyle="single" borderColor="yellow" paddingX={1} flexDirection="column">
          <Text bold color="yellow">Debug Messages:</Text>
          {debugMessages.length === 0 ? (
            <Text color="gray">No debug messages yet...</Text>
          ) : (
            debugMessages.map((msg, i) => (
              <Text key={i} color="gray">{msg}</Text>
            ))
          )}
        </Box>
      )}

      {/* Copy toast notification */}
      {copyToast && (
        <Box marginTop={1} justifyContent="center">
          <Box borderStyle="round" borderColor={copyToast.includes('Failed') ? 'red' : 'green'} paddingX={2} paddingY={0}>
            <Text color={copyToast.includes('Failed') ? 'red' : 'green'}>{copyToast}</Text>
          </Box>
        </Box>
      )}

      {/* Clone toast notification */}
      {cloneToast && (
        <Box marginTop={1} justifyContent="center">
          <Box borderStyle="round" borderColor={cloneToast.includes('Failed') || cloneToast.includes('failed') ? 'yellow' : 'green'} paddingX={2} paddingY={0}>
            <Text color={cloneToast.includes('Failed') || cloneToast.includes('failed') ? 'yellow' : 'green'}>{cloneToast}</Text>
          </Box>
        </Box>
      )}
    </>
  );
}

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

export type CloneType = 'simple' | 'bare';

interface CloneModalProps {
  repos: RepoNode[];
  terminalWidth: number;
  onClose: () => void;
  onClone: (repos: RepoNode[], cloneType: CloneType, targetDir: string) => Promise<void>;
}

export function CloneModal({ repos, terminalWidth, onClose, onClone }: CloneModalProps) {
  const [cloneType, setCloneType] = useState<CloneType>('simple');
  const [targetDir, setTargetDir] = useState('.');
  const [editingDir, setEditingDir] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'type' | 'dir' | 'clone' | 'cancel'>('type');

  // Handle keyboard input
  useInput((input, key) => {
    if (cloning) return;

    // Handle directory editing mode
    if (editingDir) {
      if (key.escape) {
        setEditingDir(false);
        return;
      }
      if (key.return) {
        setEditingDir(false);
        setFocus('clone');
        return;
      }
      return; // Let TextInput handle the input
    }

    const ch = input?.toLowerCase();

    if (key.escape || ch === 'q') {
      onClose();
      return;
    }

    // Quick shortcuts
    if (ch === 's' && !key.ctrl) {
      setCloneType('simple');
      return;
    }
    if (ch === 'b' && !key.ctrl) {
      setCloneType('bare');
      return;
    }

    // Navigation
    if (key.upArrow || key.downArrow) {
      const focusOrder: typeof focus[] = ['type', 'dir', 'clone', 'cancel'];
      const currentIndex = focusOrder.indexOf(focus);
      let newIndex;

      if (key.upArrow) {
        newIndex = currentIndex === 0 ? focusOrder.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex === focusOrder.length - 1 ? 0 : currentIndex + 1;
      }

      setFocus(focusOrder[newIndex]);
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      if (focus === 'type') {
        setCloneType(prev => prev === 'simple' ? 'bare' : 'simple');
      } else if (focus === 'clone' || focus === 'cancel') {
        setFocus(prev => prev === 'clone' ? 'cancel' : 'clone');
      }
      return;
    }

    // Enter to activate focused element
    if (key.return) {
      if (focus === 'type') {
        setCloneType(prev => prev === 'simple' ? 'bare' : 'simple');
      } else if (focus === 'dir') {
        setEditingDir(true);
      } else if (focus === 'clone') {
        handleClone();
      } else if (focus === 'cancel') {
        onClose();
      }
      return;
    }

    // Y to confirm
    if (ch === 'y') {
      handleClone();
      return;
    }

    // C to cancel
    if (ch === 'c') {
      onClose();
      return;
    }
  });

  const handleClone = async () => {
    if (cloning || repos.length === 0) return;

    try {
      setCloning(true);
      setCloneError(null);
      await onClone(repos, cloneType, targetDir);
    } catch (e: any) {
      setCloneError(e.message || 'Failed to clone repositories');
      setCloning(false);
    }
  };

  if (repos.length === 0) {
    return <Text color="red">No repositories selected for cloning.</Text>;
  }

  const modalWidth = Math.min(terminalWidth - 8, 80);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={3}
      paddingY={2}
      width={modalWidth}
    >
      <Text bold color="green">Clone {repos.length === 1 ? 'Repository' : `${repos.length} Repositories`}</Text>
      <Box height={1}><Text> </Text></Box>

      {/* Repository list */}
      <Box flexDirection="column" marginBottom={1}>
        {repos.slice(0, 5).map((repo, i) => (
          <Text key={repo.nameWithOwner} color="white">
            {chalk.cyan(`${i + 1}.`)} {repo.nameWithOwner}
          </Text>
        ))}
        {repos.length > 5 && (
          <Text color="gray">... and {repos.length - 5} more</Text>
        )}
      </Box>
      <Box height={1}><Text> </Text></Box>

      {/* Clone type selection */}
      <Text color="gray">Clone Type:</Text>
      <Box flexDirection="row" marginTop={1}>
        <Box
          paddingX={2}
          paddingY={1}
          borderStyle="single"
          borderColor={focus === 'type' ? (cloneType === 'simple' ? 'green' : 'gray') : (cloneType === 'simple' ? 'green' : 'gray')}
          marginRight={2}
        >
          <Text color={cloneType === 'simple' ? 'green' : 'gray'}>
            {cloneType === 'simple' ? '● ' : '○ '}Simple Clone
          </Text>
        </Box>
        <Box
          paddingX={2}
          paddingY={1}
          borderStyle="single"
          borderColor={focus === 'type' ? (cloneType === 'bare' ? 'green' : 'gray') : (cloneType === 'bare' ? 'green' : 'gray')}
        >
          <Text color={cloneType === 'bare' ? 'green' : 'gray'}>
            {cloneType === 'bare' ? '● ' : '○ '}Bare Repository
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {cloneType === 'simple'
            ? 'Standard clone with working directory'
            : 'Bare clone for git worktrees (no working directory)'}
        </Text>
      </Box>
      <Box height={1}><Text> </Text></Box>

      {/* Target directory */}
      <Text color="gray">Target Directory:</Text>
      <Box
        paddingX={2}
        paddingY={1}
        borderStyle="single"
        borderColor={focus === 'dir' ? 'blue' : 'gray'}
        marginTop={1}
      >
        {editingDir ? (
          <TextInput
            value={targetDir}
            onChange={setTargetDir}
            placeholder="Enter target directory..."
          />
        ) : (
          <Text color={focus === 'dir' ? 'blue' : undefined}>
            {focus === 'dir' ? '▶ ' : '  '}{targetDir || '.'}
          </Text>
        )}
      </Box>
      <Box height={1}><Text> </Text></Box>

      {/* Action buttons */}
      {cloning ? (
        <Box marginTop={1} justifyContent="center">
          <Box flexDirection="row">
            <Box marginRight={1}>
              <SlowSpinner />
            </Box>
            <Text color="green">Cloning {repos.length === 1 ? 'repository' : 'repositories'}...</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={4}>
            <Box paddingX={2} paddingY={1}>
              <Text>
                {focus === 'clone'
                  ? chalk.bgGreen.white.bold(' Clone ')
                  : chalk.green.bold('Clone')}
              </Text>
            </Box>
            <Box paddingX={2} paddingY={1}>
              <Text>
                {focus === 'cancel'
                  ? chalk.bgGray.white.bold(' Cancel ')
                  : chalk.gray.bold('Cancel')}
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">↑↓ Navigate • ←→ Toggle • S Simple • B Bare • Y Clone • Esc/Q Cancel</Text>
          </Box>
        </>
      )}

      {cloneError && (
        <Box marginTop={1}>
          <Text color="red">{cloneError}</Text>
        </Box>
      )}
    </Box>
  );
}

export default CloneModal;

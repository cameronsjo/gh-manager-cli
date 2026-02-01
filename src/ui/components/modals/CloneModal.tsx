import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';
import { PathPreset, PATH_PRESETS, validatePathPattern, getPresetPattern, resolvePathPattern } from '../../../lib/pathPatterns';

export type CloneType = 'simple' | 'bare';

interface CloneProgress {
  current: number;
  total: number;
  currentRepo: RepoNode;
  currentPath: string;
  completed: string[];
  failed: Array<{
    repoId: string;
    repoName: string;
    error: string;
  }>;
}

interface CloneModalProps {
  repos: RepoNode[];
  terminalWidth: number;
  onClose: () => void;
  onClone: (repo: RepoNode, cloneType: CloneType, resolvedPath: string) => Promise<void>;
}

export function CloneModal({ repos, terminalWidth, onClose, onClone }: CloneModalProps) {
  const [cloneType, setCloneType] = useState<CloneType>('simple');
  const [pathPreset, setPathPreset] = useState<PathPreset>('current');
  const [customPattern, setCustomPattern] = useState('');
  const [editingPattern, setEditingPattern] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [focus, setFocus] = useState<'type' | 'preset' | 'clone' | 'cancel'>('type');

  // Handle keyboard input
  useInput((input, key) => {
    if (cloning) return;

    // Handle custom pattern editing mode
    if (editingPattern) {
      if (key.escape) {
        setEditingPattern(false);
        // Validate pattern when exiting edit mode
        const pattern = customPattern || '.';
        const error = validatePathPattern(pattern);
        if (error) {
          setCloneError(error);
        }
        return;
      }
      if (key.return) {
        const pattern = customPattern || '.';
        const error = validatePathPattern(pattern);
        if (error) {
          setCloneError(error);
          return;
        }
        setCloneError(null);
        setEditingPattern(false);
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
      const focusOrder: typeof focus[] = ['type', 'preset', 'clone', 'cancel'];
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
      } else if (focus === 'preset') {
        // Cycle through presets
        const presets: PathPreset[] = ['current', 'by-owner', 'flat', 'custom'];
        const currentIndex = presets.indexOf(pathPreset);
        if (key.leftArrow) {
          const newIndex = currentIndex === 0 ? presets.length - 1 : currentIndex - 1;
          setPathPreset(presets[newIndex]);
        } else {
          const newIndex = currentIndex === presets.length - 1 ? 0 : currentIndex + 1;
          setPathPreset(presets[newIndex]);
        }
      } else if (focus === 'clone' || focus === 'cancel') {
        setFocus(prev => prev === 'clone' ? 'cancel' : 'clone');
      }
      return;
    }

    // Enter to activate focused element
    if (key.return) {
      if (focus === 'type') {
        setCloneType(prev => prev === 'simple' ? 'bare' : 'simple');
      } else if (focus === 'preset') {
        if (pathPreset === 'custom') {
          setEditingPattern(true);
        }
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

    // Get the path pattern to use
    let pattern: string;
    if (pathPreset === 'custom') {
      pattern = customPattern || '.';
      const error = validatePathPattern(pattern);
      if (error) {
        setCloneError(error);
        return;
      }
    } else {
      pattern = getPresetPattern(pathPreset);
    }

    try {
      setCloning(true);
      setCloneError(null);

      // Initialize progress
      const initialProgress: CloneProgress = {
        current: 0,
        total: repos.length,
        currentRepo: repos[0],
        currentPath: '',
        completed: [],
        failed: [],
      };
      setProgress(initialProgress);

      // Process repos sequentially
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        const resolvedPath = resolvePathPattern(pattern, repo);

        // Update progress to show current repo
        setProgress(prev => prev ? {
          ...prev,
          current: i + 1,
          currentRepo: repo,
          currentPath: resolvedPath,
        } : null);

        try {
          // Call the clone handler for single repo
          await onClone(repo, cloneType, resolvedPath);

          // Add to completed
          setProgress(prev => prev ? {
            ...prev,
            completed: [...prev.completed, repo.id],
          } : null);
        } catch (e: any) {
          // Add to failed, continue with next repo
          setProgress(prev => prev ? {
            ...prev,
            failed: [...prev.failed, {
              repoId: repo.id,
              repoName: repo.nameWithOwner,
              error: e.message || 'Failed to clone repository',
            }],
          } : null);
        }
      }

      // Check final results
      if (progress && progress.failed.length === 0) {
        // All succeeded - parent will close modal
        onClose();
      } else if (progress && progress.completed.length === 0) {
        // All failed
        setCloneError(`Failed to clone all ${repos.length} repositories. See details below.`);
        setCloning(false);
      } else if (progress) {
        // Partial success
        setCloneError(
          `Cloned ${progress.completed.length} of ${repos.length} repositories. ` +
          `${progress.failed.length} failed.`
        );
        setCloning(false);
      }
    } catch (e: any) {
      setCloneError(e.message || 'Failed to clone repositories');
      setCloning(false);
      setProgress(null);
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

      {/* Repository list */}
      <Box flexDirection="column" marginTop={1}>
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


      {/* Path preset selector */}
      <Text color="gray">Target Path:</Text>
      <Box flexDirection="column" marginTop={1}>
        {/* Show all presets as options */}
        {(Object.keys(PATH_PRESETS) as PathPreset[]).map((preset) => (
          <Box
            key={preset}
            paddingX={2}
            paddingY={0}
            borderStyle={focus === 'preset' && pathPreset === preset ? 'single' : undefined}
            borderColor={focus === 'preset' && pathPreset === preset ? 'blue' : undefined}
          >
            <Text color={pathPreset === preset ? 'green' : 'gray'}>
              {pathPreset === preset ? '● ' : '○ '}
              {PATH_PRESETS[preset].label}
              {preset !== 'custom' && (
                <Text color="gray" dimColor> ({PATH_PRESETS[preset].pattern})</Text>
              )}
            </Text>
          </Box>
        ))}

        {/* Custom pattern input (shown when custom is selected) */}
        {pathPreset === 'custom' && (
          <Box
            paddingX={2}
            paddingY={1}
            borderStyle="single"
            borderColor="blue"
            marginTop={1}
          >
            {editingPattern ? (
              <TextInput
                value={customPattern}
                onChange={setCustomPattern}
                placeholder="e.g., {owner}/{repo} or code/{repo}"
              />
            ) : (
              <Text color="blue">
                {customPattern || '(press Enter to edit)'}
              </Text>
            )}
          </Box>
        )}
      </Box>


      {/* Action buttons */}
      {cloning ? (
        progress ? (
          <Box marginTop={1} flexDirection="column" alignItems="center">
            <Text color="green">
              Cloning repository {progress.current} of {progress.total}:
            </Text>
            <Text bold color="white" marginTop={1}>
              {progress.currentRepo.nameWithOwner}
            </Text>
            <Text color="gray" dimColor>
              → {progress.currentPath}
            </Text>
            <Box marginTop={1} flexDirection="row">
              <Box marginRight={1}>
                <SlowSpinner />
              </Box>
              <Text color="gray">
                {progress.completed.length} completed, {progress.failed.length} failed
              </Text>
            </Box>
          </Box>
        ) : (
          <Box marginTop={1} justifyContent="center">
            <Box flexDirection="row">
              <Box marginRight={1}>
                <SlowSpinner />
              </Box>
              <Text color="green">Preparing to clone {repos.length === 1 ? 'repository' : 'repositories'}...</Text>
            </Box>
          </Box>
        )
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
            <Text color="gray">↑↓ Navigate • ←→ Toggle • S Simple • B Bare • ⏎ Edit • Y Clone • Esc/Q Cancel</Text>
          </Box>
        </>
      )}

      {cloneError && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{cloneError}</Text>
          {progress && progress.failed.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="gray">Failed repositories:</Text>
              {progress.failed.map((failure) => (
                <Text key={failure.repoId} color="red" dimColor>
                  • {failure.repoName}: {failure.error}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default CloneModal;

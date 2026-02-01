import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../types';
import { SlowSpinner } from '../common';

interface DeleteProgress {
  current: number;        // 1-based index
  total: number;
  currentRepo: RepoNode;
  completed: string[];    // Repo IDs
  failed: Array<{
    repoId: string;
    repoName: string;
    error: string;
  }>;
}

interface DeleteModalProps {
  repos: RepoNode[];
  onDelete: (repo: RepoNode) => Promise<void>;
  onCancel: () => void;
}

export default function DeleteModal({ repos, onDelete, onCancel }: DeleteModalProps) {
  const [deleteCode, setDeleteCode] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState(false); // true after code verified
  const [confirmFocus, setConfirmFocus] = useState<'delete' | 'cancel'>('delete');
  const [progress, setProgress] = useState<DeleteProgress | null>(null);

  // Generate a random 6-character code when the modal opens
  useEffect(() => {
    if (repos.length > 0) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit similar-looking chars
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setDeleteCode(code);
      setTypedCode('');
      setDeleteConfirmStage(false);
      setConfirmFocus('delete');
      setDeleteError(null);
      setProgress(null);
    }
  }, [repos.length]);

  // Handle keyboard input for the confirmation stage
  useInput((input, key) => {
    if (!deleteConfirmStage) return; // Only handle input in confirmation stage
    
    if (key.escape || input.toLowerCase() === 'c') {
      onCancel();
      return;
    }
    
    if (input.toLowerCase() === 'y') {
      handleDeleteConfirm();
      return;
    }
    
    if (key.return) {
      if (confirmFocus === 'delete') {
        handleDeleteConfirm();
      } else {
        onCancel();
      }
      return;
    }
    
    if (key.leftArrow || key.rightArrow) {
      setConfirmFocus(prev => prev === 'delete' ? 'cancel' : 'delete');
    }
  });

  // Handle the delete confirmation
  const handleDeleteConfirm = async () => {
    if (repos.length === 0 || deleting) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      // Initialize progress
      const initialProgress: DeleteProgress = {
        current: 0,
        total: repos.length,
        currentRepo: repos[0],
        completed: [],
        failed: [],
      };
      setProgress(initialProgress);

      // Process repos sequentially
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];

        // Update progress to show current repo
        setProgress(prev => prev ? {
          ...prev,
          current: i + 1,
          currentRepo: repo,
        } : null);

        try {
          // Call the delete handler for single repo
          await onDelete(repo);

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
              error: e.message || 'Failed to delete repository',
            }],
          } : null);
        }
      }

      // Check final results
      const finalProgress = progress || initialProgress;
      if (finalProgress.failed.length === 0) {
        // All succeeded - will auto-close via parent component
        // Parent should handle success toast
      } else if (finalProgress.completed.length === 0) {
        // All failed
        setDeleteError(`Failed to delete all ${repos.length} repositories. See details below.`);
        setDeleting(false);
      } else {
        // Partial success
        setDeleteError(
          `Deleted ${finalProgress.completed.length} of ${repos.length} repositories. ` +
          `${finalProgress.failed.length} failed.`
        );
        setDeleting(false);
      }
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete repositories');
      setDeleting(false);
    }
  };

  // Handle the verification code submission
  const handleCodeSubmit = () => {
    if (typedCode.toUpperCase() === deleteCode) {
      setDeleteConfirmStage(true);
    } else {
      setDeleteError('Incorrect verification code. Please try again.');
      setTypedCode('');
    }
  };

  if (repos.length === 0) return null;

  const displayRepos = repos.slice(0, 5);
  const hasMore = repos.length > 5;

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor="red" 
      paddingX={3} 
      paddingY={2}
      width={60}
    >
      {!deleteConfirmStage ? (
        // First stage: Enter verification code
        <>
          <Text bold color="red">⚠️ Delete {repos.length === 1 ? 'Repository' : `${repos.length} Repositories`}</Text>

          {/* Show repository list */}
          <Box flexDirection="column" marginTop={1}>
            {displayRepos.map((repo, i) => (
              <Text key={repo.id} color="white">
                {chalk.cyan(`${i + 1}.`)} {repo.nameWithOwner}
              </Text>
            ))}
            {hasMore && (
              <Text color="gray">... and {repos.length - 5} more</Text>
            )}
          </Box>

          <Box height={1}><Text> </Text></Box>
          <Text color="red">⚠️  This CANNOT be undone</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>Type <Text color="yellow" bold>{deleteCode}</Text> to confirm:</Text>
          <Box marginTop={1}>
            <Text>Verification code: </Text>
            <TextInput
              value={typedCode}
              onChange={setTypedCode}
              onSubmit={handleCodeSubmit}
            />
          </Box>
          {deleteError && (
            <Box marginTop={1}>
              <Text color="red">{deleteError}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">Press Esc to cancel</Text>
          </Box>
        </>
      ) : (
        // Second stage: Final confirmation and deletion progress
        <>
          <Text bold color="red">⚠️ Delete {repos.length === 1 ? 'Repository' : `${repos.length} Repositories`}</Text>

          {!deleting ? (
            <>
              {/* Pre-deletion confirmation */}
              {displayRepos.map((repo, i) => (
                <Text key={repo.id} bold>
                  {chalk.cyan(`${i + 1}.`)} {repo.nameWithOwner}
                </Text>
              ))}
              {hasMore && (
                <Text color="gray">... and {repos.length - 5} more</Text>
              )}
              <Box height={1}><Text> </Text></Box>
              <Text color="red">Ready to delete?</Text>

              {/* Action buttons */}
              <Box marginTop={2} flexDirection="row" justifyContent="center" gap={4}>
                <Box
                  paddingX={2}
                  paddingY={1}
                  flexDirection="column"
                >
                  <Text>
                    {confirmFocus === 'delete' ?
                      chalk.bgRed.white.bold(' Delete ') :
                      chalk.red.bold('Delete')
                    }
                  </Text>
                </Box>
                <Box
                  paddingX={2}
                  paddingY={1}
                  flexDirection="column"
                >
                  <Text>
                    {confirmFocus === 'cancel' ?
                      chalk.bgGray.white.bold(' Cancel ') :
                      chalk.gray.bold('Cancel')
                    }
                  </Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} • Y to confirm • C to cancel</Text>
              </Box>
            </>
          ) : progress ? (
            <>
              {/* Show progress during deletion */}
              <Text color="yellow">
                Deleting repository {progress.current} of {progress.total}:
              </Text>
              <Text bold color="white" marginTop={1}>
                {progress.currentRepo.nameWithOwner}
              </Text>
              <Box marginTop={2} justifyContent="center">
                <Box flexDirection="row">
                  <Box marginRight={1}>
                    <SlowSpinner />
                  </Box>
                  <Text color="gray">
                    {progress.completed.length} completed, {progress.failed.length} failed
                  </Text>
                </Box>
              </Box>
            </>
          ) : (
            <Box marginTop={2} justifyContent="center">
              <Box flexDirection="row">
                <Box marginRight={1}>
                  <SlowSpinner />
                </Box>
                <Text color="yellow">Deleting {repos.length === 1 ? 'repository' : 'repositories'}...</Text>
              </Box>
            </Box>
          )}

          {deleteError && (
            <Box marginTop={1} flexDirection="column">
              <Text color="red">{deleteError}</Text>
              {progress && progress.failed.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="gray">Failed repositories:</Text>
                  {progress.failed.map((failure, i) => (
                    <Text key={failure.repoId} color="red" dimColor>
                      • {failure.repoName}: {failure.error}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}


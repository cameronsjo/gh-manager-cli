import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { RepoNode } from '../../../../types';
import type { OwnerContext } from '../../../../config/config';
import { formatDate } from '../../../../lib/utils';
import { DELETE_CODE_LENGTH } from '../../../../config/constants';
import {
  DeleteModal,
  ArchiveModal,
  SyncModal,
  LogoutModal,
  VisibilityModal,
  SortModal,
  SortDirectionModal,
  ChangeVisibilityModal,
  CopyUrlModal,
  RenameModal,
  StarModal,
  CloneModal,
  UnstarModal,
} from '../../../components/modals';
import type { CloneType } from '../../../components/modals';
import OrgSwitcher from '../../../OrgSwitcher';
import type { SortKey, VisibilityFilter } from '../../../components/modals/SortModal';

interface ModalState<T = any> {
  isOpen: boolean;
  target: T | null;
  loading: boolean;
  error: string | null;
}

interface RepoListModalsProps {
  // Terminal dimensions
  terminalWidth: number;
  contentHeight: number;

  // Delete modal
  deleteModal: ModalState<RepoNode>;
  deleteCode: string;
  typedCode: string;
  deleteConfirmStage: boolean;
  confirmFocus: 'delete' | 'cancel';
  onDeleteCodeChange: (code: string) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;

  // Archive modal
  archiveModal: ModalState<RepoNode>;
  archiveFocus: 'confirm' | 'cancel';
  onArchiveCancel: () => void;
  onArchiveConfirm: () => void;

  // Sync modal
  syncModal: ModalState<RepoNode>;
  syncFocus: 'confirm' | 'cancel';
  forkTracking: boolean;
  onSyncCancel: () => void;
  onSyncConfirm: () => void;

  // Logout modal
  logoutMode: boolean;
  logoutFocus: 'confirm' | 'cancel';
  logoutError: string | null;
  onLogoutCancel: () => void;
  onLogoutConfirm: () => void;

  // Organization switcher
  orgSwitcherOpen: boolean;
  token: string;
  ownerContext: OwnerContext;
  onOrgSelect: (context: OwnerContext) => void;
  onOrgClose: () => void;

  // Info modal
  infoMode: boolean;
  infoRepo: RepoNode | null;
  visibleItems: RepoNode[];
  cursor: number;

  // Visibility modal
  visibilityMode: boolean;
  visibilityFilter: VisibilityFilter;
  isEnterpriseOrg: boolean;
  onVisibilitySelect: (filter: VisibilityFilter) => void;
  onVisibilityCancel: () => void;

  // Sort modals
  sortMode: boolean;
  sortKey: SortKey;
  onSortSelect: (sort: SortKey) => void;
  onSortCancel: () => void;

  sortDirectionMode: boolean;
  sortDir: 'asc' | 'desc';
  onSortDirSelect: (dir: 'asc' | 'desc') => void;
  onSortDirCancel: () => void;

  // Change visibility modal
  visibilityChangeModal: ModalState<RepoNode>;
  onVisibilityChange: (visibility: string) => void;
  onVisibilityChangeCancel: () => void;

  // Rename modal
  renameModal: ModalState<RepoNode>;
  onRename: (repo: RepoNode, newName: string) => Promise<void>;
  onRenameCancel: () => void;

  // Copy URL modal
  copyModal: ModalState<RepoNode>;
  onCopyUrl: (url: string, type: 'SSH' | 'HTTPS') => Promise<void>;
  onCopyCancel: () => void;

  // Unstar modal
  unstarModal: ModalState<RepoNode>;
  onUnstar: () => void;
  onUnstarCancel: () => void;

  // Star modal
  starModal: ModalState<RepoNode>;
  onStar: () => void;
  onStarCancel: () => void;

  // Clone modal
  cloneModal: ModalState<RepoNode>;
  getSelectedRepos: () => RepoNode[];
  onClone: (repos: RepoNode[], cloneType: CloneType, targetDir: string) => Promise<void>;
  onCloneCancel: () => void;
}

export function RepoListModals(props: RepoListModalsProps): JSX.Element | null {
  const {
    terminalWidth,
    contentHeight,
    deleteModal,
    deleteCode,
    typedCode,
    deleteConfirmStage,
    confirmFocus,
    onDeleteCodeChange,
    onDeleteCancel,
    onDeleteConfirm,
    archiveModal,
    archiveFocus,
    onArchiveCancel,
    onArchiveConfirm,
    syncModal,
    syncFocus,
    forkTracking,
    onSyncCancel,
    onSyncConfirm,
    logoutMode,
    logoutFocus,
    logoutError,
    onLogoutCancel,
    onLogoutConfirm,
    orgSwitcherOpen,
    token,
    ownerContext,
    onOrgSelect,
    onOrgClose,
    infoMode,
    infoRepo,
    visibleItems,
    cursor,
    visibilityMode,
    visibilityFilter,
    isEnterpriseOrg,
    onVisibilitySelect,
    onVisibilityCancel,
    sortMode,
    sortKey,
    onSortSelect,
    onSortCancel,
    sortDirectionMode,
    sortDir,
    onSortDirSelect,
    onSortDirCancel,
    visibilityChangeModal,
    onVisibilityChange,
    onVisibilityChangeCancel,
    renameModal,
    onRename,
    onRenameCancel,
    copyModal,
    onCopyUrl,
    onCopyCancel,
    unstarModal,
    onUnstar,
    onUnstarCancel,
    starModal,
    onStar,
    onStarCancel,
    cloneModal,
    getSelectedRepos,
    onClone,
    onCloneCancel,
  } = props;

  // Delete modal
  if (deleteModal.isOpen && deleteModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
          <Text bold>Delete Confirmation</Text>
          <Text color="red">⚠️  Delete repository?</Text>
          <Box height={2}>
            <Text> </Text>
          </Box>
          {(() => {
            const langName = deleteModal.target.primaryLanguage?.name || '';
            const langColor = deleteModal.target.primaryLanguage?.color || '#666666';
            let line1 = '';
            line1 += chalk.white(deleteModal.target.nameWithOwner);
            if (deleteModal.target.isPrivate) line1 += chalk.yellow(' Private');
            if (deleteModal.target.isArchived) line1 += chalk.gray.dim(' Archived');
            if (deleteModal.target.isFork && deleteModal.target.parent) line1 += chalk.blue(` Fork of ${deleteModal.target.parent.nameWithOwner}`);
            let line2 = '';
            if (langName) line2 += chalk.hex(langColor)('● ') + chalk.gray(`${langName}  `);
            line2 += chalk.gray(`★ ${deleteModal.target.stargazerCount}  ⑂ ${deleteModal.target.forkCount}  Updated ${formatDate(deleteModal.target.updatedAt)}`);
            return (
              <>
                <Text>{line1}</Text>
                <Text>{line2}</Text>
              </>
            );
          })()}
          <Box marginTop={1}>
            <Text>
              Type <Text color="yellow" bold>{deleteCode}</Text> to confirm.
            </Text>
          </Box>
          {!deleteConfirmStage && (
            <Box marginTop={1}>
              <Text>Confirm code: </Text>
              <TextInput
                value={typedCode}
                onChange={onDeleteCodeChange}
                onSubmit={() => { /* no-op: auto-advance on 4 chars */ }}
                placeholder={deleteCode}
              />
            </Box>
          )}
          {deleteConfirmStage && (
            <Box marginTop={1} flexDirection="column">
              <Text color="red">
                This action will permanently delete the repository. This cannot be undone.
              </Text>
              <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
                <Box
                  borderStyle="round"
                  borderColor="red"
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>{confirmFocus === 'delete' ? chalk.bgRed.white.bold(' Delete ') : chalk.red.bold('Delete')}</Text>
                </Box>
                <Box
                  borderStyle="round"
                  borderColor={confirmFocus === 'cancel' ? 'white' : 'gray'}
                  height={3}
                  width={20}
                  alignItems="center"
                  justifyContent="center"
                  flexDirection="column"
                >
                  <Text>{confirmFocus === 'cancel' ? chalk.bgGray.white.bold(' Cancel ') : chalk.gray.bold('Cancel')}</Text>
                </Box>
              </Box>
              <Box marginTop={1} flexDirection="row" justifyContent="center">
                <Text color="gray">
                  Press Enter to {confirmFocus === 'delete' ? 'Delete' : 'Cancel'} | Y to Delete | C to Cancel
                </Text>
              </Box>
              <Box marginTop={1}>
                <TextInput
                  value=""
                  onChange={() => { /* noop */ }}
                  onSubmit={() => {
                    if (confirmFocus === 'delete') onDeleteConfirm();
                    else onDeleteCancel();
                  }}
                  placeholder=""
                />
              </Box>
            </Box>
          )}
          {deleteModal.error && (
            <Box marginTop={1}>
              <Text color="magenta">{deleteModal.error}</Text>
            </Box>
          )}
          {deleteModal.loading && (
            <Box marginTop={1}>
              <Text color="yellow">Deleting...</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Archive modal
  if (archiveModal.isOpen && archiveModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <Box flexDirection="column" borderStyle="round" borderColor={archiveModal.target.isArchived ? 'green' : 'yellow'} paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
          <Text bold>{archiveModal.target.isArchived ? 'Unarchive Confirmation' : 'Archive Confirmation'}</Text>
          <Text color={archiveModal.target.isArchived ? 'green' : 'yellow'}>
            {archiveModal.target.isArchived ? '↺  Unarchive repository?' : '⚠️  Archive repository?'}
          </Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{archiveModal.target.nameWithOwner}</Text>
          <Box marginTop={1}>
            <Text>
              {archiveModal.target.isArchived ? 'This will make the repository active again.' : 'This will make the repository read-only.'}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
            <Box
              borderStyle="round"
              borderColor={archiveModal.target.isArchived ? 'green' : 'yellow'}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {archiveFocus === 'confirm' ?
                  chalk.bgGreen.white.bold(` ${archiveModal.target.isArchived ? 'Unarchive' : 'Archive'} `) :
                  chalk.bold[archiveModal.target.isArchived ? 'green' : 'yellow'](archiveModal.target.isArchived ? 'Unarchive' : 'Archive')
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={archiveFocus === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {archiveFocus === 'cancel' ?
                  chalk.bgGray.white.bold(' Cancel ') :
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Press Enter to {archiveFocus === 'confirm' ? (archiveModal.target.isArchived ? 'Unarchive' : 'Archive') : 'Cancel'} | Y to {archiveModal.target.isArchived ? 'Unarchive' : 'Archive'} | C to Cancel</Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value=""
              onChange={() => { /* noop */ }}
              onSubmit={() => {
                if (archiveFocus === 'confirm') {
                  onArchiveConfirm();
                } else {
                  onArchiveCancel();
                }
              }}
            />
          </Box>
          {archiveModal.error && (
            <Box marginTop={1}>
              <Text color="magenta">{archiveModal.error}</Text>
            </Box>
          )}
          {archiveModal.loading && (
            <Box marginTop={1}>
              <Text color="yellow">{archiveModal.target.isArchived ? 'Unarchiving...' : 'Archiving...'}</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Sync modal
  if (syncModal.isOpen && syncModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
          <Text bold>Sync Fork Confirmation</Text>
          <Text color="blue">⟲  Sync fork with upstream?</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{syncModal.target.nameWithOwner}</Text>
          {syncModal.target.parent && (
            <Text color="gray">Upstream: {syncModal.target.parent.nameWithOwner}</Text>
          )}
          <Box marginTop={1}>
            <Text>
              This will merge upstream changes into your fork.
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
            <Box
              borderStyle="round"
              borderColor="blue"
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {syncFocus === 'confirm' ?
                  chalk.bgBlue.white.bold(' Sync ') :
                  chalk.blue.bold('Sync')
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={syncFocus === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {syncFocus === 'cancel' ?
                  chalk.bgGray.white.bold(' Cancel ') :
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Press Enter to {syncFocus === 'confirm' ? 'Sync' : 'Cancel'} | Y to Sync | C to Cancel</Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value=""
              onChange={() => { /* noop */ }}
              onSubmit={() => {
                if (syncFocus === 'confirm') {
                  onSyncConfirm();
                } else {
                  onSyncCancel();
                }
              }}
            />
          </Box>
          {syncModal.error && (
            <Box marginTop={1}>
              <Text color="magenta">{syncModal.error}</Text>
            </Box>
          )}
          {syncModal.loading && (
            <Box marginTop={1}>
              <Text color="yellow">Syncing...</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Logout modal
  if (logoutMode) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 80)}>
          <Text bold>Logout Confirmation</Text>
          <Text color="cyan">Are you sure you want to log out?</Text>
          <Box marginTop={1} flexDirection="row" justifyContent="center" gap={6}>
            <Box
              borderStyle="round"
              borderColor="cyan"
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {logoutFocus === 'confirm' ?
                  chalk.bgCyan.white.bold(' Logout ') :
                  chalk.cyan.bold('Logout')
                }
              </Text>
            </Box>
            <Box
              borderStyle="round"
              borderColor={logoutFocus === 'cancel' ? 'white' : 'gray'}
              height={3}
              width={20}
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
            >
              <Text>
                {logoutFocus === 'cancel' ?
                  chalk.bgGray.white.bold(' Cancel ') :
                  chalk.gray.bold('Cancel')
                }
              </Text>
            </Box>
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="center">
            <Text color="gray">Press Enter to {logoutFocus === 'confirm' ? 'Logout' : 'Cancel'} | Y to Logout | C to Cancel</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Organization switcher
  if (orgSwitcherOpen) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <OrgSwitcher
          token={token}
          currentContext={ownerContext}
          onSelect={onOrgSelect}
          onClose={onOrgClose}
        />
      </Box>
    );
  }

  // Info modal
  if (infoMode) {
    const repo = infoRepo || visibleItems[cursor];
    if (!repo) {
      return (
        <Box height={contentHeight} alignItems="center" justifyContent="center">
          <Text color="red">No repository selected.</Text>
        </Box>
      );
    }

    const langName = repo.primaryLanguage?.name || 'N/A';
    const langColor = repo.primaryLanguage?.color || '#666666';

    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={3} paddingY={2} width={Math.min(terminalWidth - 8, 90)}>
          <Text bold>Repository Info {infoRepo ? chalk.dim('(cached)') : ''}</Text>
          <Box height={1}><Text> </Text></Box>
          <Text>{chalk.bold(repo.nameWithOwner)}</Text>
          {repo.description && <Text color="gray">{repo.description}</Text>}
          <Box height={1}><Text> </Text></Box>
          <Text>
            {repo.visibility === 'PRIVATE' ? chalk.yellow('Private') :
             repo.visibility === 'INTERNAL' ? chalk.magenta('Internal') :
             chalk.green('Public')}
            {repo.isArchived ? chalk.gray('  Archived') : ''}
            {repo.isFork ? chalk.blue('  Fork') : ''}
          </Text>
          <Text>
            {chalk.gray(`★ ${repo.stargazerCount}  ⑂ ${repo.forkCount}`)}
          </Text>
          <Text>
            {chalk.hex(langColor)(`● `)}{chalk.gray(`${langName}`)}
          </Text>
          <Text color="gray">Updated: {formatDate(repo.updatedAt)} • Pushed: {formatDate(repo.pushedAt)}</Text>
          <Text color="gray">Size: {repo.diskUsage} KB</Text>
          <Box height={1}><Text> </Text></Box>
          <Text color="gray">Press Esc or I to close</Text>
        </Box>
      </Box>
    );
  }

  // Visibility modal
  if (visibilityMode) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <VisibilityModal
          currentFilter={visibilityFilter}
          isEnterprise={isEnterpriseOrg}
          onSelect={onVisibilitySelect}
          onCancel={onVisibilityCancel}
        />
      </Box>
    );
  }

  // Sort modal
  if (sortMode) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <SortModal
          currentSort={sortKey}
          onSelect={onSortSelect}
          onCancel={onSortCancel}
        />
      </Box>
    );
  }

  // Sort direction modal
  if (sortDirectionMode) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <SortDirectionModal
          currentDirection={sortDir}
          currentSortKey={sortKey}
          onSelect={onSortDirSelect}
          onCancel={onSortDirCancel}
        />
      </Box>
    );
  }

  // Change visibility modal
  if (visibilityChangeModal.isOpen && visibilityChangeModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <ChangeVisibilityModal
          isOpen={visibilityChangeModal.isOpen}
          repoName={visibilityChangeModal.target.nameWithOwner}
          currentVisibility={visibilityChangeModal.target.visibility}
          isFork={visibilityChangeModal.target.isFork}
          isEnterprise={isEnterpriseOrg}
          onVisibilityChange={onVisibilityChange}
          onClose={onVisibilityChangeCancel}
          changing={visibilityChangeModal.loading}
          error={visibilityChangeModal.error}
        />
      </Box>
    );
  }

  // Rename modal
  if (renameModal.isOpen && renameModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <RenameModal
          repo={renameModal.target}
          onRename={onRename}
          onCancel={onRenameCancel}
        />
      </Box>
    );
  }

  // Copy URL modal
  if (copyModal.isOpen) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <CopyUrlModal
          repo={copyModal.target}
          terminalWidth={terminalWidth}
          onClose={onCopyCancel}
          onCopy={onCopyUrl}
        />
      </Box>
    );
  }

  // Unstar modal
  if (unstarModal.isOpen && unstarModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <UnstarModal
          visible={unstarModal.isOpen}
          repo={unstarModal.target}
          onConfirm={onUnstar}
          onCancel={onUnstarCancel}
          isUnstarring={unstarModal.loading}
          error={unstarModal.error}
        />
      </Box>
    );
  }

  // Star modal
  if (starModal.isOpen && starModal.target) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <StarModal
          visible={starModal.isOpen}
          repo={starModal.target}
          isStarred={starModal.target.viewerHasStarred || false}
          onConfirm={onStar}
          onCancel={onStarCancel}
          isStarring={starModal.loading}
          error={starModal.error}
        />
      </Box>
    );
  }

  // Clone modal
  if (cloneModal.isOpen) {
    return (
      <Box height={contentHeight} alignItems="center" justifyContent="center">
        <CloneModal
          repos={getSelectedRepos()}
          terminalWidth={terminalWidth}
          onClose={onCloneCancel}
          onClone={onClone}
        />
      </Box>
    );
  }

  return null;
}

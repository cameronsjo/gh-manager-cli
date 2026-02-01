# Multi-Select Bulk Operations Design

**Date:** 2026-01-31
**Status:** Approved
**Author:** Cameron Sjo

## Overview

This design adds enhanced multi-select capabilities for bulk clone and delete operations in gh-manager-cli, including pattern-based path organization for clones and progress tracking for all bulk operations.

## Goals

- Enable efficient bulk deletion of multiple repositories
- Support flexible path patterns for organizing cloned repositories
- Provide clear progress feedback during bulk operations
- Maintain consistency between clone and delete UX

## User Flow

### Multi-Select Mode

Multi-select mode already exists and is toggled with the `M` key:

1. User presses `M` to enter multi-select mode
2. Status bar shows: "Multi-Select: 0 selected • Space Toggle • Ctrl+A All • M Exit • Shift+C Clone • Del Delete"
3. User selects repos with:
   - `Space` - Toggle selection on current repo
   - `Ctrl+A` - Toggle select-all/deselect-all
   - Arrow keys navigate without affecting selection
4. User performs bulk operation:
   - `Shift+C` - Clone selected repos
   - `Del/Backspace` - Delete selected repos
5. Press `M` again to exit multi-select and clear selections

### Bulk Delete

**Requirements:**
- Must be in multi-select mode
- At least 1 repo must be selected
- Press `Del` or `Backspace` to trigger

**Confirmation Flow:**
1. DeleteModal opens showing:
   - List of repos to delete (first 5 + "and X more" if >5)
   - Single random verification code (e.g., "XK42P7")
   - Warning text
2. User types verification code
3. After verification, sequential deletion begins:
   - Progress shown: "Deleting repository 2 of 5: facebook/react"
   - Each repo deleted via GitHub API
   - Continues even if some fail
4. Final summary:
   - All success: "Successfully deleted 5 repositories" (2s toast, auto-close)
   - Partial: "Deleted 3 of 5 repositories (2 failed)" - shows failed list
   - All failed: Error modal with details

### Bulk Clone with Path Patterns

**Requirements:**
- Must be in multi-select mode
- At least 1 repo must be selected
- Press `Shift+C` to trigger

**Clone Configuration:**
1. CloneModal opens showing:
   - List of repos to clone (first 5 + "and X more" if >5)
   - Clone type selector (Simple/Bare)
   - **NEW:** Target directory preset selector

**Target Directory Presets:**
```
Target Directory: [Dropdown ▼]

Options:
  ● Current directory     (.)
  ○ By owner             ({owner}/{repo})
  ○ Flat                 ({repo})
  ○ Custom...            [opens text input]
```

**Pattern Variables:**
- `{owner}` - Repository owner (organization or username)
- `{repo}` - Repository name only
- `{full}` - Full nameWithOwner (e.g., "facebook/react")

**Examples:**
- Pattern: `{owner}/{repo}` + Repo: `facebook/react` = `facebook/react/`
- Pattern: `code/{owner}/{repo}` + Repo: `vercel/next.js` = `code/vercel/next.js/`
- Pattern: `{repo}` + Repo: `torvalds/linux` = `linux/`
- Bare clone adds `.git`: `{owner}/{repo}` becomes `facebook/react.git/`

**Clone Execution:**
1. User selects preset or enters custom pattern
2. Clicks "Clone" button
3. Sequential cloning begins:
   - Progress shown: "Cloning repository 2 of 5: facebook/react → code/facebook/react"
   - Pattern resolved per-repository
   - Each repo cloned via git command
   - Continues even if some fail
4. Final summary (same format as delete)

## Component Changes

### 1. DeleteModal (`src/ui/components/modals/DeleteModal.tsx`)

**Current Interface:**
```typescript
interface DeleteModalProps {
  repo: RepoNode | null;
  onDelete: (repo: RepoNode) => Promise<void>;
  onCancel: () => void;
}
```

**New Interface:**
```typescript
interface DeleteModalProps {
  repos: RepoNode[];  // Changed from single repo
  onDelete: (repos: RepoNode[]) => Promise<void>;  // Batch operation
  onCancel: () => void;
}
```

**New State:**
```typescript
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
```

**UI Changes:**
- Show repo list (first 5 with "and X more")
- Single verification code stage
- Progress display during deletion
- Summary with success/failure counts

### 2. CloneModal (`src/ui/components/modals/CloneModal.tsx`)

**Current Interface:**
```typescript
interface CloneModalProps {
  repos: RepoNode[];  // Already supports multiple
  terminalWidth: number;
  onClose: () => void;
  onClone: (repos: RepoNode[], cloneType: CloneType, targetDir: string) => Promise<void>;
}
```

**New Interface (enhanced):**
```typescript
type PathPreset = 'current' | 'by-owner' | 'flat' | 'custom';

interface CloneModalProps {
  repos: RepoNode[];
  terminalWidth: number;
  onClose: () => void;
  onClone: (repos: RepoNode[], cloneType: CloneType, pathPattern: string) => Promise<void>;
}
```

**New State:**
```typescript
interface CloneProgress {
  current: number;
  total: number;
  currentRepo: RepoNode;
  currentPath: string;    // Resolved path for display
  completed: string[];
  failed: Array<{
    repoId: string;
    repoName: string;
    error: string;
  }>;
}

// Modal state
const [pathPreset, setPathPreset] = useState<PathPreset>('current');
const [customPattern, setCustomPattern] = useState('');
const [progress, setProgress] = useState<CloneProgress | null>(null);
```

**UI Changes:**
- Add preset dropdown for target directory
- Custom option reveals text input
- Progress display: "Cloning repository 2 of 5: facebook/react → code/facebook/react"
- Summary with success/failure counts

### 3. RepoList (`src/ui/views/RepoList.tsx`)

**Keyboard Handler Changes:**
```typescript
// In multi-select mode, handle Delete/Backspace
if ((key.delete || key.backspace) && multiSelectMode) {
  const reposToDelete = getSelectedReposArray();
  if (reposToDelete.length > 0) {
    deleteModal.open();
    // Generate verification code
    const code = generateDeleteCode();
    setDeleteCode(code);
  }
  return;
}
```

**Status Bar Changes:**
```typescript
// Multi-select mode hint
"Multi-Select: {count} selected • Space Toggle • Ctrl+A All • M Exit • Shift+C Clone • Del Delete"
```

## Pattern Substitution Logic

**Implementation (`src/lib/pathPatterns.ts`):**

```typescript
export function resolvePathPattern(
  pattern: string,
  repo: RepoNode
): string {
  const owner = repo.nameWithOwner.split('/')[0];
  const repoName = repo.name;
  const full = repo.nameWithOwner;

  let resolved = pattern
    .replace(/{owner}/g, sanitizePath(owner))
    .replace(/{repo}/g, sanitizePath(repoName))
    .replace(/{full}/g, sanitizePath(full));

  return resolved;
}

export function sanitizePath(segment: string): string {
  // Replace invalid filesystem characters
  return segment.replace(/[<>:"|?*]/g, '-');
}

export const PATH_PRESETS: Record<PathPreset, string> = {
  current: '.',
  'by-owner': '{owner}/{repo}',
  flat: '{repo}',
  custom: '', // User-provided
};
```

## Error Handling

### Pattern Validation
- Check for unmatched braces
- Warn on invalid characters
- Validate path doesn't navigate up (no `..`)

### Operation Failures
- Continue processing remaining repos on failure
- Collect errors for summary
- Don't stop batch on single failure

### Partial Success Handling
- Show count of successes vs failures
- List failed repos with error messages
- Allow retry of failed operations

## Testing Strategy

### Manual Testing
1. **Multi-select mode:**
   - Enter/exit multi-select mode
   - Select/deselect individual repos
   - Select all/deselect all
   - Visual indicators correct

2. **Bulk delete:**
   - Delete 1 repo in multi-select mode
   - Delete 5 repos successfully
   - Delete with some failures
   - Cancel at verification stage
   - Cancel during deletion

3. **Bulk clone with patterns:**
   - Test each preset (current, by-owner, flat)
   - Test custom patterns with all variables
   - Test with bare and simple clone types
   - Test with some clone failures
   - Verify directory structure created correctly

4. **Progress tracking:**
   - Verify counter updates correctly
   - Verify current repo name shown
   - Verify final summary accurate

### Edge Cases
- Empty selection (should not open modal)
- Single repo selected (should work same as multi)
- Very long repo lists (>20)
- Repos with special characters in names
- Network failures during operations
- Disk space issues during clone
- Permission errors

## Future Enhancements

- Parallel operations (clone/delete multiple repos simultaneously)
- Additional pattern variables ({language}, {date}, {stars})
- Clone queue management (pause/resume)
- Persistent clone preferences
- Undo for accidental bulk deletes
- Export/import selection sets

## Migration Notes

**Breaking Changes:**
- DeleteModal interface changes from single repo to array
- CloneModal `targetDir` becomes `pathPattern`

**Backwards Compatibility:**
- Single-repo delete still works (press Del without multi-select mode)
- Single-repo clone still works (select 1 repo in multi-select)
- Existing clone behavior preserved with "current directory" preset

## Success Criteria

- [ ] Can select multiple repos in multi-select mode
- [ ] Can delete multiple repos with single verification code
- [ ] Progress shown during delete operations
- [ ] Can clone multiple repos with path patterns
- [ ] All three presets work correctly
- [ ] Custom patterns support all three variables
- [ ] Progress shown during clone operations
- [ ] Partial failures handled gracefully
- [ ] Status bar shows correct hints in multi-select mode
- [ ] Single-repo operations still work as before

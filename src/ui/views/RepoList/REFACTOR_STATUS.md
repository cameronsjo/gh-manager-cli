# RepoList Refactoring Status

## Overview
The RepoList.tsx file is currently ~2700 lines and needs to be split into smaller, focused components.

## Completed Extractions

### 1. Components Created
- **RepoListFooter.tsx** (~/src/ui/views/RepoList/components/RepoListFooter.tsx)
  - Keyboard shortcuts display
  - Multi-select indicator
  - Debug panel
  - Toast notifications (copy/clone)
  - ~120 lines

- **RepoListModals.tsx** (~/src/ui/views/RepoList/components/RepoListModals.tsx)
  - All modal rendering logic (delete, archive, sync, logout, org switcher, info, visibility, sort, rename, copy, star/unstar, clone)
  - Single component that switches based on which modal is active
  - ~670 lines

- **RepoListContent.tsx** (~/src/ui/views/RepoList/components/RepoListContent.tsx)
  - Filter input display
  - Scrollable repository list with windowing
  - Loading states and empty states
  - ~120 lines

## Remaining Work

### Main RepoList.tsx Refactoring
The main RepoList.tsx file still needs to be refactored to:

1. **Import extracted components**:
   ```typescript
   import { RepoListFooter, RepoListModals, RepoListContent } from './components';
   ```

2. **Replace inline modal rendering** (lines 2039-2506):
   - Currently has massive if/else chain for rendering modals
   - Should be replaced with single `<RepoListModals />` component
   - Need to pass all modal states and handlers as props

3. **Replace footer rendering** (lines 2629-2703):
   - Replace with `<RepoListFooter />` component
   - Pass terminal width, modal state, toast state, etc.

4. **Replace content rendering** (lines 2509-2625):
   - Replace filter input and repository list with `<RepoListContent />` component
   - Pass windowing calculations, filter state, visible items, etc.

### Architecture Decisions

#### Why Not Extract State Management?
The state in this component is highly interconnected:
- Modal states depend on repository items
- Repository items depend on search/filter/sort state
- Sort state triggers data fetching
- Visibility changes affect both items and search results

Extracting state into a hook would require:
- Passing 50+ pieces of state/setters around
- Complex dependency management
- Risk of breaking subtle interactions

**Decision**: Keep state management in main component for now. Focus on extracting presentation logic.

#### Why Not Extract Action Handlers?
Similar reasoning to state:
- Actions depend on multiple pieces of state
- Actions update cache, local state, and trigger side effects
- Actions are tightly coupled to modal states

Creating a `useActions` hook would require passing the entire state object and all setters, providing minimal benefit.

**Decision**: Keep action handlers in main component.

### Recommended Next Steps

1. **Create a simplified main RepoList.tsx** that:
   - Keeps all state management and hooks (useInput, useEffect, etc.)
   - Keeps all action handlers
   - Replaces presentation logic with the three extracted components
   - Reduces file from ~2700 lines to ~1500-1800 lines (still large, but more manageable)

2. **Extract utility functions** (could reduce another 100-200 lines):
   - `calculateWindowBounds()`
   - `getVisibleItems()` (filtered/sorted/searched logic)
   - `openInBrowser()`
   - Helper functions for rate limit display, etc.

3. **Extract data fetching logic** (could reduce another 200-300 lines):
   - `useFetchRepositories()` - combines fetchPage and related effects
   - `useFetchSearch()` - combines fetchSearchPage and related effects
   - `useFetchStarred()` - handles starred repos fetching

## File Structure
```
src/ui/views/RepoList/
├── components/
│   ├── index.ts
│   ├── RepoListContent.tsx      ✅ Created
│   ├── RepoListFooter.tsx       ✅ Created
│   └── RepoListModals.tsx       ✅ Created
├── RepoList.tsx                 ⚠️  Needs refactoring to use components
├── REFACTOR_STATUS.md           📝 This file
└── index.ts                     ⚠️  To be created
```

## Integration Guide

### Step 1: Update main RepoList.tsx imports
```typescript
import { RepoListFooter, RepoListModals, RepoListContent } from './components';
```

### Step 2: Replace modal rendering section
Find the section starting around line 2039:
```typescript
{deleteModal.isOpen && deleteModal.target ? (
  // ... 467 lines of modal rendering ...
) : ...}
```

Replace with:
```typescript
<RepoListModals
  terminalWidth={terminalWidth}
  contentHeight={contentHeight}
  // Delete modal props
  deleteModal={deleteModal}
  deleteCode={deleteCode}
  typedCode={typedCode}
  deleteConfirmStage={deleteConfirmStage}
  confirmFocus={confirmFocus}
  onDeleteCodeChange={(code) => {
    const up = (code || '').toUpperCase();
    const cut = up.slice(0, DELETE_CODE_LENGTH);
    setTypedCode(cut);
    if (cut.length < DELETE_CODE_LENGTH) {
      deleteModal.setError(null);
    }
    if (cut.length === DELETE_CODE_LENGTH) {
      if (cut === deleteCode && deleteModal.target) {
        deleteModal.setError(null);
        setDeleteConfirmStage(true);
        setConfirmFocus('delete');
      } else {
        deleteModal.setError('Code does not match');
      }
    }
  }}
  onDeleteCancel={cancelDeleteModal}
  onDeleteConfirm={confirmDeleteNow}
  // ... (continue for all other modals)
/>
```

### Step 3: Replace content rendering
Find the section around line 2509-2625 with filter input and repository list.

Replace with:
```typescript
<RepoListContent
  filterMode={filterMode}
  filter={filter}
  onFilterChange={(val) => {
    setFilter(val);
    // ... debounce logic
  }}
  onFilterSubmit={() => setFilterMode(false)}
  starsMode={starsMode}
  visibleItems={visibleItems}
  windowStart={windowed.start}
  windowEnd={windowed.end}
  cursor={cursor}
  terminalWidth={terminalWidth}
  spacingLines={spacingLines}
  forkTracking={forkTracking}
  multiSelectMode={multiSelectMode}
  selectedRepos={selectedRepos}
  searchActive={searchActive}
  searchLoading={searchLoading}
  loading={loading}
  loadingMore={loadingMore}
  hasNextPage={hasNextPage}
  listHeight={listHeight}
/>
```

### Step 4: Replace footer
Find the section around line 2629-2703.

Replace with:
```typescript
<RepoListFooter
  terminalWidth={terminalWidth}
  modalOpen={modalOpen}
  multiSelectMode={multiSelectMode}
  selectedReposCount={selectedRepos.size}
  starsMode={starsMode}
  ownerContext={ownerContext}
  copyToast={copyToast}
  cloneToast={cloneToast}
  debugMessages={debugMessages}
/>
```

## Benefits Achieved
1. **Separation of concerns**: Presentation logic separated from business logic
2. **Reusability**: Modal component could potentially be reused
3. **Maintainability**: Easier to find and modify specific UI elements
4. **Testability**: Extracted components can be unit tested independently
5. **Readability**: Main file will be significantly shorter

## Risks & Mitigations
- **Risk**: Breaking existing functionality during refactor
  - **Mitigation**: Preserve all existing logic, only move presentation code
- **Risk**: Performance impact from additional component layers
  - **Mitigation**: Use React.memo if needed (likely not necessary for TUI)
- **Risk**: Prop drilling complexity
  - **Mitigation**: Accept some prop drilling as preferable to massive single file

## Next Developer Actions
1. Read this document
2. Review the created components in `/src/ui/views/RepoList/components/`
3. Follow the Integration Guide above to update main RepoList.tsx
4. Test thoroughly - especially modal interactions and keyboard handling
5. Run build to verify TypeScript compilation
6. Test the application end-to-end

# Release Process Documentation

## Overview
The gh-manager-cli project uses a **single optimized workflow** for all releases to minimize complexity and avoid skipped workflow runs.

## Architecture: Single Workflow Approach

```
┌─────────────────────────────────────────────────────────────┐
│                         Main Branch                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Direct Commit] ──┐                                         │
│                    ├──► [release.yml workflow]               │
│  [PR Merge] ───────┘         │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ Check Release    │                      │
│                    │ (Job-level       │                      │
│                    │  conditions)     │                      │
│                    └────────┬─────────┘                      │
│                             │                                │
│                    ┌────────▼─────────┐                      │
│                    │ Should Release?  │                      │
│                    └──┬──────────┬────┘                      │
│                       │          │                           │
│                    NO │          │ YES                       │
│                       │          │                           │
│                 ┌─────▼──┐  ┌───▼──────────┐                │
│                 │ Exit   │  │ Build & Test │                │
│                 │ (0     │  └───┬──────────┘                │
│                 │ skips) │      │                            │
│                 └────────┘  ┌───▼──────────────┐            │
│                             │ Semantic Release │             │
│                             │ - Analyze commits│             │
│                             │ - Bump version   │             │
│                             │ - Create tag     │             │
│                             │ - GitHub Release │             │
│                             │ - NPM Publish    │             │
│                             └───┬──────────────┘            │
│                                 │                            │
│                             ┌───▼──────────────┐            │
│                             │ Update Homebrew  │             │
│                             │ Formula          │             │
│                             └──────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Why Single Workflow?

### Benefits
1. **Zero Skipped Runs**: Uses job-level conditions instead of workflow-level
2. **Cleaner History**: No confusing "skipped" statuses in GitHub Actions
3. **Single Source of Truth**: One workflow to maintain
4. **Handles All Cases**: Works for both PR merges and direct commits

### How It Avoids Infinite Loops
- The workflow checks if a commit message starts with `chore(release):`
- If it does, the workflow exits early (but shows as successful, not skipped)
- This prevents the semantic-release commit from triggering another release

## Release Triggers

The workflow runs on every push to main and determines if a release is needed based on:

### Semantic Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Release-Triggering Commit Types
- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `perf:` - Performance improvement (patch version bump)
- `BREAKING CHANGE:` - Breaking change (major version bump)

### Non-Release Commit Types
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `ci:` - CI/CD changes

## Release Flow

1. **Developer Action**: Push to main (direct or via PR)
2. **Workflow Triggers**: `release.yml` starts
3. **Check Release Job**: Analyzes commit message
   - If `chore(release):*` → Exit (no release)
   - Otherwise → Continue
4. **Build Job**: Runs tests and builds
5. **Release Job**: 
   - Analyzes all commits since last release
   - Determines version bump (major/minor/patch)
   - Updates package.json
   - Creates git tag
   - Publishes to NPM
   - Creates GitHub Release
   - Updates Homebrew formula

## Version Numbering

Uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## Configuration Files

### `.releaserc.json`
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    "@semantic-release/git"
  ]
}
```

### Workflow: `.github/workflows/release.yml`
- Single workflow handling all release logic
- Uses job-level conditions to avoid skipped runs
- Outputs clear success/failure status

## Manual Release

If needed, you can trigger a release manually:
```bash
npm run release
```

This runs semantic-release locally (requires proper tokens).

## Troubleshooting

### Release Not Triggering
- Check commit message format
- Ensure commits follow semantic conventions
- Verify no `chore(release):` prefix

### Version Not Bumping Correctly
- Review commit types since last release
- Check for `BREAKING CHANGE:` in commit body
- Verify `.releaserc.json` configuration

## Deleted Workflows

The following redundant workflows were removed:
1. `automated-release.yml` - Replaced by single workflow
2. `release-on-version-change.yml` - Never performed useful work

## Best Practices

1. **Use Semantic Commits**: Always follow the commit format
2. **PR Titles Matter**: When squash-merging, PR title becomes commit message
3. **Breaking Changes**: Document in commit body with `BREAKING CHANGE:`
4. **Direct Commits**: Okay for quick fixes, workflow handles both cases
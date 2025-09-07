# Release Process Documentation

## Overview
The gh-manager-cli project uses a single, optimized GitHub Actions workflow for automated releases. This document explains how the release process works and how to contribute.

## Architecture: Single Workflow Approach

We use a **single workflow** (`release.yml`) that handles all release scenarios:
- Pull Request merges to main
- Direct commits to main
- Manual workflow triggers

### Why Single Workflow?
- **Simplicity**: One place to manage all release logic
- **No race conditions**: Sequential processing of commits
- **Zero skipped runs**: Uses job-level conditions instead of workflow-level
- **Easier debugging**: All logs in one workflow run

## Release Workflow

```
┌─────────────────────┐
│  Push to main       │
│  (PR or direct)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Check Release Job  │
│  - Skip if release  │
│    commit           │
│  - Check semantic   │
│    commits          │
└──────────┬──────────┘
           │
           ▼
      Should Release?
           │
    ┌──────┴──────┐
    │ No          │ Yes
    ▼             ▼
[End]      ┌─────────────────────┐
           │  Build Job          │
           │  - Linux binary     │
           │  - macOS binary     │
           │  - Windows binary   │
           └──────────┬──────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │  Release Job        │
           │  - semantic-release │
           │  - NPM publish      │
           │  - GitHub release   │
           │  - GitHub Packages  │
           │  - Homebrew update  │
           └─────────────────────┘
```

## Semantic Commits

The workflow triggers releases based on semantic commit messages:

### Release Triggers
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `perf:` - Performance improvements (patch version bump)
- `refactor:` - Code refactoring that affects external API (patch version bump)
- `revert:` - Reverting previous commits (patch version bump)
- `BREAKING CHANGE:` - Breaking changes (major version bump)
- `feat!:` or `fix!:` - Breaking changes (major version bump)

### Non-Release Commits
- `chore:` - Maintenance tasks
- `docs:` - Documentation only
- `style:` - Code style changes
- `test:` - Test additions or fixes
- `ci:` - CI/CD changes
- `build:` - Build system changes

## Release Steps

### 1. Check Release Job
- Analyzes commits since last tag
- Skips if current commit is a release commit (`chore(release):`)
- Determines if semantic commits warrant a release

### 2. Build Job (if release needed)
- Builds binaries for multiple platforms:
  - Linux (x64)
  - macOS (x64)
  - Windows (x64)
- Uploads artifacts for release job

### 3. Release Job
- Runs semantic-release to:
  - Determine version bump
  - Update package.json
  - Generate changelog
  - Create git tag
  - Create GitHub release
- Publishes to NPM registry
- Publishes to GitHub Packages
- Updates Homebrew tap formula

## Manual Release

To trigger a release manually:
1. Go to Actions tab in GitHub
2. Select "Release Pipeline" workflow
3. Click "Run workflow"
4. Select branch (usually main)

## Configuration Files

### `.releaserc`
Configures semantic-release plugins and behavior.

### `package.json`
Contains current version and publishing configuration.

### `.github/workflows/release.yml`
The single workflow file that handles all release scenarios.

## Secrets Required

The workflow requires these secrets:
- `GITHUB_TOKEN` or `GH_TOKEN` - For GitHub API access
- `NPM_TOKEN` - For NPM publishing (optional)

## Troubleshooting

### Release Not Triggering
- Check commit messages follow semantic format
- Verify commits since last tag include release triggers
- Check workflow logs for "should_release" output

### Build Failures
- Check Node.js version compatibility
- Verify dependencies are installed correctly
- Review platform-specific build logs

### Publishing Failures
- Verify NPM_TOKEN is valid
- Check package name availability
- Review GitHub Packages permissions

## Best Practices

1. **Use semantic commits**: Follow conventional commits format
2. **Test locally**: Run `pnpm build` before pushing
3. **Review changelogs**: Ensure generated changelog is accurate
4. **Monitor releases**: Check GitHub releases page after workflow completes

## Version History

- **v2.0.0** - Single optimized workflow (current)
- **v1.0.0** - Multiple workflows (deprecated)
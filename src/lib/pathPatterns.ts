/**
 * Path pattern utilities for organizing cloned repositories
 */

import type { RepoNode } from '../types';

export type PathPreset = 'current' | 'by-owner' | 'flat' | 'custom';

export const PATH_PRESETS: Record<PathPreset, { label: string; pattern: string; description: string }> = {
  current: {
    label: 'Current directory',
    pattern: '.',
    description: 'Clone into current directory',
  },
  'by-owner': {
    label: 'By owner',
    pattern: '{owner}/{repo}',
    description: 'Organize by owner (e.g., facebook/react)',
  },
  flat: {
    label: 'Flat',
    pattern: '{repo}',
    description: 'Flat structure with repo name only',
  },
  custom: {
    label: 'Custom...',
    pattern: '',
    description: 'Enter custom pattern',
  },
};

/**
 * Sanitize a path segment by replacing invalid filesystem characters
 */
export function sanitizePath(segment: string): string {
  // Replace invalid filesystem characters with dash
  // Windows: < > : " | ? *
  // Unix: /
  // We'll be conservative and replace all potentially problematic chars
  return segment.replace(/[<>:"|?*\/\\]/g, '-');
}

/**
 * Resolve a path pattern with repository information
 *
 * Supported variables:
 * - {owner}: Repository owner (org or username)
 * - {repo}: Repository name only
 * - {full}: Full nameWithOwner (e.g., "facebook/react")
 */
export function resolvePathPattern(pattern: string, repo: RepoNode): string {
  if (pattern === '.') {
    return '.';
  }

  const owner = repo.nameWithOwner.split('/')[0];
  const repoName = repo.name;
  const full = repo.nameWithOwner;

  let resolved = pattern
    .replace(/{owner}/g, sanitizePath(owner))
    .replace(/{repo}/g, sanitizePath(repoName))
    .replace(/{full}/g, sanitizePath(full.replace('/', '-'))); // Replace / in full name

  // Remove any leading/trailing slashes
  resolved = resolved.replace(/^\/+|\/+$/g, '');

  return resolved || '.';
}

/**
 * Validate a path pattern
 * Returns error message if invalid, null if valid
 */
export function validatePathPattern(pattern: string): string | null {
  if (!pattern) {
    return 'Pattern cannot be empty';
  }

  // Check for unmatched braces
  const openBraces = (pattern.match(/{/g) || []).length;
  const closeBraces = (pattern.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    return 'Unmatched braces in pattern';
  }

  // Check for invalid variables
  const variables = pattern.match(/{([^}]+)}/g) || [];
  const validVars = ['{owner}', '{repo}', '{full}'];
  for (const varMatch of variables) {
    if (!validVars.includes(varMatch)) {
      return `Invalid variable: ${varMatch}. Valid: {owner}, {repo}, {full}`;
    }
  }

  // Check for path traversal attempts
  if (pattern.includes('..')) {
    return 'Path traversal (..) not allowed';
  }

  return null;
}

/**
 * Get preset label for display
 */
export function getPresetLabel(preset: PathPreset): string {
  return PATH_PRESETS[preset].label;
}

/**
 * Get preset pattern
 */
export function getPresetPattern(preset: PathPreset): string {
  return PATH_PRESETS[preset].pattern;
}

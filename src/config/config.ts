import fs from 'fs';
import path from 'path';
import envPaths from 'env-paths';
import { logger } from '../lib/logger';

type Density = 0 | 1 | 2;

export type OwnerContext = 'personal' | { type: 'organization', login: string, name?: string };

interface UIPrefs {
  sortKey?: 'updated' | 'pushed' | 'name' | 'stars';
  sortDir?: 'asc' | 'desc';
  density?: Density;
  forkTracking?: boolean;
  ownerAffiliations?: string[];
  ownerContext?: OwnerContext;
  visibilityFilter?: 'all' | 'public' | 'private';
  theme?: string;
}

export type TokenSource = 'pat' | 'oauth';

interface ConfigShape {
  token?: string;
  tokenVersion?: number;
  tokenSource?: TokenSource;
  ui?: UIPrefs;
}

const paths = envPaths('gh-manager-cli');
const configDir = paths.config;
const configFile = path.join(configDir, 'config.json');

/**
 * Gets the absolute path to the configuration file
 *
 * @returns Absolute path to config.json in the user's config directory
 * @example
 * ```typescript
 * const path = getConfigPath();
 * console.log(`Config stored at: ${path}`);
 * ```
 */
export function getConfigPath() {
  return configFile;
}

/**
 * Reads the configuration file from disk
 *
 * Parses config.json from the user's config directory. Returns empty object
 * if file doesn't exist or parsing fails.
 *
 * @returns Configuration object containing token, UI preferences, etc.
 * @example
 * ```typescript
 * const config = readConfig();
 * if (config.token) {
 *   console.log('Token found in config');
 * }
 * ```
 */
export function readConfig(): ConfigShape {
  try {
    const data = fs.readFileSync(configFile, 'utf8');
    const json = JSON.parse(data);
    return json as ConfigShape;
  } catch (error) {
    logger.debug('Failed to read config file', { error });
    return {};
  }
}

/**
 * Writes configuration to disk
 *
 * Creates config directory if needed, writes JSON with formatting, and sets
 * restrictive file permissions (0600) on POSIX systems for security.
 *
 * @param cfg - Configuration object to write
 * @example
 * ```typescript
 * writeConfig({ token: 'ghp_xxx', tokenSource: 'pat' });
 * ```
 */
export function writeConfig(cfg: ConfigShape) {
  fs.mkdirSync(configDir, { recursive: true });
  const body = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(configFile, body, 'utf8');
  // Tighten permissions on POSIX
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(configFile, 0o600);
    } catch (error) {
      logger.debug('Failed to set permissions on config file', { error });
    }
  }
}

/**
 * Retrieves GitHub token from environment variables
 *
 * Checks both GITHUB_TOKEN and GH_TOKEN environment variables.
 *
 * @returns Token string if found in environment, undefined otherwise
 * @example
 * ```typescript
 * const envToken = getTokenFromEnv();
 * if (envToken) console.log('Using token from environment');
 * ```
 */
export function getTokenFromEnv(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

/**
 * Retrieves stored GitHub token from config file
 *
 * @returns Token string if found in config, undefined otherwise
 * @example
 * ```typescript
 * const storedToken = getStoredToken();
 * if (storedToken) console.log('Using stored token');
 * ```
 */
export function getStoredToken(): string | undefined {
  const cfg = readConfig();
  return cfg.token;
}

/**
 * Stores GitHub token in config file
 *
 * Preserves existing configuration settings while adding or updating the token.
 *
 * @param token - GitHub personal access token or OAuth token
 * @param source - Token source type (defaults to 'pat')
 * @example
 * ```typescript
 * storeToken('ghp_xxxxxxxxxxxx', 'pat');
 * console.log('Token saved to config');
 * ```
 */
export function storeToken(token: string, source: TokenSource = 'pat') {
  const existing = readConfig();
  writeConfig({ ...existing, token, tokenVersion: 1, tokenSource: source });
}

/**
 * Removes stored token from config file
 *
 * Preserves other settings like UI preferences while removing token data.
 *
 * @example
 * ```typescript
 * clearStoredToken();
 * console.log('Token removed from config');
 * ```
 */
export function clearStoredToken() {
  const existing = readConfig();
  // Preserve other settings like ui prefs
  const { token, tokenVersion, tokenSource, ...rest } = existing as any;
  writeConfig({ ...rest });
}

/**
 * Clears all configuration settings
 *
 * Removes everything including token, UI preferences, and organization context.
 *
 * @example
 * ```typescript
 * clearAllSettings();
 * console.log('All settings cleared');
 * ```
 */
export function clearAllSettings() {
  // Clear everything including UI preferences and org context
  writeConfig({});
}

/**
 * Gets the source type of the stored token
 *
 * @returns Token source ('pat' or 'oauth'), defaults to 'pat' for backward compatibility
 * @example
 * ```typescript
 * const source = getTokenSource();
 * console.log(`Token source: ${source}`);
 * ```
 */
export function getTokenSource(): TokenSource {
  const cfg = readConfig();
  return cfg.tokenSource || 'pat'; // Default to PAT for backward compatibility
}

/**
 * Retrieves UI preferences from config
 *
 * @returns UI preferences object containing sort, density, filter settings
 * @example
 * ```typescript
 * const prefs = getUIPrefs();
 * console.log(`Sort by: ${prefs.sortKey}, Direction: ${prefs.sortDir}`);
 * ```
 */
export function getUIPrefs(): UIPrefs {
  const cfg = readConfig();
  return cfg.ui || {};
}

/**
 * Updates UI preferences in config
 *
 * Merges provided preferences with existing ones, preserving unmodified settings.
 *
 * @param patch - Partial UI preferences to update
 * @example
 * ```typescript
 * storeUIPrefs({ sortKey: 'stars', sortDir: 'desc', density: 1 });
 * console.log('UI preferences updated');
 * ```
 */
export function storeUIPrefs(patch: Partial<UIPrefs>) {
  const existing = readConfig();
  const mergedUI = { ...(existing.ui || {}), ...patch };
  writeConfig({ ...existing, ui: mergedUI });
}

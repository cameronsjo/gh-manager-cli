import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Mock modules before importing the functions
vi.mock('fs');
vi.mock('env-paths', () => ({
  default: vi.fn(() => ({
    config: '/mock/config/path',
    data: '/mock/data/path',
    cache: '/mock/cache/path',
    log: '/mock/log/path',
    temp: '/mock/temp/path',
  })),
}));
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  getConfigPath,
  readConfig,
  writeConfig,
  getTokenFromEnv,
  getStoredToken,
  storeToken,
  clearStoredToken,
  getTokenSource,
  getUIPrefs,
  storeUIPrefs,
} from '../config';

describe('getConfigPath', () => {
  it('should return config file path', () => {
    const path = getConfigPath();
    expect(path).toBeDefined();
    expect(typeof path).toBe('string');
    expect(path).toContain('config.json');
  });
});

describe('readConfig', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should read and parse config file', () => {
    const mockConfig = {
      token: 'ghp_test_token',
      tokenVersion: 1,
      tokenSource: 'pat' as const,
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig) as any);

    const config = readConfig();

    expect(config).toEqual(mockConfig);
  });

  it('should return empty object if config file does not exist', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const config = readConfig();

    expect(config).toEqual({});
  });

  it('should handle malformed JSON gracefully', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }' as any);

    const config = readConfig();

    expect(config).toEqual({});
  });
});

describe('writeConfig', () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('should write config to file', () => {
    const config = {
      token: 'ghp_new_token',
      tokenVersion: 1,
    };

    writeConfig(config);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/mock/config/path',
      { recursive: true }
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      JSON.stringify(config, null, 2),
      'utf8'
    );
  });

  it('should set file permissions on POSIX systems', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    const config = { token: 'ghp_token' };

    writeConfig(config);

    expect(fs.chmodSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      0o600
    );
  });

  it('should skip chmod on Windows', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    const config = { token: 'ghp_token' };

    writeConfig(config);

    expect(fs.chmodSync).not.toHaveBeenCalled();
  });
});

describe('getTokenFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return GITHUB_TOKEN from environment', () => {
    process.env.GITHUB_TOKEN = 'ghp_env_token_1';

    const token = getTokenFromEnv();

    expect(token).toBe('ghp_env_token_1');
  });

  it('should return GH_TOKEN from environment', () => {
    delete process.env.GITHUB_TOKEN;
    process.env.GH_TOKEN = 'ghp_env_token_2';

    const token = getTokenFromEnv();

    expect(token).toBe('ghp_env_token_2');
  });

  it('should prefer GITHUB_TOKEN over GH_TOKEN', () => {
    process.env.GITHUB_TOKEN = 'ghp_github_token';
    process.env.GH_TOKEN = 'ghp_gh_token';

    const token = getTokenFromEnv();

    expect(token).toBe('ghp_github_token');
  });

  it('should return undefined if no env token is set', () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    const token = getTokenFromEnv();

    expect(token).toBeUndefined();
  });
});

describe('getStoredToken', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return stored token from config', () => {
    const mockConfig = {
      token: 'ghp_stored_token',
      tokenVersion: 1,
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig) as any);

    const token = getStoredToken();

    expect(token).toBe('ghp_stored_token');
  });

  it('should return undefined if no token is stored', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}' as any);

    const token = getStoredToken();

    expect(token).toBeUndefined();
  });
});

describe('storeToken', () => {
  beforeEach(() => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}' as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should store token with default source', () => {
    storeToken('ghp_new_token');

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);

    expect(parsed.token).toBe('ghp_new_token');
    expect(parsed.tokenVersion).toBe(1);
    expect(parsed.tokenSource).toBe('pat');
  });

  it('should store token with OAuth source', () => {
    storeToken('gho_oauth_token', 'oauth');

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);

    expect(parsed.token).toBe('gho_oauth_token');
    expect(parsed.tokenSource).toBe('oauth');
  });
});

describe('clearStoredToken', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should remove token while preserving UI preferences', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      token: 'ghp_token_to_remove',
      tokenVersion: 1,
      tokenSource: 'pat',
      ui: { sortKey: 'name', density: 2 },
    }) as any);

    clearStoredToken();

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);

    expect(parsed.token).toBeUndefined();
    expect(parsed.tokenVersion).toBeUndefined();
    expect(parsed.tokenSource).toBeUndefined();
    expect(parsed.ui).toEqual({ sortKey: 'name', density: 2 });
  });
});

describe('getTokenSource', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return stored token source', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      tokenSource: 'oauth',
    }) as any);

    const source = getTokenSource();

    expect(source).toBe('oauth');
  });

  it('should default to PAT if no source is stored', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}' as any);

    const source = getTokenSource();

    expect(source).toBe('pat');
  });
});

describe('getUIPrefs', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return UI preferences from config', () => {
    const mockPrefs = {
      sortKey: 'stars' as const,
      sortDir: 'asc' as const,
      density: 2,
      forkTracking: true,
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      ui: mockPrefs,
    }) as any);

    const prefs = getUIPrefs();

    expect(prefs).toEqual(mockPrefs);
  });

  it('should return empty object if no UI preferences exist', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}' as any);

    const prefs = getUIPrefs();

    expect(prefs).toEqual({});
  });
});

describe('storeUIPrefs', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should merge new UI preferences with existing ones', () => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      token: 'ghp_token',
      ui: {
        sortKey: 'updated',
        density: 1,
      },
    }) as any);

    storeUIPrefs({
      sortDir: 'desc',
      forkTracking: true,
    });

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);

    expect(parsed.token).toBe('ghp_token');
    expect(parsed.ui).toEqual({
      sortKey: 'updated',
      density: 1,
      sortDir: 'desc',
      forkTracking: true,
    });
  });

  it('should create UI preferences if none exist', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{}' as any);

    storeUIPrefs({
      sortKey: 'stars',
      visibilityFilter: 'public',
    });

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);

    expect(parsed.ui).toEqual({
      sortKey: 'stars',
      visibilityFilter: 'public',
    });
  });
});

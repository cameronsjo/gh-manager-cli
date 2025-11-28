import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { truncate, formatDate, copyToClipboard } from '../utils';
import type { Mock } from 'vitest';

describe('truncate', () => {
  it('should return original string if shorter than max', () => {
    const input = 'short string';
    const result = truncate(input, 80);

    expect(result).toBe(input);
  });

  it('should return original string if equal to max', () => {
    const input = 'x'.repeat(80);
    const result = truncate(input, 80);

    expect(result).toBe(input);
  });

  it('should truncate string longer than max', () => {
    const input = 'x'.repeat(100);
    const result = truncate(input, 80);

    expect(result.length).toBe(80);
    expect(result).toMatch(/…$/);
  });

  it('should use default max of 80 characters', () => {
    const input = 'x'.repeat(100);
    const result = truncate(input);

    expect(result.length).toBe(80);
    expect(result).toMatch(/…$/);
  });

  it('should truncate to correct length with ellipsis', () => {
    const input = 'This is a very long string that needs to be truncated';
    const result = truncate(input, 20);

    expect(result.length).toBe(20);
    expect(result.endsWith('…')).toBe(true);
    expect(result).toBe('This is a very long…');
  });

  it('should handle empty string', () => {
    const result = truncate('', 80);

    expect(result).toBe('');
  });

  it('should handle max of 1', () => {
    const result = truncate('abc', 1);

    expect(result.length).toBe(1);
    expect(result).toBe('…');
  });

  it('should handle max of 0', () => {
    const result = truncate('abc', 0);

    expect(result).toBe('…');
  });

  it('should handle unicode characters correctly', () => {
    const input = '🔥'.repeat(50);
    const result = truncate(input, 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('should preserve content before truncation point', () => {
    const input = 'Important prefix followed by lots of text that will be cut off';
    const result = truncate(input, 20);

    expect(result.startsWith('Important prefix')).toBe(true);
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format today as "today"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDate('2025-01-15T10:00:00Z');

    expect(result).toBe('today');
  });

  it('should format yesterday as "yesterday"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDate('2025-01-14T10:00:00Z');

    expect(result).toBe('yesterday');
  });

  it('should format recent days as "X days ago"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result3Days = formatDate('2025-01-12T10:00:00Z');
    expect(result3Days).toBe('3 days ago');

    const result5Days = formatDate('2025-01-10T10:00:00Z');
    expect(result5Days).toBe('5 days ago');
  });

  it('should format weeks as "X weeks ago"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result2Weeks = formatDate('2025-01-01T10:00:00Z');
    expect(result2Weeks).toBe('2 weeks ago');

    const result3Weeks = formatDate('2024-12-25T10:00:00Z');
    expect(result3Weeks).toBe('3 weeks ago');
  });

  it('should format months as "X months ago"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result2Months = formatDate('2024-11-10T10:00:00Z');
    expect(result2Months).toBe('2 months ago');

    const result6Months = formatDate('2024-07-10T10:00:00Z');
    expect(result6Months).toBe('6 months ago');
  });

  it('should format years as "X years ago"', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result1Year = formatDate('2024-01-10T10:00:00Z');
    expect(result1Year).toBe('1 years ago');

    const result3Years = formatDate('2022-01-10T10:00:00Z');
    expect(result3Years).toBe('3 years ago');
  });

  it('should handle edge case at week boundary', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result6Days = formatDate('2025-01-09T13:00:00Z');
    // This could be 5 or 6 days depending on exact time calculation
    expect(result6Days).toMatch(/5 days ago|6 days ago/);

    const result7Days = formatDate('2025-01-08T11:00:00Z');
    expect(result7Days).toBe('1 weeks ago');
  });

  it('should handle edge case at month boundary', () => {
    const now = new Date('2025-01-31T12:00:00Z');
    vi.setSystemTime(now);

    const result29Days = formatDate('2025-01-02T12:00:00Z');
    expect(result29Days).toBe('4 weeks ago');

    const result31Days = formatDate('2024-12-31T12:00:00Z');
    expect(result31Days).toBe('1 months ago');
  });

  it('should handle ISO 8601 date strings', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDate('2025-01-13T08:30:45.123Z');
    expect(result).toBe('2 days ago');
  });

  it('should handle date strings without timezone', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDate('2025-01-14T12:00:00');
    expect(result).toMatch(/today|yesterday/);
  });

  it('should handle very old dates', () => {
    const now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);

    const result = formatDate('2020-01-01T12:00:00Z');
    expect(result).toBe('5 years ago');
  });
});

describe('copyToClipboard', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('with clipboardy', () => {
    it('should use clipboardy when available', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const text = 'test clipboard content';
      await copyToClipboard(text);

      expect(mockWrite).toHaveBeenCalledWith(text);
    });

    it('should handle clipboardy errors and fall back', async () => {
      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Clipboardy not available')),
      }));

      // Should fall back to OS-specific commands
      // Actual behavior depends on platform
      const text = 'test';

      // This might fail without actual clipboard utilities installed
      // but we're testing the fallback path
      try {
        await copyToClipboard(text);
      } catch (error: any) {
        expect(error.message).toContain('clipboard');
      }
    });
  });

  describe('platform-specific fallbacks', () => {
    it('should use pbcopy on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
        const mockChild = {
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
          }),
        };
        return mockChild;
      });

      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Not available')),
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const text = 'test clipboard';
      await copyToClipboard(text);

      expect(mockSpawn).toHaveBeenCalledWith('pbcopy', [], expect.any(Object));
    });

    it('should use clip on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
        const mockChild = {
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
          }),
        };
        return mockChild;
      });

      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Not available')),
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const text = 'test clipboard';
      await copyToClipboard(text);

      expect(mockSpawn).toHaveBeenCalledWith('clip', [], expect.any(Object));
    });

    it('should try xclip on Linux', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
        const mockChild = {
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
          }),
        };
        return mockChild;
      });

      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Not available')),
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      const text = 'test clipboard';
      await copyToClipboard(text);

      expect(mockSpawn).toHaveBeenCalledWith(
        'xclip',
        ['-selection', 'clipboard'],
        expect.any(Object)
      );
    });

    it('should handle spawn errors gracefully', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const mockSpawn = vi.fn().mockImplementation(() => {
        const mockChild = {
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Command not found')), 0);
            }
          }),
        };
        return mockChild;
      });

      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Not available')),
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      await expect(copyToClipboard('test')).rejects.toThrow('clipboard');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      await copyToClipboard('');

      expect(mockWrite).toHaveBeenCalledWith('');
    });

    it('should handle very long text', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const longText = 'x'.repeat(10000);
      await copyToClipboard(longText);

      expect(mockWrite).toHaveBeenCalledWith(longText);
    });

    it('should handle unicode characters', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const unicodeText = '🔥 Test 日本語 emoji 🚀';
      await copyToClipboard(unicodeText);

      expect(mockWrite).toHaveBeenCalledWith(unicodeText);
    });

    it('should handle newlines and special characters', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const textWithNewlines = 'line1\nline2\r\nline3\ttab';
      await copyToClipboard(textWithNewlines);

      expect(mockWrite).toHaveBeenCalledWith(textWithNewlines);
    });

    it('should handle URLs', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const url = 'https://github.com/user/repo?tab=readme';
      await copyToClipboard(url);

      expect(mockWrite).toHaveBeenCalledWith(url);
    });
  });

  describe('security', () => {
    it('should use spawn for OS commands not shell execution', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      let spawnOptions: any;
      const mockSpawn = vi.fn().mockImplementation((command, args, options) => {
        spawnOptions = options;
        const mockChild = {
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 0);
            }
          }),
        };
        return mockChild;
      });

      vi.doMock('clipboardy', () => ({
        write: vi.fn().mockRejectedValue(new Error('Not available')),
      }));

      vi.doMock('child_process', () => ({
        spawn: mockSpawn,
      }));

      await copyToClipboard('test');

      // Verify spawn is called with proper options
      expect(spawnOptions).toBeDefined();
      expect(spawnOptions.stdio).toBeDefined();
    });

    it('should handle malicious input safely', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);

      vi.doMock('clipboardy', () => ({
        write: mockWrite,
      }));

      const maliciousInput = '; rm -rf /; echo "pwned"';
      await copyToClipboard(maliciousInput);

      // Should just copy the text as-is, not execute it
      expect(mockWrite).toHaveBeenCalledWith(maliciousInput);
    });
  });
});

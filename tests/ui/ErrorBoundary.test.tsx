import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { ErrorBoundary, ErrorFallback } from '../../src/ui/components/ErrorBoundary';
import { Text } from 'ink';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain('No error');
  });

  it('should render error UI when error is caught', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const output = lastFrame();
    expect(output).toContain('Something went wrong');
    expect(output).toContain('Test error message');
    expect(output).toContain('Press Ctrl+C to exit and restart');

    consoleError.mockRestore();
  });

  it('should render custom fallback when provided', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const customFallback = <Text>Custom error fallback</Text>;

    const { lastFrame } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(lastFrame()).toContain('Custom error fallback');

    consoleError.mockRestore();
  });
});

describe('ErrorFallback', () => {
  it('should render error message', () => {
    const error = new Error('Test error');
    const { lastFrame } = render(<ErrorFallback error={error} />);

    const output = lastFrame();
    expect(output).toContain('Application Error');
    expect(output).toContain('Test error');
  });

  it('should show retry option when resetError is provided', () => {
    const error = new Error('Test error');
    const resetError = vi.fn();
    const { lastFrame } = render(<ErrorFallback error={error} resetError={resetError} />);

    const output = lastFrame();
    expect(output).toContain('Press \'r\' to retry');
  });

  it('should handle null error', () => {
    const { lastFrame } = render(<ErrorFallback error={null} />);

    const output = lastFrame();
    expect(output).toContain('Application Error');
    expect(output).not.toContain('null');
  });
});

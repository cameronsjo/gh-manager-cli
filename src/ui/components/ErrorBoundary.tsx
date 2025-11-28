import React from 'react';
import { Box, Text } from 'ink';
import { logger } from '../../lib/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('ErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>⚠️  Something went wrong</Text>
          <Text color="gray">{this.state.error?.message || 'Unknown error'}</Text>
          <Text color="yellow" dimColor>Press Ctrl+C to exit and restart</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps): JSX.Element {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red" bold>⚠️  Application Error</Text>
      {error && <Text color="gray">{error.message}</Text>}
      {resetError && <Text color="cyan">Press 'r' to retry</Text>}
      <Text color="yellow" dimColor>Press Ctrl+C to exit and restart</Text>
    </Box>
  );
}

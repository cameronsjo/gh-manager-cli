import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getStoredToken, storeToken, getTokenFromEnv, clearStoredToken, clearAllSettings, getTokenSource } from '../config/config';
import type { OwnerContext, TokenSource } from '../config/config';
import { makeClient, getViewerLogin } from '../services/github';
import { pollForAccessToken, requestDeviceCode } from '../services/oauth';
import type { DeviceCodeResponse } from '../services/oauth';
import RepoList from './views/RepoList';
import { AuthMethodSelector, OAuthProgress } from './components/auth';
import type { AuthMethod, OAuthStatus } from './components/auth';
import { logger } from '../lib/logger';
import { useTerminalSize } from './hooks/useTerminalSize';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import version from package.json
const packageJson = require('../../package.json');

/**
 * Discriminated union representing all possible application states.
 * Each state variant includes only the data relevant to that state,
 * ensuring type safety and preventing invalid state combinations.
 */
type AppState =
  | { mode: 'checking' }
  | { mode: 'auth_method_selection'; error?: string }
  | { mode: 'prompt'; error?: string; input: string }
  | { mode: 'validating'; token: string; sessionTokenOrigin: SessionTokenOrigin; wasRateLimited: boolean; rateLimitReset: string | null }
  | { mode: 'oauth_flow'; deviceCodeResponse: DeviceCodeResponse | null; status: OAuthStatus; error?: string; deviceCode: { user_code: string; verification_uri: string } | null }
  | { mode: 'ready'; viewer: string; token: string; tokenSource: TokenSource; sessionTokenOrigin: SessionTokenOrigin }
  | { mode: 'error'; error: string }
  | { mode: 'rate_limited'; resetAt: string | null; token: string; wasRateLimited: boolean };

type SessionTokenOrigin = 'cli' | 'env' | 'stored' | 'oauth' | 'prompt';

export default function App({ initialOrgSlug, inlineToken, inlineTokenEphemeral }: { initialOrgSlug?: string; inlineToken?: string; inlineTokenEphemeral?: boolean }) {
  const { exit } = useApp();
  const dims = useTerminalSize();

  // Single state object using discriminated union for type safety
  const [appState, setAppState] = useState<AppState>({ mode: 'checking' });

  // UI-only state (not part of core app state machine)
  const [orgContext, setOrgContext] = useState<OwnerContext>('personal');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pat');

  /**
   * Type-safe state transition helpers.
   * Each function ensures the correct data is provided for each state.
   */
  const transitionTo = {
    checking: () => setAppState({ mode: 'checking' }),

    authMethodSelection: (error?: string) =>
      setAppState({ mode: 'auth_method_selection', error }),

    prompt: (input: string = '', error?: string) =>
      setAppState({ mode: 'prompt', input, error }),

    validating: (token: string, sessionTokenOrigin: SessionTokenOrigin, wasRateLimited: boolean = false, rateLimitReset: string | null = null) =>
      setAppState({ mode: 'validating', token, sessionTokenOrigin, wasRateLimited, rateLimitReset }),

    oauthFlow: (deviceCodeResponse: DeviceCodeResponse | null = null, status: OAuthStatus = 'initializing', error?: string, deviceCode: { user_code: string; verification_uri: string } | null = null) =>
      setAppState({ mode: 'oauth_flow', deviceCodeResponse, status, error, deviceCode }),

    ready: (viewer: string, token: string, tokenSource: TokenSource, sessionTokenOrigin: SessionTokenOrigin) =>
      setAppState({ mode: 'ready', viewer, token, tokenSource, sessionTokenOrigin }),

    error: (error: string) =>
      setAppState({ mode: 'error', error }),

    rateLimited: (resetAt: string | null, token: string, wasRateLimited: boolean = true) =>
      setAppState({ mode: 'rate_limited', resetAt, token, wasRateLimited }),
  };

  /**
   * Helper to update OAuth flow state while preserving other fields
   */
  const updateOAuthFlow = (updates: Partial<Extract<AppState, { mode: 'oauth_flow' }>>) => {
    if (appState.mode === 'oauth_flow') {
      setAppState({ ...appState, ...updates });
    }
  };

  /**
   * Helper to update prompt state while preserving other fields
   */
  const updatePrompt = (updates: Partial<Extract<AppState, { mode: 'prompt' }>>) => {
    if (appState.mode === 'prompt') {
      setAppState({ ...appState, ...updates });
    }
  };

  // Initialize authentication: check for tokens in order of precedence
  useEffect(() => {
    const env = getTokenFromEnv();
    const stored = getStoredToken();

    if (inlineToken) {
      // Highest precedence: inline token from CLI flag; do not persist
      transitionTo.validating(inlineToken, 'cli');
    } else if (env) {
      transitionTo.validating(env, 'env');
    } else if (stored) {
      const source = getTokenSource();
      transitionTo.validating(stored, source === 'oauth' ? 'stored' : 'stored');
    } else {
      transitionTo.authMethodSelection();
    }
  }, [inlineToken]);

  // Handle OAuth flow
  useEffect(() => {
    if (appState.mode !== 'oauth_flow') return;

    (async () => {
      try {
        updateOAuthFlow({ status: 'initializing' });

        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 500));

        updateOAuthFlow({ status: 'device_code_requested' });

        // Step 1: Get device code from GitHub (only once!)
        const deviceCodeResp = await requestDeviceCode();

        // Set the device code for display
        updateOAuthFlow({
          deviceCodeResponse: deviceCodeResp,
          deviceCode: {
            user_code: deviceCodeResp.user_code,
            verification_uri: deviceCodeResp.verification_uri
          }
        });

        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 500));

        updateOAuthFlow({ status: 'browser_opening' });

        // Step 2: Open browser with the verification URL
        const open = (await import('open')).default;
        await open(deviceCodeResp.verification_uri);

        updateOAuthFlow({ status: 'waiting_for_authorization' });

        // Small delay to let user see the device code
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Poll for access token using the SAME device code response
        updateOAuthFlow({ status: 'polling_for_token' });
        const tokenResult = await pollForAccessToken(deviceCodeResp);

        if (tokenResult.success && tokenResult.token) {
          updateOAuthFlow({ status: 'validating_token' });

          // Store the token
          storeToken(tokenResult.token, 'oauth');

          if (tokenResult.login) {
            updateOAuthFlow({ status: 'success' });

            // Small delay to show success message
            await new Promise(resolve => setTimeout(resolve, 1000));

            transitionTo.ready(tokenResult.login, tokenResult.token, 'oauth', 'oauth');
          } else {
            throw new Error('Failed to get user login from token');
          }
        } else {
          throw new Error(tokenResult.error || 'Failed to obtain access token');
        }
      } catch (error: any) {
        updateOAuthFlow({ status: 'error', error: error.message });
      }
    })();
  }, [appState.mode]);

  // Handle authentication method selection
  const handleAuthMethodSelect = useCallback((method: AuthMethod) => {
    setAuthMethod(method);
    if (method === 'pat') {
      transitionTo.prompt();
    } else if (method === 'oauth') {
      transitionTo.oauthFlow();
    }
  }, []);

  // Validate token
  useEffect(() => {
    if (appState.mode !== 'validating') return;

    const { token, sessionTokenOrigin, wasRateLimited, rateLimitReset } = appState;

    (async () => {
      // Add timeout for validation to prevent getting stuck
      const timeoutId = setTimeout(() => {
        transitionTo.authMethodSelection('Token validation timed out. Please check your network connection.');
      }, 15000); // 15 second timeout

      try {
        const client = makeClient(token);
        const login = await getViewerLogin(client);
        clearTimeout(timeoutId);

        // Only persist if we haven't already stored a token, the token isn't inline-ephemeral,
        // and the token originated from an interactive prompt or OAuth flow.
        const hadStored = Boolean(getStoredToken());
        const shouldPersist =
          !hadStored &&
          !inlineTokenEphemeral &&
          (sessionTokenOrigin === 'prompt' || sessionTokenOrigin === 'oauth');
        if (shouldPersist) {
          storeToken(token);
        }

        logger.info('User authenticated successfully', {
          user: login,
          tokenOrigin: sessionTokenOrigin,
          willPersist: shouldPersist,
        });

        // Determine token source
        const tokenSource: TokenSource = sessionTokenOrigin === 'oauth' ? 'oauth' : 'pat';

        transitionTo.ready(login, token, tokenSource, sessionTokenOrigin);
      } catch (e: any) {
        clearTimeout(timeoutId);
        let errorMessage = 'Invalid or unauthorized token. Please enter a valid Personal Access Token.';
        let isRateLimit = false;
        let resetTime: string | null = null;

        // Parse GitHub API error responses
        if (e.message) {
          const msg = e.message.toLowerCase();
          if (msg.includes('rate limit') || msg.includes('rate-limit') || msg.includes('abuse')) {
            isRateLimit = true;
            // Try to extract rate limit reset time from error message
            const resetMatch = e.message.match(/resets? at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/i);
            if (resetMatch) {
              resetTime = resetMatch[1];
            }
          } else if (msg.includes('bad credentials') || msg.includes('unauthorized') || msg.includes('401')) {
            errorMessage = 'Invalid token. Please check your Personal Access Token and try again.';
          } else if (msg.includes('forbidden') || msg.includes('403')) {
            errorMessage = 'Token lacks required permissions. Please ensure your token has "repo" scope.';
          } else if (msg.includes('not found') || msg.includes('404')) {
            errorMessage = 'GitHub API endpoint not found. Please check your network connection.';
          } else if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          }
        }

        // Check for GraphQL specific errors and rate limit info
        if (e.errors && Array.isArray(e.errors)) {
          const firstError = e.errors[0];
          if (firstError?.type === 'RATE_LIMITED') {
            isRateLimit = true;
          } else if (firstError?.type === 'FORBIDDEN') {
            errorMessage = 'Token lacks required permissions. Please ensure your token has "repo" scope.';
          }
        }

        // Check for rate limit headers in HTTP response
        if (e.response?.headers) {
          const rateLimitRemaining = e.response.headers['x-ratelimit-remaining'];
          const rateLimitReset = e.response.headers['x-ratelimit-reset'];

          if (rateLimitRemaining === '0' || rateLimitRemaining === 0) {
            isRateLimit = true;
            if (rateLimitReset) {
              // Convert Unix timestamp to ISO string
              const resetDate = new Date(parseInt(rateLimitReset) * 1000);
              resetTime = resetDate.toISOString();
            }
          }
        }

        if (isRateLimit) {
          // Keep token so Retry can revalidate; remember we came from rate-limit
          transitionTo.rateLimited(resetTime, token, true);
        } else {
          // Invalid token or other error: clear token input and return to selection
          // Only clear stored token if the failed token originated from storage
          if (sessionTokenOrigin === 'stored') {
            try { clearStoredToken(); } catch {}
          }
          transitionTo.authMethodSelection(errorMessage);
        }
      }
    })();
  }, [appState.mode, appState.mode === 'validating' ? appState.token : null]);

  const onSubmitToken = useCallback(async () => {
    if (appState.mode !== 'prompt') return;
    if (!appState.input.trim()) return;
    transitionTo.validating(appState.input.trim(), 'prompt');
  }, [appState]);

  // Handle logout from child components
  const handleLogout = useCallback(() => {
    const previousUser = appState.mode === 'ready' ? appState.viewer : null;
    const tokenOrigin = appState.mode === 'ready' ? appState.sessionTokenOrigin : null;

    logger.info('User logged out', {
      previousUser,
      tokenOrigin,
    });
    try { clearAllSettings(); } catch {}
    transitionTo.authMethodSelection();
  }, [appState]);

  // Handle keyboard input for different modes
  useInput((input: string, key: any) => {
    if ((appState.mode === 'prompt' || appState.mode === 'auth_method_selection') && key.escape) {
      exit();
    }

    if (appState.mode === 'oauth_flow' && key.escape) {
      // Allow canceling OAuth flow at any time (during polling or on error)
      transitionTo.authMethodSelection();
    }

    if (appState.mode === 'rate_limited') {
      const ch = (input || '').toLowerCase();
      if (key.escape || ch === 'q') {
        exit();
      } else if (ch === 'r') {
        // Retry with current token
        transitionTo.validating(appState.token, 'stored', appState.wasRateLimited, appState.resetAt);
      } else if (ch === 'l') {
        // Logout - go back to authentication
        handleLogout();
      }
    }

    if (appState.mode === 'validating' && key.escape) {
      // Cancel validation: return to rate-limited screen if relevant, else auth method selection
      if (appState.wasRateLimited || appState.rateLimitReset) {
        transitionTo.rateLimited(appState.rateLimitReset, appState.token, appState.wasRateLimited);
      } else {
        transitionTo.authMethodSelection();
      }
    }

    if (appState.mode === 'prompt') {
      // Update input state when typing (handled by TextInput component, but track for state)
      // Input is already part of appState, managed by TextInput's onChange
    }
  });

  // Calculate vertical padding as 15% of terminal height
  const verticalPadding = Math.floor(dims.rows * 0.05); // Reduced from 15% to 5% for 30% more container height
  
  const header = useMemo(() => {
    const viewer = appState.mode === 'ready' ? appState.viewer : null;
    return (
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold color="cyan">
            {'  '}GitHub Repository Manager
          </Text>
          <Text color="gray" dimColor>v{packageJson.version}</Text>
          {process.env.GH_MANAGER_DEBUG === '1' && (
            <Text backgroundColor="blue" color="white"> debug mode </Text>
          )}
        </Box>
        {viewer && (
          <Text color="gray">
            {orgContext !== 'personal' && orgContext.login ?
              `${orgContext.login}/@${viewer}  ` :
              `@${viewer}  `
            }
          </Text>
        )}
      </Box>
    );
  }, [appState, orgContext]);

  if (appState.mode === 'rate_limited') {
    const formatResetTime = (resetTime: string | null) => {
      if (!resetTime) return 'Unknown';
      try {
        const resetDate = new Date(resetTime);
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();
        const diffMinutes = Math.ceil(diffMs / (1000 * 60));

        if (diffMinutes <= 0) {
          return 'Now (should be reset)';
        } else if (diffMinutes < 60) {
          return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        } else {
          const hours = Math.floor(diffMinutes / 60);
          const mins = diffMinutes % 60;
          return `${hours} hour${hours !== 1 ? 's' : ''} ${mins > 0 ? `${mins} min` : ''}`;
        }
      } catch {
        return 'Unknown';
      }
    };

    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box borderStyle="single" borderColor="yellow" paddingX={3} paddingY={2} flexDirection="column" width={Math.min(dims.cols - 8, 80)}>
            <Text bold color="yellow" marginBottom={1}>⚠️  Rate Limit Exceeded</Text>
            <Text color="gray" marginBottom={1}>
              You've hit GitHub's API rate limit for your token.
            </Text>
            <Text color="gray" marginBottom={1}>
              This happens when you make too many requests in a short time.
            </Text>

            {appState.resetAt && (
              <Box marginTop={1} marginBottom={1}>
                <Text>
                  <Text color="cyan">Reset in:</Text> <Text bold>{formatResetTime(appState.resetAt)}</Text>
                </Text>
                <Text color="gray" dimColor>
                  ({new Date(appState.resetAt).toLocaleTimeString()})
                </Text>
              </Box>
            )}
            
            <Box marginTop={2} flexDirection="column" gap={1}>
              <Text bold>What would you like to do?</Text>
              <Box flexDirection="column" paddingLeft={2}>
                <Text><Text color="cyan" bold>R</Text> - Retry now {appState.resetAt && formatResetTime(appState.resetAt) !== 'Now (should be reset)' ? '(likely to fail until reset)' : '(should work now)'}</Text>
                <Text><Text color="cyan" bold>L</Text> - Logout and choose authentication method</Text>
                <Text><Text color="gray" bold>Q/Esc</Text> - Quit application</Text>
              </Box>
            </Box>

            <Text color="gray" dimColor marginTop={2}>
              Tip: Using multiple tokens or waiting between requests can help avoid rate limits.
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (appState.mode === 'auth_method_selection') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center">
            <AuthMethodSelector onSelect={handleAuthMethodSelect} />
            {appState.error && (
              <Text color="red" marginTop={1}>{appState.error}</Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  if (appState.mode === 'oauth_flow') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <OAuthProgress status={appState.status} error={appState.error} deviceCode={appState.deviceCode || undefined} />
        </Box>
      </Box>
    );
  }

  if (appState.mode === 'prompt') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box borderStyle="single" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
            <Text bold marginBottom={1}>Authentication Required</Text>
            <Text color="gray" marginBottom={1}>
              Enter your GitHub Personal Access Token
            </Text>
            <Box>
              <Text>Token: </Text>
              <TextInput
                value={appState.input}
                onChange={(value: string) => updatePrompt({ input: value })}
                onSubmit={onSubmitToken}
                mask="*"
              />
            </Box>
            {appState.error && (
              <Text color="red" marginTop={1}>{appState.error}</Text>
            )}
            <Text color="gray" dimColor marginTop={1}>
              The token will be stored securely in your local config
            </Text>
            <Text color="gray" dimColor marginTop={1}>
              Press Esc to go back
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (appState.mode === 'validating' || appState.mode === 'checking') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center">
            <Text color="yellow">Validating token...</Text>
            {appState.mode === 'validating' && (
              <Text color="gray" dimColor marginTop={1}>
                Press Esc to cancel
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  if (appState.mode === 'error') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="red">{appState.error}</Text>
        </Box>
      </Box>
    );
  }

  // ready state - TypeScript knows appState.mode === 'ready' here
  if (appState.mode === 'ready') {
    return (
      <Box flexDirection="column" height={dims.rows} paddingX={2} paddingTop={verticalPadding} paddingBottom={verticalPadding}>
        {header}
        <ErrorBoundary>
          <RepoList
            token={appState.token}
            maxVisibleRows={dims.rows - (verticalPadding * 2) - 4}
            onLogout={handleLogout}
            viewerLogin={appState.viewer}
            onOrgContextChange={setOrgContext}
            initialOrgSlug={initialOrgSlug}
          />
        </ErrorBoundary>
      </Box>
    );
  }

  // Exhaustive check: should never reach here
  return null;
}

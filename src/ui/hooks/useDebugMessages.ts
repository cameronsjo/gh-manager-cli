import { useState, useCallback } from 'react';

/**
 * Debug message array management hook
 *
 * Maintains a rolling buffer of debug messages with automatic pruning.
 * Only collects messages when GH_MANAGER_DEBUG=1 environment variable is set.
 * Useful for displaying debug information in development without affecting production.
 *
 * @returns Object containing message array and add function
 * @property {string[]} messages - Array of recent debug messages (max 10)
 * @property {(msg: string) => void} addMessage - Function to add a new debug message
 * @example
 * ```typescript
 * function DebugPanel() {
 *   const { messages, addMessage } = useDebugMessages();
 *
 *   useEffect(() => {
 *     addMessage('Component mounted');
 *   }, []);
 *
 *   return (
 *     <Box flexDirection="column">
 *       {messages.map((msg, i) => <Text key={i}>{msg}</Text>)}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useDebugMessages() {
  const [messages, setMessages] = useState<string[]>([]);

  const addMessage = useCallback((msg: string) => {
    if (process.env.GH_MANAGER_DEBUG === '1') {
      setMessages(prev => [...prev.slice(-9), msg]); // Keep last 10 messages
    }
  }, []);

  return { messages, addMessage };
}

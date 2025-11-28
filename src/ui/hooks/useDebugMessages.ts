import { useState, useCallback } from 'react';

/**
 * Debug message array management hook
 * Maintains a rolling buffer of debug messages (max 10 messages)
 * Only active when GH_MANAGER_DEBUG=1 environment variable is set
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

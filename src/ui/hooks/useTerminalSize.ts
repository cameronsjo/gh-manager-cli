import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Terminal resize handling hook
 *
 * Tracks terminal dimensions and automatically updates when the terminal is resized.
 * Provides reactive terminal size information for responsive TUI layouts.
 *
 * @returns Object containing current terminal dimensions
 * @property {number} cols - Number of columns (width) in the terminal
 * @property {number} rows - Number of rows (height) in the terminal
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { cols, rows } = useTerminalSize();
 *
 *   return (
 *     <Box>
 *       Terminal size: {cols}x{rows}
 *     </Box>
 *   );
 * }
 * ```
 */
export function useTerminalSize() {
  const { stdout } = useStdout();

  const [dims, setDims] = useState(() => {
    const cols = stdout?.columns ?? 100;
    const rows = stdout?.rows ?? 30;
    return { cols, rows };
  });

  useEffect(() => {
    if (!stdout) return;

    const onResize = () => {
      const cols = stdout.columns ?? 100;
      const rows = stdout.rows ?? 30;
      setDims({ cols, rows });
    };

    stdout.on('resize', onResize);

    return () => {
      stdout.off?.('resize', onResize as any);
    };
  }, [stdout]);

  return dims;
}

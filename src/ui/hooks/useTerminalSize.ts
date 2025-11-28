import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Terminal resize handling hook
 * Tracks terminal dimensions (columns and rows) and updates on resize events
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

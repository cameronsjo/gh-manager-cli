import { useMemo } from 'react';
import chalk from 'chalk';
import { getTheme, type Theme } from '../../config/themes';

/**
 * Hook for accessing theme colors with pre-bound chalk functions
 *
 * Provides a theme object and convenient chalk color functions based on
 * the current theme name. Memoized to prevent unnecessary recalculations.
 *
 * @param themeName - Name of the theme to use (e.g., 'default', 'ocean', 'forest', 'mono')
 * @returns Object containing theme definition and chalk color functions
 * @example
 * ```typescript
 * const { theme, c } = useTheme('ocean');
 * console.log(c.primary('Hello')); // Outputs text in theme's primary color
 * console.log(c.error('Error!')); // Outputs text in theme's error color
 * ```
 */
export function useTheme(themeName: string) {
  return useMemo(() => {
    const theme = getTheme(themeName);
    return {
      theme,
      // Pre-bound chalk functions for convenience
      c: {
        primary: chalk[theme.primary as keyof typeof chalk] as typeof chalk,
        secondary: chalk[theme.secondary as keyof typeof chalk] as typeof chalk,
        success: chalk[theme.success as keyof typeof chalk] as typeof chalk,
        warning: chalk[theme.warning as keyof typeof chalk] as typeof chalk,
        error: chalk[theme.error as keyof typeof chalk] as typeof chalk,
        muted: chalk[theme.muted as keyof typeof chalk] as typeof chalk,
        text: chalk[theme.text as keyof typeof chalk] as typeof chalk,
      }
    };
  }, [themeName]);
}

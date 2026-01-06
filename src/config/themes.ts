/**
 * Color theme definitions for gh-manager-cli
 *
 * Defines color schemes that can be applied throughout the TUI.
 * Each theme specifies colors for different semantic purposes like
 * primary actions, errors, warnings, and repository states.
 */

export interface Theme {
  name: string;
  primary: string;      // Main accent (cyan)
  secondary: string;    // Secondary accent (blue)
  success: string;      // Success states (green)
  warning: string;      // Warnings (yellow)
  error: string;        // Errors (red)
  muted: string;        // Muted text (gray)
  text: string;         // Normal text (white)
  selected: string;     // Selected item bg
  private: string;      // Private repo indicator
  archived: string;     // Archived indicator
}

export const themes: Record<string, Theme> = {
  default: {
    name: 'Default',
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    text: 'white',
    selected: 'cyan',
    private: 'yellow',
    archived: 'gray'
  },
  ocean: {
    name: 'Ocean',
    primary: 'blueBright',
    secondary: 'cyanBright',
    success: 'greenBright',
    warning: 'yellowBright',
    error: 'redBright',
    muted: 'gray',
    text: 'white',
    selected: 'blueBright',
    private: 'magenta',
    archived: 'gray'
  },
  forest: {
    name: 'Forest',
    primary: 'green',
    secondary: 'greenBright',
    success: 'greenBright',
    warning: 'yellow',
    error: 'red',
    muted: 'gray',
    text: 'white',
    selected: 'green',
    private: 'yellow',
    archived: 'gray'
  },
  mono: {
    name: 'Monochrome',
    primary: 'white',
    secondary: 'gray',
    success: 'whiteBright',
    warning: 'white',
    error: 'whiteBright',
    muted: 'gray',
    text: 'white',
    selected: 'whiteBright',
    private: 'white',
    archived: 'gray'
  }
};

/**
 * Gets a theme by name, falling back to default if not found
 *
 * @param name - Theme name to retrieve
 * @returns Theme object with color definitions
 * @example
 * ```typescript
 * const theme = getTheme('ocean');
 * console.log(theme.primary); // 'blueBright'
 * ```
 */
export function getTheme(name: string): Theme {
  return themes[name] || themes.default;
}

/**
 * List of all available theme names
 */
export const themeNames = Object.keys(themes);

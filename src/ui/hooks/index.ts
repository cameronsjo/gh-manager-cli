/**
 * Custom React hooks for the gh-manager-cli TUI
 *
 * @module ui/hooks
 */

/**
 * Modal state management hook for dialog workflows
 * @see {@link ./useModalState}
 */
export { useModalState } from './useModalState';

/**
 * Terminal dimension tracking hook for responsive layouts
 * @see {@link ./useTerminalSize}
 */
export { useTerminalSize } from './useTerminalSize';

/**
 * Debug message buffer hook for development diagnostics
 * @see {@link ./useDebugMessages}
 */
export { useDebugMessages } from './useDebugMessages';

/**
 * Infinite scroll prefetch hook for paginated data
 * @see {@link ./useInfiniteScroll}
 */
export { useInfiniteScroll } from './useInfiniteScroll';
export type { UseInfiniteScrollOptions } from './useInfiniteScroll';

/**
 * Virtual list rendering hooks for performance optimization
 * @see {@link ./useVirtualList}
 */
export { useVirtualList, useScrollToIndex } from './useVirtualList';
export type { UseVirtualListOptions, VirtualListResult, VirtualItem } from './useVirtualList';

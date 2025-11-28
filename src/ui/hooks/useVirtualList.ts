import { useMemo, useRef, useCallback } from 'react';

/**
 * Configuration options for virtual list
 */
export interface UseVirtualListOptions<T> {
  /** All items to virtualize */
  items: T[];
  /** Height in terminal lines per item (base height + spacing) */
  itemHeight: number;
  /** Available height for the list container in terminal lines */
  containerHeight: number;
  /** Current cursor/selected index */
  cursor: number;
  /** Extra items to render above and below visible area to reduce re-renders */
  overscan?: number;
}

/**
 * Virtual item with positioning metadata
 */
export interface VirtualItem<T> {
  /** The actual item data */
  item: T;
  /** Original index in the full items array */
  index: number;
  /** Start index in the windowed slice */
  offsetIndex: number;
}

/**
 * Result from useVirtualList hook
 */
export interface VirtualListResult<T> {
  /** Windowed array of visible items with metadata */
  virtualItems: VirtualItem<T>[];
  /** Total height of all items in terminal lines */
  totalHeight: number;
  /** Start index of the visible window */
  startIndex: number;
  /** End index of the visible window (exclusive) */
  endIndex: number;
  /** Total number of items */
  totalCount: number;
}

/**
 * Optimized virtual scrolling hook for large lists in terminal UI.
 *
 * Key optimizations:
 * - Memoizes visible window calculation to prevent recreation on every render
 * - Only recalculates when cursor moves beyond threshold or items/height change
 * - Uses stable references to minimize re-renders
 * - Pre-calculates positions for instant scroll
 *
 * @example
 * ```tsx
 * const { virtualItems, startIndex } = useVirtualList({
 *   items: repos,
 *   itemHeight: 3 + spacingLines, // base 3 lines + spacing
 *   containerHeight: terminalHeight - headerHeight,
 *   cursor: selectedIndex,
 *   overscan: 2
 * });
 *
 * virtualItems.forEach(({ item, index }) => (
 *   <RepoRow key={item.id} repo={item} index={index + 1} />
 * ));
 * ```
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  cursor,
  overscan = 2
}: UseVirtualListOptions<T>): VirtualListResult<T> {
  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  // Track the last cursor position to detect movement threshold
  const lastCursorRef = useRef(cursor);
  const lastWindowRef = useRef({ start: 0, end: 0 });

  // Calculate how many items can fit in the visible container
  const visibleCount = Math.max(1, Math.floor(containerHeight / itemHeight));

  // Memoize the visible window calculation
  // Only recalculates when dependencies change significantly
  const { start, end } = useMemo(() => {
    // If all items fit in the container, show everything
    if (visibleCount >= totalCount) {
      return { start: 0, end: totalCount };
    }

    // Calculate the center point for the visible window
    const halfVisible = Math.floor(visibleCount / 2);

    // Calculate desired start position centered on cursor
    let startPos = Math.max(0, cursor - halfVisible - overscan);

    // Ensure we don't scroll past the end
    startPos = Math.min(startPos, Math.max(0, totalCount - visibleCount));

    // Calculate end position with buffer
    const endPos = Math.min(totalCount, startPos + visibleCount + (overscan * 2));

    // Check if cursor moved beyond threshold (optimization to prevent constant recalc)
    const cursorDelta = Math.abs(cursor - lastCursorRef.current);
    const threshold = 3; // Only recalculate if cursor moved 3+ items

    // If cursor movement is small and window hasn't changed, reuse previous window
    if (cursorDelta < threshold &&
        cursor >= lastWindowRef.current.start &&
        cursor < lastWindowRef.current.end) {
      return lastWindowRef.current;
    }

    // Update refs for next comparison
    lastCursorRef.current = cursor;
    lastWindowRef.current = { start: startPos, end: endPos };

    return { start: startPos, end: endPos };
  }, [
    cursor,
    totalCount,
    visibleCount,
    overscan,
    // Only include the array length to avoid deep equality checks
    items.length
  ]);

  // Memoize the virtual items array to prevent recreation
  const virtualItems = useMemo((): VirtualItem<T>[] => {
    const sliced = items.slice(start, end);
    return sliced.map((item, i) => ({
      item,
      index: start + i,
      offsetIndex: i
    }));
  }, [items, start, end]);

  return {
    virtualItems,
    totalHeight,
    startIndex: start,
    endIndex: end,
    totalCount
  };
}

/**
 * Stable scroll helper for jumping to specific indices
 * Returns a callback that can be used to scroll to an index
 */
export function useScrollToIndex() {
  return useCallback((index: number) => {
    // In terminal UI, scrolling is handled by cursor position
    // This is a no-op for terminal but provided for API compatibility
    // The cursor change will trigger the virtual list to recalculate
    return index;
  }, []);
}

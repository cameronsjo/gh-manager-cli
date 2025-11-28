import { useEffect, useRef } from 'react';

export interface UseInfiniteScrollOptions {
  cursor: number;
  totalItems: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

/**
 * Infinite scroll prefetch logic hook
 * Automatically triggers data loading when cursor approaches the end of loaded items
 *
 * @param options.cursor - Current cursor position in the list
 * @param options.totalItems - Total number of items currently loaded
 * @param options.hasMore - Whether more items are available to load
 * @param options.loading - Whether data is currently being loaded
 * @param options.onLoadMore - Callback to trigger when more data should be loaded
 * @param options.threshold - Number of items from end to trigger load (default: 5)
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const {
    cursor,
    totalItems,
    hasMore,
    loading,
    onLoadMore,
    threshold = 5,
  } = options;

  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    // Don't trigger if already loading or no more items available
    if (loading || !hasMore) {
      return;
    }

    // Trigger prefetch when cursor is within threshold of the end
    const distanceFromEnd = totalItems - cursor;
    if (distanceFromEnd <= threshold) {
      onLoadMoreRef.current();
    }
  }, [cursor, totalItems, hasMore, loading, threshold]);
}

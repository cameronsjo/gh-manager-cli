import { describe, it, expect } from 'vitest';

// Test the pure logic of virtual list calculation without React hooks
// Since useVirtualList uses React hooks internally, we test the algorithm logic directly

interface MockRepo {
  id: string;
  name: string;
  nameWithOwner: string;
}

const createMockRepos = (count: number): MockRepo[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `repo-${i}`,
    name: `Repository ${i}`,
    nameWithOwner: `owner/repo-${i}`
  }));
};

/**
 * Pure function version of virtual list calculation for testing
 * Mirrors the logic in useVirtualList without React hooks
 */
function calculateVirtualWindow<T>(options: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  cursor: number;
  overscan?: number;
}): {
  virtualItems: Array<{ item: T; index: number; offsetIndex: number }>;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  totalCount: number;
} {
  const { items, itemHeight, containerHeight, cursor, overscan = 2 } = options;
  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;
  const visibleCount = Math.max(1, Math.floor(containerHeight / itemHeight));

  // If all items fit in the container, show everything
  if (visibleCount >= totalCount) {
    return {
      virtualItems: items.map((item, i) => ({ item, index: i, offsetIndex: i })),
      totalHeight,
      startIndex: 0,
      endIndex: totalCount,
      totalCount
    };
  }

  // Calculate the center point for the visible window
  const halfVisible = Math.floor(visibleCount / 2);

  // Calculate desired start position centered on cursor
  let startPos = Math.max(0, cursor - halfVisible - overscan);

  // Ensure we don't scroll past the end
  startPos = Math.min(startPos, Math.max(0, totalCount - visibleCount));

  // Calculate end position with buffer
  const endPos = Math.min(totalCount, startPos + visibleCount + (overscan * 2));

  const sliced = items.slice(startPos, endPos);
  const virtualItems = sliced.map((item, i) => ({
    item,
    index: startPos + i,
    offsetIndex: i
  }));

  return {
    virtualItems,
    totalHeight,
    startIndex: startPos,
    endIndex: endPos,
    totalCount
  };
}

describe('useVirtualList (algorithm tests)', () => {
  it('should render all items when they fit in container', () => {
    const items = createMockRepos(10);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 50, // 50 lines / 3 per item = 16 visible items
      cursor: 0,
      overscan: 2
    });

    expect(result.virtualItems.length).toBe(10);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(10);
    expect(result.totalCount).toBe(10);
  });

  it('should window items when they exceed container height', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30, // 30 lines / 3 per item = 10 visible items
      cursor: 0,
      overscan: 2
    });

    // Should render visible items + overscan buffer on both sides
    expect(result.virtualItems.length).toBeLessThan(100);
    expect(result.virtualItems.length).toBeGreaterThan(10);
    expect(result.totalCount).toBe(100);
  });

  it('should center window on cursor position', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30, // 10 visible items
      cursor: 50, // Middle of list
      overscan: 2
    });

    // Cursor should be within the visible range
    expect(result.startIndex).toBeLessThanOrEqual(50);
    expect(result.endIndex).toBeGreaterThan(50);

    // Check that the cursor item is in the virtual items
    const cursorInVirtual = result.virtualItems.some(
      (item) => item.index === 50
    );
    expect(cursorInVirtual).toBe(true);
  });

  it('should handle cursor at start of list', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 0,
      overscan: 2
    });

    expect(result.startIndex).toBe(0);
    expect(result.virtualItems[0].index).toBe(0);
  });

  it('should handle cursor at end of list', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 99,
      overscan: 2
    });

    expect(result.endIndex).toBe(100);
    const lastVirtualItem = result.virtualItems[result.virtualItems.length - 1];
    expect(lastVirtualItem.index).toBe(99);
  });

  it('should calculate correct total height', () => {
    const items = createMockRepos(100);
    const itemHeight = 4;
    const result = calculateVirtualWindow({
      items,
      itemHeight,
      containerHeight: 30,
      cursor: 0
    });

    expect(result.totalHeight).toBe(100 * itemHeight);
  });

  it('should handle empty items array', () => {
    const result = calculateVirtualWindow({
      items: [],
      itemHeight: 3,
      containerHeight: 30,
      cursor: 0
    });

    expect(result.virtualItems.length).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it('should handle single item', () => {
    const items = createMockRepos(1);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 0
    });

    expect(result.virtualItems.length).toBe(1);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(1);
  });

  it('should respect overscan parameter', () => {
    const items = createMockRepos(100);
    const resultWithOverscan = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 50,
      overscan: 5
    });

    const resultWithoutOverscan = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 50,
      overscan: 0
    });

    // With overscan should have more items
    expect(resultWithOverscan.virtualItems.length).toBeGreaterThan(
      resultWithoutOverscan.virtualItems.length
    );
  });

  it('should handle large datasets efficiently', () => {
    const items = createMockRepos(10000);
    const start = performance.now();

    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 5000,
      overscan: 2
    });

    const duration = performance.now() - start;

    // Should complete quickly (< 10ms)
    expect(duration).toBeLessThan(10);

    // Should only render a small window
    expect(result.virtualItems.length).toBeLessThan(50);
    expect(result.totalCount).toBe(10000);
  });

  it('should provide correct offsetIndex for each virtual item', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 50,
      overscan: 2
    });

    result.virtualItems.forEach((item, i) => {
      expect(item.offsetIndex).toBe(i);
      expect(item.index).toBe(result.startIndex + i);
    });
  });

  it('should handle various item heights', () => {
    const items = createMockRepos(100);

    // Compact mode (2 lines per item)
    const compactResult = calculateVirtualWindow({
      items,
      itemHeight: 2,
      containerHeight: 30,
      cursor: 0
    });

    // Cozy mode (4 lines per item)
    const cozyResult = calculateVirtualWindow({
      items,
      itemHeight: 4,
      containerHeight: 30,
      cursor: 0
    });

    // Compact should show more items
    expect(compactResult.virtualItems.length).toBeGreaterThan(
      cozyResult.virtualItems.length
    );
  });

  it('should handle cursor beyond items length gracefully', () => {
    const items = createMockRepos(10);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 30,
      cursor: 100 // Beyond items length
    });

    // Should still work and show items
    expect(result.virtualItems.length).toBe(10);
    expect(result.endIndex).toBe(10);
  });

  it('should handle very small container height', () => {
    const items = createMockRepos(100);
    const result = calculateVirtualWindow({
      items,
      itemHeight: 3,
      containerHeight: 3, // Only 1 item visible
      cursor: 50
    });

    // Should still show at least 1 item plus overscan
    expect(result.virtualItems.length).toBeGreaterThanOrEqual(1);

    // Cursor item should be visible
    const cursorVisible = result.virtualItems.some(item => item.index === 50);
    expect(cursorVisible).toBe(true);
  });
});

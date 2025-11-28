/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalState } from '../useModalState';

describe('useModalState', () => {
  describe('initial state', () => {
    it('should initialize with closed state', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.target).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useModalState());

      expect(typeof result.current.open).toBe('function');
      expect(typeof result.current.close).toBe('function');
      expect(typeof result.current.setLoading).toBe('function');
      expect(typeof result.current.setError).toBe('function');
    });
  });

  describe('open', () => {
    it('should open modal without target data', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target).toBe(null);
    });

    it('should open modal with target data', () => {
      interface TargetType {
        id: string;
        name: string;
      }

      const { result } = renderHook(() => useModalState<TargetType>());

      const targetData = { id: '1', name: 'Test Repo' };

      act(() => {
        result.current.open(targetData);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target).toEqual(targetData);
    });

    it('should clear error when opening', () => {
      const { result } = renderHook(() => useModalState());

      // Set an error first
      act(() => {
        result.current.setError('Previous error');
      });

      expect(result.current.error).toBe('Previous error');

      // Open should clear error
      act(() => {
        result.current.open();
      });

      expect(result.current.error).toBe(null);
    });

    it('should update target data on subsequent opens', () => {
      interface TargetType {
        id: string;
      }

      const { result } = renderHook(() => useModalState<TargetType>());

      act(() => {
        result.current.open({ id: '1' });
      });

      expect(result.current.target?.id).toBe('1');

      act(() => {
        result.current.open({ id: '2' });
      });

      expect(result.current.target?.id).toBe('2');
    });

    it('should handle undefined target data', () => {
      const { result } = renderHook(() => useModalState<string>());

      act(() => {
        result.current.open(undefined);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target).toBe(null);
    });
  });

  describe('close', () => {
    it('should close modal and reset all state', () => {
      const { result } = renderHook(() => useModalState<string>());

      // Set up some state
      act(() => {
        result.current.open('target-data');
        result.current.setLoading(true);
      });

      // Note: setError also sets loading to false, so check that behavior separately
      act(() => {
        result.current.setError('Some error');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target).toBe('target-data');
      expect(result.current.loading).toBe(false); // setError sets this to false
      expect(result.current.error).toBe('Some error');

      // Close should reset everything
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.target).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should be safe to call when already closed', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);
    });

    it('should set loading state to false', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should not affect other state', () => {
      const { result } = renderHook(() => useModalState<string>());

      act(() => {
        result.current.open('target');
        result.current.setError('error message');
      });

      const isOpenBefore = result.current.isOpen;
      const targetBefore = result.current.target;
      const errorBefore = result.current.error;

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isOpen).toBe(isOpenBefore);
      expect(result.current.target).toBe(targetBefore);
      expect(result.current.error).toBe(errorBefore);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useModalState());

      const errorMessage = 'Something went wrong';

      act(() => {
        result.current.setError(errorMessage);
      });

      expect(result.current.error).toBe(errorMessage);
    });

    it('should clear loading state when setting error', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.setError('Error occurred');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Error occurred');
    });

    it('should clear error by setting null', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setError('Error message');
      });

      expect(result.current.error).toBe('Error message');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBe(null);
    });

    it('should not affect isOpen or target state', () => {
      const { result } = renderHook(() => useModalState<string>());

      act(() => {
        result.current.open('target');
      });

      const isOpenBefore = result.current.isOpen;
      const targetBefore = result.current.target;

      act(() => {
        result.current.setError('Error message');
      });

      expect(result.current.isOpen).toBe(isOpenBefore);
      expect(result.current.target).toBe(targetBefore);
    });
  });

  describe('complex workflows', () => {
    it('should handle typical modal lifecycle', () => {
      const { result } = renderHook(() => useModalState<{ id: string }>());

      // Initial state
      expect(result.current.isOpen).toBe(false);

      // User opens modal
      act(() => {
        result.current.open({ id: 'repo-123' });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target?.id).toBe('repo-123');

      // User triggers action, show loading
      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.loading).toBe(true);

      // Action succeeds, close modal
      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('should handle error workflow', () => {
      const { result } = renderHook(() => useModalState<string>());

      // Open modal
      act(() => {
        result.current.open('data');
      });

      // Start loading
      act(() => {
        result.current.setLoading(true);
      });

      // Error occurs
      act(() => {
        result.current.setError('Failed to process');
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to process');

      // User tries again - open clears error
      act(() => {
        result.current.open('data');
      });

      expect(result.current.error).toBe(null);
    });

    it('should handle rapid open/close cycles', () => {
      const { result } = renderHook(() => useModalState<number>());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.open(i);
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.target).toBe(i);

        act(() => {
          result.current.close();
        });

        expect(result.current.isOpen).toBe(false);
      }
    });

    it('should maintain referential stability of callbacks', () => {
      const { result, rerender } = renderHook(() => useModalState());

      const openFn1 = result.current.open;
      const closeFn1 = result.current.close;
      const setLoadingFn1 = result.current.setLoading;
      const setErrorFn1 = result.current.setError;

      // Change state
      act(() => {
        result.current.open();
      });

      rerender();

      // Callbacks should be the same instances
      expect(result.current.open).toBe(openFn1);
      expect(result.current.close).toBe(closeFn1);
      expect(result.current.setLoading).toBe(setLoadingFn1);
      expect(result.current.setError).toBe(setErrorFn1);
    });
  });

  describe('type safety', () => {
    it('should work with string target type', () => {
      const { result } = renderHook(() => useModalState<string>());

      act(() => {
        result.current.open('test-string');
      });

      expect(result.current.target).toBe('test-string');
    });

    it('should work with number target type', () => {
      const { result } = renderHook(() => useModalState<number>());

      act(() => {
        result.current.open(42);
      });

      expect(result.current.target).toBe(42);
    });

    it('should work with object target type', () => {
      interface Repository {
        id: string;
        name: string;
        owner: string;
      }

      const { result } = renderHook(() => useModalState<Repository>());

      const repo: Repository = {
        id: '1',
        name: 'test-repo',
        owner: 'testuser',
      };

      act(() => {
        result.current.open(repo);
      });

      expect(result.current.target).toEqual(repo);
    });

    it('should work with array target type', () => {
      const { result } = renderHook(() => useModalState<string[]>());

      const targets = ['item1', 'item2', 'item3'];

      act(() => {
        result.current.open(targets);
      });

      expect(result.current.target).toEqual(targets);
    });

    it('should default to null type when no type parameter provided', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current.target).toBe(null);

      act(() => {
        result.current.open();
      });

      expect(result.current.target).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle opening with null explicitly', () => {
      const { result } = renderHook(() => useModalState<string | null>());

      act(() => {
        result.current.open(null);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.target).toBe(null);
    });

    it('should handle empty string error', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setError('');
      });

      expect(result.current.error).toBe('');
    });

    it('should handle multiple setError calls', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setError('Error 1');
      });

      expect(result.current.error).toBe('Error 1');

      act(() => {
        result.current.setError('Error 2');
      });

      expect(result.current.error).toBe('Error 2');
    });

    it('should handle boolean target type', () => {
      const { result } = renderHook(() => useModalState<boolean>());

      act(() => {
        result.current.open(false);
      });

      expect(result.current.target).toBe(false);

      act(() => {
        result.current.open(true);
      });

      expect(result.current.target).toBe(true);
    });
  });
});

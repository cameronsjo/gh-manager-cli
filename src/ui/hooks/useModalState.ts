import { useState, useCallback } from 'react';

/**
 * Generic modal state management hook
 *
 * Manages complete modal lifecycle including open/closed state, target data,
 * loading indicators, and error messages. Provides clean separation of concerns
 * for modal dialogs in the TUI.
 *
 * @template T - Type of the modal target data (e.g., RepoNode, Organization)
 * @returns Object containing modal state and control functions
 * @example
 * ```typescript
 * const deleteModal = useModalState<RepoNode>();
 *
 * // Open modal with target
 * deleteModal.open(selectedRepo);
 *
 * // Show loading state during async operation
 * deleteModal.setLoading(true);
 *
 * // Handle errors
 * deleteModal.setError('Failed to delete repository');
 *
 * // Close modal and reset all state
 * deleteModal.close();
 * ```
 */
export function useModalState<T = null>() {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((targetData?: T) => {
    setIsOpen(true);
    if (targetData !== undefined) {
      setTarget(targetData);
    }
    setError(null);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
    setLoading(false);
    setError(null);
  }, []);

  const setLoadingState = useCallback((loadingState: boolean) => {
    setLoading(loadingState);
  }, []);

  const setErrorState = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
    setLoading(false);
  }, []);

  return {
    isOpen,
    target,
    loading,
    error,
    open,
    close,
    setLoading: setLoadingState,
    setError: setErrorState,
  };
}

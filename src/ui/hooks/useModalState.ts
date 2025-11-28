import { useState, useCallback } from 'react';

/**
 * Generic modal state management hook
 * Manages open/closed state, target data, loading state, and error messages
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

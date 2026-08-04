import { useEffect, useState } from 'react';

export function useDebounce<T>(
  value: T,
  delay = 500,
): T {
  const [debouncedValue, setDebouncedValue] =
    useState<T>(value);

  useEffect(() => {
    const normalizedDelay =
      Number.isFinite(delay)
        ? Math.max(0, delay)
        : 500;

    const timerId = setTimeout(() => {
      setDebouncedValue(value);
    }, normalizedDelay);

    return () => {
      clearTimeout(timerId);
    };
  }, [value, delay]);

  return debouncedValue;
}
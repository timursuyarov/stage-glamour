import { useEffect, useMemo, useRef } from "react";

/**
 * Returns a stable debounced wrapper around `fn`. The latest `fn` is always
 * called, and any pending timer is cleared on unmount. No external dependency
 * (the source used lodash.debounce; this repo has no lodash).
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 500,
): (...args: A) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  return useMemo(
    () =>
      (...args: A) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => fnRef.current(...args), delay);
      },
    [delay],
  );
}

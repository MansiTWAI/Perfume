import { useEffect } from 'react';

// Pages that open on a light background ask for a solid header so the
// ivory navigation stays readable before the visitor scrolls.
export function useSolidHeader(active = true) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add('solid-header');
    return () => document.documentElement.classList.remove('solid-header');
  }, [active]);
}

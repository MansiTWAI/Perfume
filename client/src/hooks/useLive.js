import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// Loads `path` and keeps it fresh: again every `every` ms while the tab is
// visible, and as soon as the visitor returns to the tab. Order status
// changes made by the house show up without a reload.
export function useLive(path, { every = 30000, skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const alive = useRef(true);

  const load = useCallback(
    async (quiet = false) => {
      if (skip || !path) return;
      if (!quiet) setLoading(true);
      try {
        const d = await api(path);
        if (!alive.current) return;
        setData(d);
        setError(null);
      } catch (e) {
        // A background refresh that fails keeps what is already on screen.
        if (alive.current && !quiet) setError(e);
      } finally {
        if (alive.current && !quiet) setLoading(false);
      }
    },
    [path, skip]
  );

  useEffect(() => {
    alive.current = true;
    setData(null);
    setError(null);
    load();
    const tick = setInterval(() => document.visibilityState === 'visible' && load(true), every);
    const onShow = () => document.visibilityState === 'visible' && load(true);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      alive.current = false;
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [load, every]);

  return { data, error, loading, reload: () => load() };
}

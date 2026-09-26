import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

// Small cache so navigating back to a page is instant.
const cache = new Map();

export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(() => (path ? cache.get(path) : undefined));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!data && !skip);

  const load = useCallback(async () => {
    if (!path || skip) return;
    setLoading(!cache.has(path));
    setError(null);
    try {
      const d = await api(path);
      cache.set(path, d);
      setData(d);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [path, skip]);

  useEffect(() => {
    setData(path ? cache.get(path) : undefined);
    load();
  }, [load, path]);

  return { data, error, loading, reload: load };
}

export const clearApiCache = () => cache.clear();

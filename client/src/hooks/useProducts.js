import CATALOG from '../../../shared/catalog.js';
import { useApi } from './useApi';

// The storefront always has products to show: live data from the API when it
// answers, otherwise the bundled catalogue (the same data the database is
// seeded from). Only checkout needs the API itself.
const FALLBACK = CATALOG.filter((p) => p.published !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

export function useProducts() {
  const { data, loading, error } = useApi('/products');
  const live = Array.isArray(data) && data.length > 0;
  return { products: live ? data : FALLBACK, loading: loading && !live && !error, offline: !live && !!error };
}

export function useProduct(slug) {
  const { data, loading, error } = useApi(`/products/${slug}`);
  if (data?.product) return { data, loading: false, error: null };
  const local = FALLBACK.find((p) => p.slug === slug);
  // Fall back when the API errors or answers without product data.
  if (local && (error || (!loading && !data?.product))) {
    return { data: { product: local, related: FALLBACK.filter((p) => p.slug !== slug) }, loading: false, error: null };
  }
  return { data: undefined, loading, error };
}

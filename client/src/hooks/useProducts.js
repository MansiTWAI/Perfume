import { useMemo } from 'react';
import CATALOG from '../../../shared/catalog.js';
import { useApi } from './useApi';
import { useStore } from '../context/StoreContext';
import { localizeProduct } from '../lib/i18n';

// The storefront always has products to show: live data from the API when it
// answers, otherwise the bundled catalogue (the same data the database is
// seeded from). Only checkout needs the API itself.
const FALLBACK = CATALOG.filter((p) => p.published !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

export function useProducts() {
  const { lang } = useStore();
  const { data, loading, error } = useApi('/products');
  const live = Array.isArray(data) && data.length > 0;
  const products = useMemo(() => (live ? data : FALLBACK).map((p) => localizeProduct(p, lang)), [live, data, lang]);
  return { products, loading: loading && !live && !error, offline: !live && !!error };
}

export function useProduct(slug) {
  const { lang } = useStore();
  const { data, loading, error } = useApi(`/products/${slug}`);
  const local = FALLBACK.find((p) => p.slug === slug);
  // Fall back when the API errors or answers without product data.
  const raw = data?.product
    ? data
    : local && (error || (!loading && !data?.product))
      ? { product: local, related: FALLBACK.filter((p) => p.slug !== slug) }
      : null;
  const localized = useMemo(
    () => raw && { ...raw, product: localizeProduct(raw.product, lang), related: raw.related?.map((p) => localizeProduct(p, lang)) },
    [raw?.product, raw?.related, lang]
  );
  if (localized) return { data: localized, loading: false, error: null };
  return { data: undefined, loading, error };
}

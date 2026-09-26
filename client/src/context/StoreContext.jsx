import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';

const StoreContext = createContext(null);

// Mirrors server/src/config/commerce.js until /api/settings loads.
const FALLBACK_REGIONS = [
  { code: 'IN', name: 'India', currency: 'INR', ships: true, taxLabel: 'incl. GST', payments: ['cod', 'pay-on-confirmation'] },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', ships: true, taxLabel: 'incl. 5% VAT', payments: ['pay-on-confirmation'] },
];

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => read('ab_cart', []));
  const [regionCode, setRegion] = useState(() => read('ab_region', 'IN'));
  const [regions, setRegions] = useState(FALLBACK_REGIONS);
  const [cartOpen, setCartOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => write('ab_cart', cart), [cart]);
  useEffect(() => write('ab_region', regionCode), [regionCode]);

  useEffect(() => {
    api('/settings').then((s) => s.regions?.length && setRegions(s.regions)).catch(() => {});
    if (getToken()) {
      api('/auth/me')
        .then((d) => setUser(d.user))
        .catch(() => setToken(null));
    }
  }, []);

  const region = regions.find((r) => r.code === regionCode) || regions[0];
  const currency = region.currency;

  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const addToCart = useCallback((product, qty = 1) => {
    setCart((c) => {
      const found = c.find((i) => i.slug === product.slug);
      if (found) return c.map((i) => (i.slug === product.slug ? { ...i, qty: Math.min(i.qty + qty, 10) } : i));
      return [
        ...c,
        {
          slug: product.slug,
          name: product.name,
          subtitle: product.subtitle,
          image: product.images?.[0]?.src,
          price: product.price,
          sizeLabel: product.sizeLabel,
          qty,
        },
      ];
    });
  }, []);

  const setQty = useCallback((slug, qty) => {
    setCart((c) => (qty <= 0 ? c.filter((i) => i.slug !== slug) : c.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, 10) } : i))));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);
  const login = useCallback((token, u) => {
    setToken(token);
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const subtotal = cart.reduce((s, i) => s + (i.price?.[currency] || 0) * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const rule = region.ships ? region.shipping : null;
  const shipping = !cart.length || !rule ? 0 : subtotal >= rule.freeOver ? 0 : rule.flat;

  const value = useMemo(
    () => ({
      cart, addToCart, setQty, clearCart, subtotal, count, shipping,
      regions, region, setRegion, currency,
      cartOpen, setCartOpen, finderOpen, setFinderOpen, searchOpen, setSearchOpen,
      user, login, logout, toasts, toast,
    }),
    [cart, addToCart, setQty, clearCart, subtotal, count, shipping, regions, region, currency, cartOpen, finderOpen, searchOpen, user, login, logout, toasts, toast]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);

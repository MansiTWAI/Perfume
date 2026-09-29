import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';
import { LANGS, translate } from '../lib/i18n';
import { money } from '../lib/format';

const StoreContext = createContext(null);

// Mirrors server/src/config/commerce.js until /api/settings loads.
const FALLBACK_REGIONS = [
  { code: 'IN', name: 'India', currency: 'INR', ships: true, taxLabel: 'incl. GST', payments: ['cod', 'pay-on-confirmation'] },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', ships: true, taxLabel: 'incl. 5% VAT', payments: ['pay-on-confirmation'] },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', ships: false, base: 'AED', fx: 1.0211 },
  { code: 'QA', name: 'Qatar', currency: 'QAR', ships: false, base: 'AED', fx: 0.9912 },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', ships: false, base: 'AED', fx: 0.0836 },
  { code: 'OM', name: 'Oman', currency: 'OMR', ships: false, base: 'AED', fx: 0.1047 },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', ships: false, base: 'AED', fx: 0.1024 },
];

export const GULF = ['AE', 'SA', 'QA', 'KW', 'OM', 'BH'];

// ?region=AE and ?lang=ar let campaign links open the right market directly.
const query = (key) => {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
};

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
  const [regionCode, setRegionCode] = useState(() => query('region')?.toUpperCase() || read('ab_market', null) || 'IN');
  const [regions, setRegions] = useState(FALLBACK_REGIONS);
  const [lang, setLangState] = useState(() => {
    const q = query('lang');
    if (LANGS[q]) return q;
    return read('ab_lang', null) || (navigator.language?.startsWith('ar') ? 'ar' : 'en');
  });
  // Whether the visitor has ever chosen a language; the Arabic prompt waits for this.
  const [langChosen, setLangChosen] = useState(() => !!(LANGS[query('lang')] || read('ab_lang', null)));
  // Stored under a new key: the old one was written for every visitor, chosen or not.
  const regionChosen = useRef(!!(query('region') || read('ab_market', null)));
  const [cartOpen, setCartOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => write('ab_cart', cart), [cart]);
  useEffect(() => {
    if (regionChosen.current) write('ab_market', regionCode);
  }, [regionCode]);

  const setRegion = useCallback((code) => {
    regionChosen.current = true;
    setRegionCode(code);
  }, []);
  const setLang = useCallback((l) => {
    setLangState(l);
    setLangChosen(true);
    write('ab_lang', l);
  }, []);

  // First visit: open in the visitor's own market, detected from their IP.
  useEffect(() => {
    if (regionChosen.current) return;
    api('/geo')
      .then(({ country }) => {
        if (!regionChosen.current && country && FALLBACK_REGIONS.some((r) => r.code === country)) setRegionCode(country);
      })
      .catch(() => {});
  }, []);

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
  const gulf = GULF.includes(region.code);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = LANGS[lang].dir;
    html.dataset.market = gulf ? 'gulf' : 'india';
  }, [lang, gulf]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  // Price in the visitor's currency. Enquiry markets convert from their base
  // currency and are marked as estimates.
  const priceOf = useCallback(
    (item) => {
      const base = item?.price?.[region.base || currency];
      if (base == null) return undefined;
      return region.fx ? Math.round(base * region.fx) : base;
    },
    [region, currency]
  );
  const fmt = useCallback((n) => (region.fx ? '≈ ' : '') + money(n, currency, lang), [region.fx, currency, lang]);

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
    setCart([]); // the bag is kept on the account, not left on this device
  }, []);

  // Signed in, the bag lives on the account (/api/cart), shared with the
  // mobile app. On sign-in the bag from this device joins the saved one
  // (the larger quantity wins); after that every change is saved.
  const cartSynced = useRef(null); // id of the account the bag is in step with
  useEffect(() => {
    if (!user) {
      cartSynced.current = null;
      return undefined;
    }
    if (cartSynced.current === user.id) return undefined;
    let stale = false;
    (async () => {
      try {
        const local = read('ab_cart', []);
        const saved = await api('/cart');
        const merged = new Map(saved.items.map((i) => [i.slug, i.qty]));
        for (const i of local) merged.set(i.slug, Math.min(10, Math.max(merged.get(i.slug) || 0, i.qty)));
        const next = await api('/cart', { method: 'PUT', body: { items: [...merged].map(([slug, qty]) => ({ slug, qty })) } });
        const products = new Map((await api('/products')).map((p) => [p.slug, p]));
        if (stale) return;
        setCart(
          next.items
            .filter((i) => products.has(i.slug))
            .map((i) => {
              const p = products.get(i.slug);
              return { slug: p.slug, name: p.name, subtitle: p.subtitle, image: p.images?.[0]?.src, price: p.price, sizeLabel: p.sizeLabel, qty: i.qty };
            })
        );
        cartSynced.current = user.id;
      } catch {
        /* offline or the API is down: keep the bag on this device */
      }
    })();
    return () => {
      stale = true;
    };
  }, [user]);
  useEffect(() => {
    if (!user || cartSynced.current !== user.id) return undefined;
    const save = setTimeout(() => api('/cart', { method: 'PUT', body: { items: cart.map((i) => ({ slug: i.slug, qty: i.qty })) } }).catch(() => {}), 500);
    return () => clearTimeout(save);
  }, [cart, user]);

  const subtotal = cart.reduce((s, i) => s + (priceOf(i) || 0) * i.qty, 0);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const rule = region.ships ? region.shipping : null;
  const shipping = !cart.length || !rule ? 0 : subtotal >= rule.freeOver ? 0 : rule.flat;

  const value = useMemo(
    () => ({
      cart, addToCart, setQty, clearCart, subtotal, count, shipping,
      regions, region, setRegion, currency, gulf, priceOf, fmt,
      lang, setLang, langChosen, t, dir: LANGS[lang].dir,
      cartOpen, setCartOpen, finderOpen, setFinderOpen, searchOpen, setSearchOpen,
      user, login, logout, toasts, toast,
    }),
    [cart, addToCart, setQty, clearCart, subtotal, count, shipping, regions, region, setRegion, currency, gulf, priceOf, fmt, lang, setLang, langChosen, t, cartOpen, finderOpen, searchOpen, user, login, logout, toasts, toast]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);

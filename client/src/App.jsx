import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Preloader from './components/Preloader';
import SmoothScroll, { scrollToTop } from './components/SmoothScroll';
import Toasts from './components/Toasts';
import SearchOverlay from './components/SearchOverlay';
import SignatureFinder from './components/SignatureFinder';
import Concierge from './components/Concierge';
import LangPrompt from './components/LangPrompt';
import { useStore } from './context/StoreContext';
import Home from './pages/Home';

// Everything except the homepage is split into its own chunk.
const Collection = lazy(() => import('./pages/Collection'));
const Product = lazy(() => import('./pages/Product'));
const Journal = lazy(() => import('./pages/Journal'));
const Article = lazy(() => import('./pages/Article'));
const Story = lazy(() => import('./pages/BrandPages').then((m) => ({ default: m.Story })));
const Mission = lazy(() => import('./pages/BrandPages').then((m) => ({ default: m.Mission })));
const Heritage = lazy(() => import('./pages/BrandPages').then((m) => ({ default: m.Heritage })));
const Gallery = lazy(() => import('./pages/Gallery'));
const Contact = lazy(() => import('./pages/Contact'));
const Faq = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.Faq })));
const Shipping = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.Shipping })));
const Privacy = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.Terms })));
const NotFound = lazy(() => import('./pages/InfoPages').then((m) => ({ default: m.NotFound })));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Track = lazy(() => import('./pages/Track'));
const Account = lazy(() => import('./pages/Account'));
const Admin = lazy(() => import('./pages/admin/Admin'));

const pageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] } },
  exit: { opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } },
};

// Pages whose text is not yet translated keep English layout inside the
// Arabic site rather than half-mirroring.
// Legal pages await a reviewed translation; article bodies are English in the database.
const ENGLISH_ONLY = /^\/(privacy-policy|terms)(\/|$)|^\/journal\/./;

function Page({ children }) {
  const { lang } = useStore();
  const { pathname } = useLocation();
  const english = lang === 'ar' && ENGLISH_ONLY.test(pathname) ? { dir: 'ltr', lang: 'en' } : {};
  return (
    <motion.main id="main" {...pageMotion} {...english}>
      <Suspense fallback={<div className="page-wait" />}>{children}</Suspense>
    </motion.main>
  );
}

const ROUTES = [
  ['/', Home],
  ['/fragrances', Collection],
  ['/fragrances/:slug', Product],
  ['/journal', Journal],
  ['/journal/:slug', Article],
  ['/our-story', Story],
  ['/mission-vision', Mission],
  ['/fragrance-heritage', Heritage],
  ['/gallery', Gallery],
  ['/contact', Contact],
  ['/faq', Faq],
  ['/shipping-returns', Shipping],
  ['/privacy-policy', Privacy],
  ['/terms', Terms],
  ['/checkout', Checkout],
  ['/order/:orderNumber', OrderSuccess],
  ['/track', Track],
  ['/account', Account],
  ['*', NotFound],
];

export default function App() {
  const location = useLocation();
  const { t } = useStore();

  useEffect(() => {
    if (!location.hash) scrollToTop();
  }, [location.pathname, location.hash]);

  if (location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="admin-loading">Loading studio…</div>}>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
        <Toasts />
      </Suspense>
    );
  }

  return (
    <SmoothScroll>
      <a className="skip" href="#main">{t('Skip to content')}</a>
      <Preloader />
      <Header />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          {ROUTES.map(([path, C]) => (
            <Route key={path} path={path} element={<Page><C /></Page>} />
          ))}
        </Routes>
      </AnimatePresence>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <SignatureFinder />
      <Concierge />
      <LangPrompt />
      <Toasts />
    </SmoothScroll>
  );
}

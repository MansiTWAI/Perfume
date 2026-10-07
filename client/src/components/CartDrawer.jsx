import { useEffect } from 'react';
import { Thumb } from './Img';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { stopScroll } from './SmoothScroll';
import Icon from './Icon';

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, subtotal, shipping, region, priceOf, fmt, t, dir } = useStore();
  const navigate = useNavigate();
  const rule = region.ships ? region.shipping : null;
  const toFree = rule ? Math.max(rule.freeOver - subtotal, 0) : 0;
  const pct = rule ? Math.min((subtotal / rule.freeOver) * 100, 100) : 0;
  // The drawer slides in from the reading-end edge: right in English, left in Arabic.
  const off = dir === 'rtl' ? '-100%' : '100%';

  useEffect(() => {
    stopScroll(cartOpen);
    const onKey = (e) => e.key === 'Escape' && setCartOpen(false);
    if (cartOpen) addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [cartOpen, setCartOpen]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('Your bag')}
            initial={{ x: off }}
            animate={{ x: 0, transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
            exit={{ x: off, transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] } }}
            data-lenis-prevent
          >
            <div className="drawer-head">
              <h2>{t('Your bag')}</h2>
              <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label={t('Close bag')}><Icon name="close" /></button>
            </div>
            {rule && cart.length > 0 && (
              <div className="ship-meter">
                <p>
                  {toFree > 0
                    ? t('Add {amount} for complimentary delivery', { amount: <b>{fmt(toFree)}</b> })
                    : t('Your delivery is {free}', { free: <b>{t('complimentary')}</b> })}
                </p>
                <div className="ship-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>
              </div>
            )}
            {cart.length === 0 ? (
              <div className="drawer-empty">
                <p>{t('Your bag is waiting for its first signature.')}</p>
                <Link to="/fragrances" className="btn btn-primary" onClick={() => setCartOpen(false)}>{t('Discover the fragrances')}</Link>
              </div>
            ) : (
              <>
                <ul className="drawer-items">
                  <AnimatePresence initial={false}>
                    {cart.map((i) => (
                      <motion.li key={i.slug} layout initial={{ opacity: 0, x: dir === 'rtl' ? -30 : 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0, marginBlock: 0 }}>
                        <Thumb src={i.image} width={84} height={104} />
                        <div>
                          <Link to={`/fragrances/${i.slug}`} onClick={() => setCartOpen(false)} className="di-name">{i.name}</Link>
                          <p className="di-sub">{i.subtitle === 'Eau de Parfum' ? t('Eau de Parfum') : i.subtitle} · <span dir="ltr">{i.sizeLabel}</span></p>
                          <div className="qty">
                            <button onClick={() => setQty(i.slug, i.qty - 1)} aria-label={t('Remove one {name}', { name: i.name })}><Icon name="minus" size={16} /></button>
                            <span aria-live="polite">{i.qty}</span>
                            <button onClick={() => setQty(i.slug, i.qty + 1)} aria-label={t('Add one {name}', { name: i.name })}><Icon name="plus" size={16} /></button>
                          </div>
                        </div>
                        <div className="di-price">
                          {fmt((priceOf(i) || 0) * i.qty)}
                          <button className="link-quiet" onClick={() => setQty(i.slug, 0)}>{t('Remove')}</button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="drawer-foot">
                  <div className="row"><span>{t('Subtotal')}</span><span>{fmt(subtotal)}</span></div>
                  {region.ships && <div className="row"><span>{t('Delivery')}</span><span>{shipping ? fmt(shipping) : t('Complimentary')}</span></div>}
                  <div className="row total"><span>{t('Total')}</span><span>{fmt(subtotal + shipping)}</span></div>
                  <p className="fine">
                    {region.ships
                      ? t('Prices {tax}.', { tax: t(region.taxLabel) })
                      : `${t('Delivery to {country} is arranged on request. Checkout will guide you to WhatsApp.', { country: t(region.name) })} ${t('Prices are estimates converted from UAE dirhams. We confirm the exact amount on WhatsApp before you pay.')}`}
                  </p>
                  <button className="btn btn-primary btn-block" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>
                    {t('Proceed to checkout')}
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

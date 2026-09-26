import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { money } from '../lib/format';
import { stopScroll } from './SmoothScroll';

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setQty, subtotal, shipping, currency, region } = useStore();
  const navigate = useNavigate();
  const rule = region.ships ? region.shipping : null;
  const toFree = rule ? Math.max(rule.freeOver - subtotal, 0) : 0;
  const pct = rule ? Math.min((subtotal / rule.freeOver) * 100, 100) : 0;

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
            aria-label="Your bag"
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
            exit={{ x: '100%', transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] } }}
            data-lenis-prevent
          >
            <div className="drawer-head">
              <h2>Your bag</h2>
              <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close bag">✕</button>
            </div>
            {rule && cart.length > 0 && (
              <div className="ship-meter">
                <p>{toFree > 0 ? <>Add <b>{money(toFree, currency)}</b> for complimentary delivery</> : <>Your delivery is <b>complimentary</b></>}</p>
                <div className="ship-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>
              </div>
            )}
            {cart.length === 0 ? (
              <div className="drawer-empty">
                                <p>Your bag is waiting for its first signature.</p>
                <Link to="/fragrances" className="btn btn-primary" onClick={() => setCartOpen(false)}>Discover the fragrances</Link>
              </div>
            ) : (
              <>
                <ul className="drawer-items">
                  <AnimatePresence initial={false}>
                    {cart.map((i) => (
                      <motion.li key={i.slug} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0, marginBlock: 0 }}>
                        <img src={i.image} alt="" width="84" height="104" />
                        <div>
                          <Link to={`/fragrances/${i.slug}`} onClick={() => setCartOpen(false)} className="di-name">{i.name}</Link>
                          <p className="di-sub">{i.subtitle} · {i.sizeLabel}</p>
                          <div className="qty">
                            <button onClick={() => setQty(i.slug, i.qty - 1)} aria-label={`Remove one ${i.name}`}>−</button>
                            <span aria-live="polite">{i.qty}</span>
                            <button onClick={() => setQty(i.slug, i.qty + 1)} aria-label={`Add one ${i.name}`}>+</button>
                          </div>
                        </div>
                        <div className="di-price">
                          {money((i.price?.[currency] || 0) * i.qty, currency)}
                          <button className="link-quiet" onClick={() => setQty(i.slug, 0)}>Remove</button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="drawer-foot">
                  <div className="row"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
                  <div className="row"><span>Delivery</span><span>{shipping ? money(shipping, currency) : 'Complimentary'}</span></div>
                  <div className="row total"><span>Total</span><span>{money(subtotal + shipping, currency)}</span></div>
                  <p className="fine">{region.ships ? `Prices ${region.taxLabel}.` : `Delivery to ${region.name} is arranged on request. Checkout will guide you to WhatsApp.`}</p>
                  <button className="btn btn-primary btn-block" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>
                    Proceed to checkout
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

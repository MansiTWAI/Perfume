import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useStore } from '../context/StoreContext';
import { useLive } from '../hooks/useLive';
import { formatDate, money } from '../lib/format';
import { AuthForm, ACTIVE } from './Account';

export const PAYMENT_METHOD = { cod: 'Cash on delivery', 'pay-on-confirmation': 'Pay on confirmation' };
export const PAYMENT_STATUS = { pending: 'Payment pending', paid: 'Paid', refunded: 'Refunded' };
export const statusTone = (s) => (s === 'Delivered' ? 'is-done' : s === 'Cancelled' ? 'is-cancelled' : 'is-active');

const FILTERS = [
  ['', 'All'],
  ['active', 'On their way'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];
const matches = (o, show) =>
  !show || (show === 'active' ? ACTIVE.includes(o.status) : show === 'delivered' ? o.status === 'Delivered' : o.status === 'Cancelled');

function OrderCard({ o }) {
  const { t, lang } = useStore();
  const qty = o.items.reduce((n, i) => n + i.qty, 0);
  return (
    <li className="my-order">
      <Link to={`/profile/orders/${o.orderNumber}`} className="my-order-link" aria-label={t('View order {n}', { n: o.orderNumber })} />
      <div className="my-order-head">
        <div>
          <p className="my-order-id" dir="ltr">{o.orderNumber}</p>
          <small>{formatDate(o.createdAt)} · {t(qty === 1 ? '{n} item' : '{n} items', { n: qty })}</small>
        </div>
        <span className={`status-pill ${statusTone(o.status)}`}>{t(o.status)}</span>
      </div>
      <ul className="my-order-items">
        {o.items.map((i) => (
          <li key={i.slug}>
            {i.image ? <img src={i.image} alt="" width="56" height="70" loading="lazy" /> : <span className="my-order-noimg" />}
            <span><b>{i.name}</b><small>{t('Qty {n}', { n: i.qty })}</small></span>
          </li>
        ))}
      </ul>
      <div className="my-order-foot">
        <div>
          <b>{money(o.total, o.currency, lang)}</b>
          <small>{t(PAYMENT_STATUS[o.paymentStatus] || o.paymentStatus)} · {t(PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod)}</small>
        </div>
        <div className="my-order-actions">
          {o.editable?.details && <span className="my-order-hint">{t('Can still be changed')}</span>}
          <span className="btn btn-ghost">{t('View order')}</span>
        </div>
      </div>
    </li>
  );
}

export default function MyOrders() {
  const { user, t } = useStore();
  const [params, setParams] = useSearchParams();
  const show = params.get('show') || '';
  const { data: orders, error, reload } = useLive('/orders/mine', { skip: !user });
  const list = (orders || []).filter((o) => matches(o, show));
  const countFor = (key) => (orders || []).filter((o) => matches(o, key)).length;

  return (
    <AccountLayout title={t('My orders')} seoTitle="My orders" lede={t('Every order you have placed with us, newest first.')} signedOut={<AuthForm />}>
      {orders?.length > 0 && (
        <div className="acct-tabs" role="tablist" aria-label={t('Filter orders')}>
          {FILTERS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={show === key} className={show === key ? 'is-on' : ''} onClick={() => setParams(key ? { show: key } : {})}>
              {t(label)} <span>{countFor(key)}</span>
            </button>
          ))}
        </div>
      )}
      {!orders && !error ? (
        <ul className="my-orders" aria-busy="true">{[0, 1].map((k) => <li key={k} className="my-order is-skeleton" />)}</ul>
      ) : error ? (
        <div className="state-box" role="alert">
          <p>{t('We could not load your orders just now.')}</p>
          <button className="btn btn-ghost" onClick={reload}>{t('Try again')}</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="state-box">
          <p>{t('No orders yet.')}</p>
          <Link to="/fragrances" className="btn btn-primary">{t('Find your signature')}</Link>
        </div>
      ) : list.length === 0 ? (
        <div className="state-box">
          <p>{t('No orders here.')}</p>
          <button className="btn btn-ghost" onClick={() => setParams({})}>{t('Show all orders')}</button>
        </div>
      ) : (
        <ul className="my-orders">{list.map((o) => <OrderCard key={o._id} o={o} />)}</ul>
      )}
    </AccountLayout>
  );
}

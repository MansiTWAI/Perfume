import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { money, CONTACT } from '../../lib/format';
import Icon from '../../components/Icon';
import { formatPhone } from './ui';

// A printable invoice for one order (Orders → open an order → Invoice PDF).
// The browser's print window saves it as a PDF; the studio menu and buttons
// are left out of the printout.
const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const PAY = { cod: 'Cash on delivery', 'pay-on-confirmation': 'Pay on confirmation', online: 'Paid online' };

export function InvoicePage() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/admin/orders/${id}`).then(setO).catch((e) => setError(e.message));
  }, [id]);
  // Open the print window once the invoice is on screen.
  useEffect(() => {
    if (!o) return undefined;
    document.title = `Invoice ${o.orderNumber}`;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [o]);

  if (error) return <p className="a-error">{error}</p>;
  if (!o) return <p className="a-muted">Preparing the invoice…</p>;
  const c = o.customer || {};
  const a = c.address || {};
  const cur = o.currency;
  const tax = cur === 'INR' ? 'GST' : 'VAT';
  return (
    <div className="a-invoice-page">
      <div className="a-invoice-tools">
        <Link to={`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`} className="a-btn"><Icon name="arrow-left" size={16} /> Back to the order</Link>
        <button type="button" className="a-btn a-primary" onClick={() => window.print()}><Icon name="printer" size={16} /> Print or save as PDF</button>
      </div>
      <article className="a-invoice">
        <header className="a-invoice-head">
          <div>
            <img src="/media/emblem.webp" alt="" width="64" />
            <h1>AL BARAKAH LIFESTYLE</h1>
            <p>{CONTACT.address}<br />{CONTACT.phone} · {CONTACT.email} · {CONTACT.web}</p>
          </div>
          <dl>
            <dt>Invoice</dt><dd>{o.orderNumber}</dd>
            <dt>Date</dt><dd>{day(o.createdAt)}</dd>
            <dt>Payment</dt><dd>{PAY[o.paymentMethod] || o.paymentMethod} · {o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Due'}</dd>
            {o.status === 'Cancelled' && <><dt>Status</dt><dd>Cancelled</dd></>}
          </dl>
        </header>
        <section className="a-invoice-to">
          <h2>Bill and deliver to</h2>
          <p><b>{c.name}</b><br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}<br />{a.country}<br />{formatPhone(c.phone, a.country) || c.phone} · {c.email}</p>
        </section>
        <table className="a-invoice-items">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
          <tbody>
            {o.items.map((i, n) => (
              <tr key={n}><td>{i.name}</td><td>{i.qty}</td><td>{money(i.unitPrice, cur)}</td><td>{money((i.unitPrice || 0) * i.qty, cur)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>Subtotal</td><td>{money(o.subtotal, cur)}</td></tr>
            {o.discount > 0 && <tr><td colSpan={3}>Discount{o.coupon?.code && ` (${o.coupon.code})`}</td><td>−{money(o.discount, cur)}</td></tr>}
            <tr><td colSpan={3}>Delivery</td><td>{o.shipping ? money(o.shipping, cur) : 'Free'}</td></tr>
            <tr className="is-total"><td colSpan={3}>Total ({cur})</td><td>{money(o.total, cur)}</td></tr>
          </tfoot>
        </table>
        <footer className="a-invoice-foot">
          <p>Prices include {tax}. {o.trackingNumber && <>Shipment {o.carrier} {o.trackingNumber}. </>}Thank you for choosing AL BARAKAH LIFESTYLE.</p>
        </footer>
      </article>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, downloadFile } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import Icon from '../../components/Icon';

// Scratch cards: print runs of unique codes for the physical cards packed
// with every order. Each code works once, is never listed on the website and
// is typed in the bag or at checkout. The server checks everything again.
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry');
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EMPTY = { name: '', percent: '25', count: '500', expires: inDays(90), maxINR: '', minINR: '' };

export default function ScratchCards() {
  const { toast } = useStore();
  const [list, setList] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const load = () => api('/admin/coupon-batches').then(setList).catch((e) => { setError(e.message); setList([]); });
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    setBusy('create');
    try {
      const b = await api('/admin/coupon-batches', {
        method: 'POST',
        body: {
          name: f.name || `Scratch cards ${f.percent}% · ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
          percent: Number(f.percent),
          count: Number(f.count),
          ...(f.expires && { expiresAt: new Date(`${f.expires}T23:59:59`).toISOString() }),
          ...(f.maxINR && { maxDiscount: { INR: Number(f.maxINR) } }),
          ...(f.minINR && { minSubtotal: { INR: Number(f.minINR) } }),
        },
      });
      setList((l) => [b, ...(l || [])]);
      setF(EMPTY);
      toast(`${b.count} codes ready. Download them for the printer.`);
    } catch (err) {
      setError(err.data?.errors?.map((x) => x.message).join(' ') || err.message);
    } finally {
      setBusy('');
    }
  }

  async function toggle(b) {
    if (b.active && !window.confirm(`Switch off all ${b.unused} unused cards of "${b.name}"? Customers holding them will no longer get the discount.`)) return;
    setBusy(b.id);
    try {
      const nb = await api(`/admin/coupon-batches/${b.id}`, { method: 'PATCH', body: { active: !b.active } });
      setList((l) => l.map((x) => (x.id === b.id ? nb : x)));
    } catch (err) {
      toast(err.message, 'warn');
    } finally {
      setBusy('');
    }
  }

  async function download(b) {
    setBusy(`dl:${b.id}`);
    try {
      await downloadFile(`/admin/coupon-batches/${b.id}/codes`, 'scratch_cards.xlsx');
    } catch (err) {
      toast(err.message, 'warn');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="a-panel a-scratch">
      <div className="a-scratch-head">
        <h2>Scratch cards</h2>
        <p className="a-muted">Unique codes for the physical cards packed with each order. Every code works <b>once</b>, is never shown on the website, and is typed in the bag or at checkout for the next order.</p>
      </div>

      <form className="a-form a-scratch-form" onSubmit={create}>
        <label>Discount
          <div className="a-quick">
            {['25', '50'].map((p) => <button type="button" key={p} className={f.percent === p ? 'is-on' : ''} onClick={() => setF((x) => ({ ...x, percent: p }))}>{p}%</button>)}
            <input type="number" min="1" max="100" step="1" value={f.percent} onChange={set('percent')} aria-label="Percent" className="a-scratch-pct" />
          </div>
        </label>
        <label>Number of cards<input type="number" min="1" max="5000" value={f.count} onChange={set('count')} required /><span className="a-hint">Up to 5,000 per print run.</span></label>
        <label>Valid until<input type="date" value={f.expires} min={inDays(1)} onChange={set('expires')} /><span className="a-hint">Print this date on the card. Empty = no expiry.</span></label>
        <label>Maximum discount (₹)<input type="number" min="1" value={f.maxINR} onChange={set('maxINR')} placeholder="No cap" /></label>
        <label>Minimum order (₹)<input type="number" min="1" value={f.minINR} onChange={set('minINR')} placeholder="None" /></label>
        <label>Name (for you)<input value={f.name} onChange={set('name')} maxLength={80} placeholder={`Scratch cards ${f.percent}% · ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`} /></label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <div className="a-actions"><button className="a-btn a-primary" disabled={!!busy}>{busy === 'create' ? 'Creating codes…' : `Create ${Number(f.count) || 0} codes`}</button></div>
      </form>

      {!list ? <p>Loading…</p> : list.length === 0 ? <p className="a-muted">No print runs yet.</p> : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Print run</th><th>Discount</th><th>Cards</th><th>Valid until</th><th>Codes</th><th>Status</th></tr></thead>
            <tbody>
              {list.map((b) => {
                const expired = b.expiresAt && new Date(b.expiresAt) < new Date();
                return (
                  <tr key={b.id}>
                    <td><b>{b.name}</b><br /><small>Made {day(b.createdAt)}</small></td>
                    <td>{b.percent}%{(b.maxDiscount?.INR || b.minSubtotal?.INR) && <><br /><small>{[b.maxDiscount?.INR && `up to ₹${b.maxDiscount.INR}`, b.minSubtotal?.INR && `min ₹${b.minSubtotal.INR}`].filter(Boolean).join(' · ')}</small></>}</td>
                    <td>{b.used} used<br /><small>{b.unused} of {b.count} unused</small></td>
                    <td>{day(b.expiresAt)}</td>
                    <td><button type="button" className="a-btn" disabled={!!busy} onClick={() => download(b)}><Icon name="arrow-down" size={14} /> {busy === `dl:${b.id}` ? 'Preparing…' : 'Download (.xlsx)'}</button></td>
                    <td>
                      <span className="a-coupon-state">
                        <button type="button" role="switch" aria-checked={b.active} aria-label={`${b.name}: ${b.active ? 'on' : 'off'}`} className={`a-switch${b.active ? ' is-on' : ''}`} disabled={!!busy} onClick={() => toggle(b)} />
                        <span className={`a-pill ${b.active && !expired ? 'ok' : 'off'}`}>{!b.active ? 'Off' : expired ? 'Expired' : 'Active'}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

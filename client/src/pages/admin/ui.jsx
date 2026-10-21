import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';

// Small pieces shared by the admin screens: the confirmation box that
// replaces the browser's pop-ups, friendly empty screens, phone helpers,
// copy-to-clipboard and CSV downloads.

// ----- confirmation box -----
// const ok = await confirm({ title, message, confirmLabel, danger });
// With `choices` it also asks for a reason: resolves to the chosen value
// (and `note` when `withNote`), or false when cancelled.
let open = null;
export function confirm(opts) {
  return new Promise((resolve) => {
    if (!open) return resolve(window.confirm(opts.message || opts.title)); // host not mounted
    open({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [d, setD] = useState(null);
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const first = useRef(null);
  useEffect(() => {
    open = (o) => { setChoice(o.defaultChoice || ''); setNote(''); setD(o); };
    return () => { open = null; };
  }, []);
  useEffect(() => {
    if (!d) return undefined;
    const prev = document.activeElement;
    requestAnimationFrame(() => first.current?.focus());
    const onKey = (e) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  function close(ok) {
    const value = ok && d.choices ? { choice, note: note.trim() } : ok;
    d.resolve(value);
    setD(null);
  }
  const needsChoice = d.choices && !choice;
  return (
    <div className="a-modal-back a-confirm-back" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="a-modal a-confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="a-confirm-title" aria-describedby="a-confirm-msg">
        <div className="a-modal-body">
          <div className={`a-confirm-icon ${d.danger ? 'is-danger' : ''}`} aria-hidden="true"><Icon name={d.icon || (d.danger ? 'alert' : 'check')} size={22} /></div>
          <h2 id="a-confirm-title" className="a-confirm-title">{d.title}</h2>
          {d.message && <p id="a-confirm-msg" className="a-muted">{d.message}</p>}
          {d.choices && (
            <div className="a-form">
              <label>{d.choiceLabel || 'Reason'}
                <select ref={first} value={choice} onChange={(e) => setChoice(e.target.value)} required>
                  <option value="">Choose…</option>
                  {d.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {d.withNote && <label>{d.noteLabel || 'Note (optional)'}<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={d.notePlaceholder || ''} /></label>}
            </div>
          )}
          <footer className="a-modal-foot">
            <button type="button" className="a-btn" onClick={() => close(false)} ref={d.choices ? undefined : first}>{d.cancelLabel || 'Cancel'}</button>
            <button type="button" className={`a-btn ${d.danger ? 'a-danger-solid' : 'a-primary'}`} disabled={needsChoice} onClick={() => close(true)}>{d.confirmLabel || 'Confirm'}</button>
          </footer>
        </div>
      </div>
    </div>
  );
}

// ----- empty screens -----
export function EmptyState({ icon = 'inbox', title, children, action, to, onAction }) {
  return (
    <div className="a-empty">
      <span className="a-empty-icon" aria-hidden="true"><Icon name={icon} size={26} /></span>
      <b>{title}</b>
      {children && <p className="a-muted">{children}</p>}
      {action && (to ? <Link to={to} className="a-btn a-primary">{action}</Link> : <button type="button" className="a-btn a-primary" onClick={onAction}>{action}</button>)}
    </div>
  );
}

// A failed load with a way to try again (instead of an endless "Loading…").
export function LoadError({ message, onRetry }) {
  return (
    <div className="a-empty is-error" role="alert">
      <span className="a-empty-icon" aria-hidden="true"><Icon name="error" size={26} /></span>
      <b>Could not load this</b>
      <p className="a-muted">{message || 'Please try again.'}</p>
      {onRetry && <button type="button" className="a-btn" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>}
    </div>
  );
}

// ----- phones -----
// One readable form for every number: "+91 98765 43210", "+971 50 123 4567".
export function phoneDigits(v, country = '') {
  const s = String(v || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (s.startsWith('00')) d = d.slice(2);
  else if (!s.startsWith('+')) {
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10 && !/Emirates|UAE/i.test(country)) d = `91${d}`;
    else if (d.length === 9 && /Emirates|UAE/i.test(country)) d = `971${d}`;
  }
  return d;
}
export function formatPhone(v, country) {
  const d = phoneDigits(v, country);
  if (!d) return '';
  if (/^91\d{10}$/.test(d)) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (/^971\d{9}$/.test(d)) return `+971 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return `+${d}`;
}
// WhatsApp and call buttons for a number (nothing when there is none).
export function ContactIcons({ phone, country, text = '' }) {
  const d = phoneDigits(phone, country);
  if (d.length < 8) return null;
  return (
    <span className="a-contact" onClick={(e) => e.stopPropagation()}>
      <a href={`https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`} target="_blank" rel="noreferrer" className="a-icon-btn is-wa" aria-label={`WhatsApp ${formatPhone(phone, country)}`} title="WhatsApp"><Icon name="chat" size={16} /></a>
      <a href={`tel:+${d}`} className="a-icon-btn" aria-label={`Call ${formatPhone(phone, country)}`} title="Call"><Icon name="phone" size={16} /></a>
    </span>
  );
}

// ----- copy -----
export function CopyButton({ text, label = 'Copy', done = 'Copied', className = 'a-textbtn' }) {
  const [ok, setOk] = useState(false);
  async function copy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }
  return <button type="button" className={className} onClick={copy} aria-label={`${label} ${text}`}><Icon name={ok ? 'check' : 'copy'} size={14} /> {ok ? done : label}</button>;
}

// ----- CSV -----
// Downloads rows as a CSV file Excel opens correctly (UTF-8 with BOM).
export function downloadCsv(name, columns, rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(([, h]) => cell(h)).join(','), ...rows.map((r) => columns.map(([k]) => cell(typeof k === 'function' ? k(r) : r[k])).join(','))];
  const url = URL.createObjectURL(new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

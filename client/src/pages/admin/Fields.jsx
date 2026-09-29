import { useEffect, useState } from 'react';
import { uploadFile } from '../../lib/api';
import { useStore } from '../../context/StoreContext';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_MB = 4;

// Upload from this device (to cloud storage, via the server) or type a path
// or URL. Existing /media/… and /uploads/… paths keep working.
// `kind="video"` is path-only: films are too large for uploads here.
export function ImageField({ value, onChange, label = 'Image', kind = 'image' }) {
  const { toast } = useStore();
  const [progress, setProgress] = useState(null); // null = idle, 0–100 = uploading
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!IMAGE_TYPES.includes(file.type)) return setError('Choose a JPG, PNG or WebP image.');
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(0);
    try {
      const { src } = await uploadFile(file, setProgress);
      onChange(src);
      toast('Image uploaded');
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
      setPreview('');
    }
  }

  const busy = progress !== null;
  const shown = preview || value;
  return (
    <div className="a-image">
      {shown && kind === 'image' ? <img src={shown} alt="" className={busy ? 'is-busy' : ''} /> : <div className="a-image-empty">{value ? 'Video' : 'No image'}</div>}
      <div className="a-image-ctl">
        <label>{label} {kind === 'image' ? 'path or URL' : 'path'}<input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'image' ? '/media/…, /uploads/… or https://…' : '/media/film.mp4'} /></label>
        {kind === 'image' && (
          <div className="a-upload-row">
            <label className={`a-btn a-upload ${busy ? 'is-disabled' : ''}`}>
              {busy ? `Uploading… ${progress}%` : 'Upload from device'}
              <input type="file" accept={IMAGE_TYPES.join(',')} onChange={pick} hidden disabled={busy} />
            </label>
            {busy && <span className="a-progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></span>}
            {!busy && <small className="a-muted">JPG, PNG, WebP · up to {MAX_MB} MB</small>}
          </div>
        )}
        {error && <p className="a-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

// Report period used by the order and user screens and their Excel exports.
export const PERIODS = [
  ['all', 'All time'],
  ['24h', 'Last 24 hours'],
  ['1d', 'Last 1 day (yesterday)'],
  ['7d', 'Last 7 days'],
  ['1m', 'Last 1 month'],
  ['2m', 'Last 2 months'],
  ['3m', 'Last 3 months'],
  ['custom', 'Custom range…'],
];

export function PeriodPicker({ value, onChange }) {
  const { period = 'all', from = '', to = '' } = value;
  return (
    <div className="a-period">
      <select value={period} onChange={(e) => onChange({ period: e.target.value, from, to })} aria-label="Period">
        {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {period === 'custom' && (
        <>
          <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ period, from: e.target.value, to })} aria-label="From" />
          <span className="a-muted">to</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ period, from, to: e.target.value })} aria-label="To" />
        </>
      )}
    </div>
  );
}

export const periodParams = ({ period, from, to }) =>
  period && period !== 'all' ? { period, ...(period === 'custom' ? { from, to } : {}), tz: new Date().getTimezoneOffset() } : {};

export function Pager({ page, pages, total, onPage, noun = 'items' }) {
  if (!total) return null;
  return (
    <div className="a-pager">
      <span className="a-muted">{total.toLocaleString()} {noun}</span>
      <span className="a-actions">
        <button className="a-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="a-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
      </span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="a-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`a-modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2>{onClose && <button className="a-x" onClick={onClose} aria-label="Close">✕</button>}</header>
        <div className="a-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Editable list of rows, e.g. notes, FAQs, wear stages.
export function RowList({ rows = [], onChange, fields, addLabel = 'Add row', empty }) {
  const blank = Object.fromEntries(fields.map(([k]) => [k, '']));
  const update = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => {
    const n = [...rows];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="a-rows">
      {rows.length === 0 && empty && <p className="a-muted">{empty}</p>}
      {rows.map((r, i) => (
        <div className="a-row" key={i}>
          {fields.map(([k, label, type]) =>
            type === 'textarea' ? (
              <label key={k} className="grow">{label}<textarea rows="2" value={r[k] || ''} onChange={(e) => update(i, k, e.target.value)} /></label>
            ) : (
              <label key={k}>{label}<input value={r[k] || ''} onChange={(e) => update(i, k, e.target.value)} /></label>
            )
          )}
          <div className="a-row-ctl">
            <button type="button" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        </div>
      ))}
      <button type="button" className="a-btn" onClick={() => onChange([...rows, blank])}>+ {addLabel}</button>
    </div>
  );
}

export const csv = (arr) => (arr || []).join(', ');
// Latin or Arabic commas.
export const fromCsv = (s) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);

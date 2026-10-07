import { useEffect, useState } from 'react';
import { uploadFile } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import Icon from '../../components/Icon';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_MB = 4;

function checkFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: choose a JPG, PNG or WebP image.`;
  if (file.size > MAX_MB * 1024 * 1024) return `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB.`;
  return '';
}

// One image, uploaded from this device (to cloud storage, via the server).
// There is no path or URL box: picking a file is the only way in.
// `kind="video"` keeps a path field: films are too large to upload here.
export function ImageField({ value, onChange, label = 'Image', kind = 'image', hint }) {
  const { toast } = useStore();
  const [progress, setProgress] = useState(null); // null = idle, 0–100 = uploading
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkFile(file);
    setError(problem);
    if (problem) return;
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

  if (kind === 'video') {
    return (
      <label>{label} file path<input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="/media/film.mp4" /></label>
    );
  }

  const busy = progress !== null;
  const shown = preview || value;
  return (
    <div className="a-image">
      {shown ? <img src={shown} alt="" className={busy ? 'is-busy' : ''} /> : <div className="a-image-empty">No image</div>}
      <div className="a-image-ctl">
        <b className="a-image-label">{label}</b>
        {hint && <small className="a-muted">{hint}</small>}
        <div className="a-upload-row">
          <label className={`a-btn a-upload ${busy ? 'is-disabled' : ''}`}>
            {busy ? `Uploading… ${progress}%` : value ? 'Replace' : 'Upload image'}
            <input type="file" accept={IMAGE_TYPES.join(',')} onChange={pick} hidden disabled={busy} />
          </label>
          {value && !busy && <button type="button" className="a-link" onClick={() => onChange('')}>Remove</button>}
          {busy && <span className="a-progress" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></span>}
        </div>
        {!busy && !value && <small className="a-muted">JPG, PNG, WebP · up to {MAX_MB} MB</small>}
        {error && <p className="a-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

// All of a product's photos: choose (or drop) several at once, reorder with
// the arrows, remove with ✕. The first photo is the main one.
export function PhotoGallery({ images = [], onChange }) {
  const { toast } = useStore();
  const [queue, setQueue] = useState([]); // [{ name, progress }]
  const [errors, setErrors] = useState([]);
  const [over, setOver] = useState(false);

  async function add(fileList) {
    const files = [...fileList];
    const problems = files.map(checkFile).filter(Boolean);
    const ok = files.filter((f) => !checkFile(f));
    setErrors(problems);
    if (!ok.length) return;
    setQueue(ok.map((f) => ({ name: f.name, progress: 0 })));
    let list = [...images];
    for (const [i, file] of ok.entries()) {
      try {
        const { src } = await uploadFile(file, (pct) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, progress: pct } : x))));
        list = [...list, { src, alt: '' }];
        onChange(list);
      } catch (err) {
        setErrors((e) => [...e, `${file.name}: ${err.message}`]);
      }
    }
    setQueue([]);
    toast(ok.length === 1 ? 'Photo uploaded' : `${ok.length} photos uploaded`);
  }

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const n = [...images];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="a-gallery">
      <ul className="a-gallery-grid">
        {images.map((img, i) => (
          <li key={img.src + i} className="a-gallery-item">
            <img src={img.src} alt="" />
            {i === 0 && <span className="a-gallery-main">Main</span>}
            <div className="a-gallery-ctl">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"><Icon name="arrow-left" size={16} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move later"><Icon name="arrow-right" size={16} /></button>
              <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Remove photo"><Icon name="close" size={16} /></button>
            </div>
          </li>
        ))}
        {queue.map((q) => (
          <li key={q.name} className="a-gallery-item is-uploading">
            <span className="a-progress"><span style={{ width: `${q.progress}%` }} /></span>
            <small>{q.progress}%</small>
          </li>
        ))}
        <li>
          <label
            className={`a-gallery-drop ${over ? 'is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
          >
            <Icon name="plus" />
            {images.length ? 'Add photos' : 'Add photos'}
            <small>or drop them here</small>
            <input type="file" accept={IMAGE_TYPES.join(',')} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} disabled={queue.length > 0} />
          </label>
        </li>
      </ul>
      <small className="a-muted">JPG, PNG or WebP, up to {MAX_MB} MB each. The first photo is the main one.</small>
      {errors.map((e) => <p key={e} className="a-error" role="alert">{e}</p>)}
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
      {pages > 1 && <span className="a-actions">
        <button className="a-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="arrow-left" size={16} /> Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="a-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <Icon name="arrow-right" size={16} /></button>
      </span>}
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
        <header><h2>{title}</h2>{onClose && <button className="a-x" onClick={onClose} aria-label="Close"><Icon name="close" /></button>}</header>
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
            <button type="button" onClick={() => move(i, -1)} aria-label="Move up"><Icon name="arrow-up" size={16} /></button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Move down"><Icon name="arrow-down" size={16} /></button>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="close" size={16} /></button>
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

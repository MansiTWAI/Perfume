import { useState } from 'react';
import { uploadFile } from '../../lib/api';
import { useStore } from '../../context/StoreContext';

export function ImageField({ value, onChange, label = 'Image' }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { src } = await uploadFile(file);
      onChange(src);
    } catch (err) {
      toast(err.message, 'warn');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }
  return (
    <div className="a-image">
      {value ? <img src={value} alt="" /> : <div className="a-image-empty">No image</div>}
      <div className="a-image-ctl">
        <label>{label} path<input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="/media/… or /uploads/…" /></label>
        <label className="a-btn a-upload">{busy ? 'Uploading…' : 'Upload'}<input type="file" accept="image/*,video/mp4" onChange={pick} hidden /></label>
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

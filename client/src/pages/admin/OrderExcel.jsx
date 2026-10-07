import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadFile, downloadFile } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import { Modal } from './Fields';
import Icon from '../../components/Icon';

const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STEPS = ['Upload', 'Validate', 'Preview changes', 'Confirm', 'Result'];
const plural = (n = 0, word) => `${Number(n).toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const STATUS_TONE = { committed: 'ok', previewed: 'warn', failed: 'warn', cancelled: '', expired: '' };

function Steps({ at }) {
  return (
    <ol className="a-steps">
      {STEPS.map((s, i) => <li key={s} className={i < at ? 'is-done' : i === at ? 'is-on' : ''}>{s}</li>)}
    </ol>
  );
}

function Issues({ title, list, tone, total }) {
  if (!list?.length) return null;
  return (
    <details className={`a-issues ${tone}`} open={tone === 'err'}>
      <summary>{title}</summary>
      <div className="a-table-wrap a-scroll">
        <table className="a-table a-compact">
          <thead><tr><th>Row</th><th>Order ID</th><th>Column</th><th>{tone === 'err' ? 'Problem' : 'Details'}</th></tr></thead>
          <tbody>
            {list.map((e, i) => <tr key={i}><td>{e.row || '—'}</td><td>{e.orderId || '—'}</td><td>{e.field || '—'}</td><td>{e.message}</td></tr>)}
          </tbody>
        </table>
      </div>
      {total > list.length && <p className="a-muted">Showing the first {list.length.toLocaleString()}. Download the full report for the rest.</p>}
    </details>
  );
}

function Totals({ job }) {
  const t = job.totals || {};
  const done = job.status === 'committed';
  return (
    <div className="a-tiles a-tiles-sm">
      <div className="a-tile"><span>Rows in file</span><b>{t.rows ?? 0}</b></div>
      <div className="a-tile"><span>{done ? 'Updated' : 'Will update'}</span><b>{done ? t.updated : job.changesTotal ?? 0}</b></div>
      <div className="a-tile"><span>Created</span><b>{t.created ?? 0}</b></div>
      <div className={`a-tile ${t.failed ? 'warn' : ''}`}><span>Failed</span><b>{t.failed ?? 0}</b></div>
      <div className="a-tile"><span>Skipped (no change)</span><b>{t.skipped ?? 0}</b></div>
    </div>
  );
}

export function ImportDetails({ job }) {
  const { toast } = useStore();
  return (
    <>
      <Totals job={job} />
      {job.error && <p className="a-error">{job.error}</p>}
      <Issues title={`${plural(job.totals?.failed, 'row')} to fix: ${job.status === 'committed' ? 'not applied' : 'will be skipped'}`} list={job.errors} tone="err" total={job.errorsTotal} />
      <Issues title={`${plural(job.totals?.warnings ?? job.warnings?.length, 'note')}: nothing to fix`} list={job.warnings} tone="warn" total={job.totals?.warnings} />
      {job.changes?.length > 0 && (
        <details className="a-issues" open={job.status === 'previewed'}>
          <summary>{job.status === 'committed' ? 'Changes applied' : 'Changes to apply'} ({(job.changesTotal ?? job.changes.length).toLocaleString()} order{(job.changesTotal ?? job.changes.length) === 1 ? '' : 's'})</summary>
          <div className="a-table-wrap a-scroll">
            <table className="a-table a-compact">
              <thead><tr><th>Row</th><th>Order ID</th><th>Column</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                {job.changes.flatMap((c) =>
                  c.diffs.map((d, i) => (
                    <tr key={`${c.orderNumber}-${i}`}>
                      <td>{i === 0 ? c.row : ''}</td>
                      <td>{i === 0 ? <b>{c.orderNumber}</b> : ''}</td>
                      <td>{d.field}</td>
                      <td className="a-before">{d.from || <i className="a-muted">empty</i>}</td>
                      <td className="a-after">{d.to || <i className="a-muted">empty</i>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {job.changesTotal > job.changes.length && <p className="a-muted">Showing the first {job.changes.length.toLocaleString()} orders. The full list is in the report.</p>}
        </details>
      )}
      <button className="a-btn" onClick={() => downloadFile(`/orders/imports/${job.id}/report`).catch((e) => toast(e.message, 'warn'))}>Download full report (.xlsx)</button>
    </>
  );
}

// Upload → Validate → Preview → Confirm → Result
export function ImportModal({ onClose, onDone }) {
  const { toast } = useStore();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  function choose(f) {
    setError('');
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return setError('Choose an Excel workbook (.xlsx). In Google Sheets use File → Download → Microsoft Excel (.xlsx).');
    if (f.size > 4 * 1024 * 1024) return setError('That file is larger than 4 MB. Split it into smaller files.');
    setFile(f);
  }

  async function validate() {
    setBusy(true);
    setError('');
    setStep(1);
    setProgress(0);
    try {
      const j = await uploadFile(file, setProgress, '/orders/import/preview');
      setJob(j);
      setStep(2);
    } catch (e) {
      setError(e.message);
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError('');
    setStep(3);
    try {
      const j = await api(`/orders/imports/${job.id}/commit`, { method: 'POST' });
      setJob(j);
      setStep(4);
      toast(`${j.totals.updated} order${j.totals.updated === 1 ? '' : 's'} updated from Excel`);
      onDone?.();
    } catch (e) {
      setError(e.message);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (job?.status === 'previewed') await api(`/orders/imports/${job.id}/cancel`, { method: 'POST' }).catch(() => {});
    onClose();
  }

  const willUpdate = job?.changesTotal || 0;
  return (
    <Modal title="Upload Excel" onClose={busy ? undefined : cancel} wide>
      <Steps at={step} />
      {step <= 1 && (
        <div
          className={`a-drop ${file ? 'has-file' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files?.[0]);
          }}
        >
          <p><b>{file ? file.name : 'Drop an .xlsx file here'}</b>{file && <small className="a-muted"> · {(file.size / 1024).toFixed(0)} KB</small>}</p>
          <p className="a-muted">Easiest: <b>Export Excel</b>, change the gold columns, save, upload. Or <b>Download Template</b> and add one row per order: its Order ID plus only what changes. One order or thousands.</p>
          <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="a-actions">
            <button className="a-btn" disabled={busy} onClick={() => input.current?.click()}>{file ? 'Choose another file' : 'Choose file'}</button>
            <button className="a-btn a-primary" disabled={!file || busy} onClick={validate}>{busy ? (progress < 100 ? `Uploading… ${progress}%` : 'Validating…') : 'Validate'}</button>
          </div>
          {busy && <span className="a-progress"><span style={{ width: `${progress < 100 ? progress : 100}%` }} className={progress >= 100 ? 'is-indeterminate' : ''} /></span>}
        </div>
      )}
      {error && <p className="a-error" role="alert">{error}</p>}

      {job && step >= 2 && (
        <>
          {step === 4 ? (
            <div className={`a-banner ${job.totals.failed ? 'warn' : 'ok'}`}>
              <b>Import complete.</b> {job.totals.updated} order{job.totals.updated === 1 ? '' : 's'} updated
              {job.totals.failed ? `, ${job.totals.failed} row${job.totals.failed === 1 ? '' : 's'} not applied` : ''}. The changes are live on the order list, dashboard, reports and customers' tracking pages.
            </div>
          ) : willUpdate === 0 ? (
            <div className="a-banner warn"><b>Nothing to update yet.</b> {job.totals.failed ? 'Correct the rows listed below in your file, save it, and choose “Upload a different file”.' : 'Every row already matches what is saved, so there is nothing to change.'}</div>
          ) : (
            <div className={`a-banner ${job.totals.failed ? 'warn' : 'ok'}`}>
              <b>Ready to update {willUpdate.toLocaleString()} order{willUpdate === 1 ? '' : 's'}.</b>{' '}
              {job.totals.failed ? `${plural(job.totals.failed, 'row')} with problems will be skipped; you can fix and upload them later. ` : 'No problems found. '}
              Nothing is saved until you confirm.
            </div>
          )}
          <ImportDetails job={job} />
          <footer className="a-modal-foot">
            {step < 4 ? (
              <>
                <button className="a-btn" disabled={busy} onClick={cancel}>Cancel</button>
                <button className="a-btn" disabled={busy} onClick={() => { setJob(null); setFile(null); setStep(0); }}>Upload a different file</button>
                <button className="a-btn a-primary" disabled={busy || willUpdate === 0} onClick={confirm}>
                  {busy ? 'Applying…' : `Confirm and update ${willUpdate.toLocaleString()} order${willUpdate === 1 ? '' : 's'}`}
                </button>
              </>
            ) : (
              <>
                <Link to="/admin/orders/imports" className="a-btn" onClick={onClose}>Import history</Link>
                <button className="a-btn a-primary" onClick={onClose}>Done</button>
              </>
            )}
          </footer>
        </>
      )}
    </Modal>
  );
}

export function ImportHistory() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/orders/imports?limit=100').then(setList).catch((e) => { setError(e.message); setList([]); });
  }, []);
  async function show(id) {
    try {
      setOpen(await api(`/orders/imports/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div>
      <header className="a-head">
        <h1>Import history</h1>
        <Link to="/admin/orders" className="a-btn"><Icon name="arrow-left" size={16} /> Orders</Link>
      </header>
      <section className="a-panel">
        {error && <p className="a-error">{error}</p>}
        {!list ? <p>Loading…</p> : list.length === 0 ? <p className="a-muted">No Excel imports yet.</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>When</th><th>Admin</th><th>File</th><th>Total</th><th>Updated</th><th>Created</th><th>Failed</th><th>Skipped</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((j) => (
                  <tr key={j.id}>
                    <td>{when(j.committedAt || j.createdAt)}</td>
                    <td>{j.admin?.name}<br /><small>{j.admin?.email}</small></td>
                    <td>{j.fileName}</td>
                    <td>{j.totals.rows}</td>
                    <td>{j.totals.updated}</td>
                    <td>{j.totals.created}</td>
                    <td className={j.totals.failed ? 'a-warn' : ''}>{j.totals.failed}</td>
                    <td>{j.totals.skipped}</td>
                    <td><span className={`a-pill ${STATUS_TONE[j.status] || ''}`}>{j.status}</span></td>
                    <td><button className="a-link" onClick={() => show(j.id)}>Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <Modal title={`${open.fileName} · ${open.status}`} onClose={() => setOpen(null)} wide>
          <p className="a-muted">Uploaded {when(open.createdAt)} by {open.admin?.name}{open.committedAt && ` · applied ${when(open.committedAt)}`}</p>
          <ImportDetails job={open} />
        </Modal>
      )}
    </div>
  );
}

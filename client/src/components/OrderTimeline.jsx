import { formatDate } from '../lib/format';
import { useStore } from '../context/StoreContext';

// One step of a journey. `warn` marks a delay or a return (amber).
export function Lamp({ lit, current, cancelled, warn, label, date }) {
  return (
    <div className={`lamp ${lit ? 'is-lit' : ''} ${current ? 'is-now' : ''} ${cancelled ? 'is-cancelled' : ''} ${warn ? 'is-warn' : ''}`} aria-current={current ? 'step' : undefined}>
      <span className="lamp-flame">
        {cancelled ? (
          <svg viewBox="0 0 30 30" aria-hidden="true"><path d="M9 9l12 12M21 9L9 21" fill="none" strokeWidth="1.8" /></svg>
        ) : (
          <svg viewBox="0 0 30 30" aria-hidden="true">
            <path d="M15 3c4 6 6 9 0 16-6-7-4-10 0-16z" />
            <path d="M5 21c4 5 16 5 20 0" fill="none" strokeWidth="1.4" />
          </svg>
        )}
      </span>
      <b>{label}</b>
      <small>{date || '—'}</small>
    </div>
  );
}

// The order's journey from the server's own status and history: every step
// reached is lit with its date, the current one glows. A cancelled order
// shows the steps it reached, then "Cancelled".
export default function OrderTimeline({ status, stages, history = [] }) {
  const { t } = useStore();
  const dateFor = (s) => {
    const h = history.filter((x) => x.status === s).pop();
    return h ? formatDate(h.at) : null;
  };
  const cancelled = status === 'Cancelled';
  const reached = cancelled
    ? Math.max(0, ...history.map((h) => stages.indexOf(h.status)).filter((i) => i >= 0))
    : stages.indexOf(status);
  const shown = cancelled ? stages.slice(0, reached + 1) : stages;
  const count = shown.length + (cancelled ? 1 : 0);
  return (
    <div className="lamps" style={{ '--lamp-count': count }} role="list" aria-label={t('Order status')}>
      {shown.map((s, i) => (
        <div role="listitem" key={s} className="lamp-cell">
          <Lamp label={t(s)} lit={i <= reached} current={!cancelled && i === reached} date={i <= reached ? dateFor(s) : null} />
        </div>
      ))}
      {cancelled && (
        <div role="listitem" className="lamp-cell">
          <Lamp label={t('Cancelled')} cancelled current date={dateFor('Cancelled')} />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { CUSTOMER_STATUS, shipTone, ago, dateTime, dayOnly } from '../lib/shipment';
import { formatDate } from '../lib/format';
import { Lamp } from './OrderTimeline';
import Icon from './Icon';

// The six lamps of a parcel's journey, and how far a status has come.
const STEPS = ['Order confirmed', 'Shipment created', 'Picked up', 'In transit', 'Out for delivery', 'Delivered'];
const REACHED = { pending: 0, created: 1, awb_assigned: 1, picked_up: 2, in_transit: 3, out_for_delivery: 4, delivered: 5 };
const SHOWN_UPDATES = 4;

// Delhivery tracking for one of the customer's orders: the journey, the
// latest scan, the AWB and every update. Tracking refreshes on the server
// (scan push and polling); "Refresh" asks the server, never Delhivery.
export default function ShipmentTracking({ order, onRefreshed }) {
  const { t, lang } = useStore();
  const s = order.shipment;
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(!!order.trackingUnavailable);
  const [copied, setCopied] = useState(false);
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  const status = s.status;
  const events = s.events || [];
  const first = (st) => [...events].reverse().find((e) => st.includes(e.status))?.at;

  // How far along the lamps are. A delay or a return keeps the steps already
  // reached and marks the next one amber; a cancelled shipment ends in red.
  const progressOf = () => {
    if (status in REACHED) return REACHED[status];
    if (s.outForDeliveryAt) return 4;
    if (s.pickedUpAt) return first(['in_transit']) ? 3 : 2;
    return s.awb ? 1 : 0;
  };
  const reached = progressOf();
  const warnAt = status === 'exception' ? Math.min(reached + 1, 5) : null;
  const returning = status === 'rto' || status === 'returned';
  const cancelled = status === 'cancelled';
  const confirmedAt = order.history?.find((h) => h.status === 'Confirmed')?.at || order.createdAt;
  const dates = [confirmedAt, first(['created', 'awb_assigned']), s.pickedUpAt, first(['in_transit']), s.outForDeliveryAt, s.deliveredAt];
  const lamps = STEPS.map((label, i) => ({ label, date: i <= reached && dates[i] ? formatDate(dates[i]) : null }));
  if (returning) lamps[5] = { label: status === 'returned' ? 'Returned' : 'Returning to us', date: s.returnedAt ? formatDate(s.returnedAt) : null };
  const shownLamps = cancelled ? lamps.slice(0, reached + 1) : lamps;

  const latest = events[0];
  const delayed = s.delayed || status === 'exception';
  const showEta = s.expectedDelivery && !['delivered', 'returned', 'cancelled', 'rto'].includes(status);

  async function refresh() {
    setBusy(true);
    try {
      const r = await api(`/orders/${encodeURIComponent(order.orderNumber)}/tracking`);
      setUnavailable(!!r.trackingUnavailable);
      onRefreshed?.();
    } catch {
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(s.awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the number stays visible to copy by hand */
    }
  }

  const headline = {
    pending: t('Your order is confirmed and being packed. The tracking number appears here as soon as Delhivery has your parcel.'),
    exception: t('Delhivery could not complete the delivery as planned. They will try again; if anything is needed from you, we will message you on WhatsApp.'),
    rto: t('The parcel could not be delivered and is on its way back to us. We will contact you to arrange a new delivery or a refund.'),
    returned: t('The parcel has come back to us. We will contact you to arrange a new delivery or a refund.'),
    cancelled: t('This shipment was cancelled.'),
  }[status];

  return (
    <section className="od-card ship-card" aria-labelledby="ship-title">
      <div className="od-card-head">
        <h2 id="ship-title" className="od-title">{t("Your parcel's journey")}</h2>
        <span className={`status-pill ${shipTone(status)}`}>{t(CUSTOMER_STATUS[status] || status)}</span>
      </div>

      <div className="lamps" style={{ '--lamp-count': shownLamps.length + (cancelled ? 1 : 0) }} role="list" aria-label={t("Your parcel's journey")}>
        {shownLamps.map((l, i) => {
          const isWarn = i === warnAt || (returning && i === 5);
          return (
            <div role="listitem" key={l.label} className="lamp-cell">
              <Lamp label={t(l.label)} lit={i <= reached && !isWarn} warn={isWarn} current={!cancelled && (isWarn || (warnAt === null && !returning && i === reached))} date={l.date} />
            </div>
          );
        })}
        {cancelled && (
          <div role="listitem" className="lamp-cell"><Lamp label={t('Cancelled')} cancelled current date={null} /></div>
        )}
      </div>

      {unavailable && (
        <p className="ship-notice" role="status">
          <Icon name="alert" size={16} />
          {t('Live tracking is taking a moment. Below is the last update we have; try Refresh in a few minutes.')}
        </p>
      )}

      <div className="ship-grid">
        <div className="ship-now">
          <p className="eyebrow">{t('Latest update')}</p>
          <p className="ship-headline">{t(CUSTOMER_STATUS[status] || status)}</p>
          {headline ? (
            <p className="ship-text">{headline}</p>
          ) : latest ? (
            <p className="ship-text">
              {latest.note}
              <small>{[latest.location, ago(latest.at, t, locale)].filter(Boolean).join(' · ')}</small>
            </p>
          ) : null}
          {status === 'delivered' && s.deliveredAt && <p className="ship-text">{t('Delivered on {date}', { date: dateTime(s.deliveredAt, locale) })}</p>}
          {showEta && (
            <p className={`ship-eta${delayed ? ' is-late' : ''}`}>
              <span>{t(delayed ? 'Was expected' : 'Expected delivery')}</span>
              <b>{dayOnly(s.expectedDelivery, locale)}</b>
            </p>
          )}
        </div>

        {s.awb && (
          <div className="ship-facts">
            <dl>
              <dt>{t('Courier')}</dt><dd>{s.carrier}</dd>
              <dt>{t('Tracking number')}</dt>
              <dd>
                <span dir="ltr" className="ship-awb">{s.awb}</span>
                <button type="button" className="ship-copy" onClick={copy} aria-label={t('Copy tracking number')} title={t(copied ? 'Copied' : 'Copy')}>
                  <Icon name={copied ? 'check' : 'copy'} size={16} />
                </button>
                {copied && <span className="sr-only" role="status">{t('Copied')}</span>}
              </dd>
              {s.pickedUpAt && <><dt>{t('Picked up')}</dt><dd>{dateTime(s.pickedUpAt, locale)}</dd></>}
              {s.lastUpdate && <><dt>{t('Last updated')}</dt><dd>{ago(s.lastUpdate, t, locale)}</dd></>}
            </dl>
            <div className="btn-row">
              {s.trackingUrl && (
                <a className="btn btn-primary" href={s.trackingUrl} target="_blank" rel="noreferrer">
                  {t('Track shipment')} <Icon name="external" size={16} />
                </a>
              )}
              {!['delivered', 'returned', 'cancelled'].includes(status) && (
                <button type="button" className="btn btn-ghost" onClick={refresh} disabled={busy}>
                  <Icon name="refresh" size={16} /> {t(busy ? 'Checking…' : 'Refresh')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {events.length > 0 && (
        <div className="ship-updates">
          <h3 className="od-title">{t('Every update')}</h3>
          <ol>
            {(all ? events : events.slice(0, SHOWN_UPDATES)).map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <time dateTime={e.at}>{dateTime(e.at, locale)}</time>
                <span className="ship-dot" aria-hidden="true" />
                <div>
                  <b>{t(CUSTOMER_STATUS[e.status] || e.label || '')}</b>
                  {(e.note || e.location) && <p>{[e.note, e.location].filter(Boolean).join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ol>
          {events.length > SHOWN_UPDATES && (
            <button type="button" className="text-btn" onClick={() => setAll((x) => !x)} aria-expanded={all}>
              {all ? t('Show fewer') : t('Show all {n} updates', { n: events.length })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { Reveal, SplitHeading } from './Motion';

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';

// Gold stars; partial stars are clipped, so 4.5 shows four and a half.
export function Stars({ value = 0, size = 14, label }) {
  const { t } = useStore();
  const uid = useId().replace(/:/g, '');
  return (
    <span className="stars" role="img" aria-label={label || t('{n} out of 5 stars', { n: value })}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <path d={STAR} className="star-empty" />
            {fill > 0 && (
              <>
                <clipPath id={`${uid}-${i}`}><rect width={24 * fill} height="24" /></clipPath>
                <path d={STAR} className="star-full" clipPath={`url(#${uid}-${i})`} />
              </>
            )}
          </svg>
        );
      })}
    </span>
  );
}

// Summary shown under the product name, only when real reviews exist.
export function RatingSummary({ summary }) {
  const { t } = useStore();
  if (!summary?.count) return null;
  return (
    <a href="#reviews" className="rating-summary">
      <Stars value={summary.average} />
      <span>{summary.average.toFixed(1)}</span>
      <span className="rating-count">{t(summary.count === 1 ? '{n} verified review' : '{n} verified reviews', { n: summary.count })}</span>
    </a>
  );
}

// Reviews come only from delivered orders and are approved by the house.
// Until there are any, the section says so plainly.
export default function Reviews({ data, name }) {
  const { t } = useStore();
  const items = data?.items || [];
  return (
    <section className="section reviews" id="reviews" aria-labelledby="reviews-title">
      <div className="container">
        <div className="reviews-head">
          <div>
            <p className="eyebrow">{t('Verified reviews')}</p>
            <SplitHeading as="h2" text={t('In their words')} className="display-l" />
          </div>
          {data?.count > 0 && (
            <div className="reviews-score">
              <b>{data.average.toFixed(1)}</b>
              <Stars value={data.average} size={18} />
              <span>{t(data.count === 1 ? '{n} verified review' : '{n} verified reviews', { n: data.count })}</span>
            </div>
          )}
        </div>

        {items.length ? (
          <ul className="review-list">
            {items.map((r, i) => (
              <Reveal as="li" key={r._id} delay={Math.min(i, 3) * 0.08} className="review">
                <Stars value={r.rating} />
                {r.title && <h3>{r.title}</h3>}
                <p className="review-body">{r.body}</p>
                <p className="review-by">
                  <b>{r.name}</b>
                  {r.city && <span>{r.city}</span>}
                  <span className="review-verified">{t('Verified buyer')}</span>
                  <time dateTime={r.createdAt}>{formatDate(r.createdAt)}</time>
                </p>
                {r.reply && (
                  <div className="review-reply">
                    <p className="eyebrow">{t('From the house')}</p>
                    <p>{r.reply}</p>
                  </div>
                )}
              </Reveal>
            ))}
          </ul>
        ) : (
          <div className="reviews-empty">
            <p>{t('{name} has no reviews yet. Every review here comes from a delivered order and is read by the house before it appears.', { name })}</p>
            <Link to="/track" className="text-link">{t('Bought it? Review it from your order')}</Link>
          </div>
        )}
      </div>
    </section>
  );
}

// On the Track page: one form per delivered fragrance not yet reviewed.
export function ReviewForm({ trackingId, email, item, onDone }) {
  const { t } = useStore();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState({ busy: false, error: '', done: '' });

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setState({ busy: false, error: t('Please choose a rating.'), done: '' });
    setState({ busy: true, error: '', done: '' });
    try {
      const res = await api('/reviews', { method: 'POST', body: { trackingId, email, slug: item.slug, rating, title, body } });
      setState({ busy: false, error: '', done: res.message });
      onDone?.(item.slug);
    } catch (err) {
      setState({ busy: false, error: err.message, done: '' });
    }
  }

  if (state.done) return <p className="form-ok review-done" role="status">{state.done}</p>;
  return (
    <form className="form review-form" onSubmit={submit}>
      <div className="review-form-head">
        <img src={item.image} alt="" width="56" height="56" />
        <div>
          <p className="eyebrow">{t('Review your fragrance')}</p>
          <h3>{item.name}</h3>
        </div>
      </div>
      <fieldset className="rate">
        <legend>{t('Your rating')}</legend>
        <div className="rate-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} onMouseEnter={() => setHover(n)}>
              <input type="radio" name={`rating-${item.slug}`} value={n} checked={rating === n} onChange={() => setRating(n)} />
              <span className="sr-only">{t('{n} out of 5 stars', { n })}</span>
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d={STAR} className={n <= (hover || rating) ? 'star-full' : 'star-empty'} /></svg>
            </label>
          ))}
        </div>
      </fieldset>
      <label>{t('Headline (optional)')}<input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('In a few words')} /></label>
      <label>{t('Your review')}<textarea required minLength={20} maxLength={1200} rows="5" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('How does it wear on you? When do you reach for it?')} /></label>
      <p className="fine">{t('Only your first name, initial and city are shown. Reviews appear once the house has read them.')}</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="btn btn-primary" disabled={state.busy}>{t(state.busy ? 'Sending…' : 'Submit review')}</button>
    </form>
  );
}

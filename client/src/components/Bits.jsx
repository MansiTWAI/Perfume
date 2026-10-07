import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SplitHeading } from './Motion';
import Img from './Img';
import AutoVideo from './AutoVideo';
import { formatDate } from '../lib/format';
import Icon from './Icon';

export function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="accordion">
      {items.filter((i) => i && i[1]).map(([title, body], i) => (
        <div key={title} className={`acc-item ${open === i ? 'is-open' : ''}`}>
          <button className="acc-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{title}</span>
            <span className="acc-icon" aria-hidden="true" />
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div className="acc-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
                <div className="acc-inner">{typeof body === 'string' ? <p>{body}</p> : body}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// Page opening. "full" lays copy over a darkened full-bleed image or film;
// "split" sets the copy beside an arched photograph that is unveiled on load.
export function PageHero({ eyebrow, title, lede, image, video, poster, alt = '', layout = 'full', fit, children }) {
  const media = video ? (
    <AutoVideo src={video} poster={poster} label={alt} />
  ) : image ? (
    <Img src={image} alt={alt} sizes={layout === 'split' ? '(max-width: 860px) 100vw, 40vw' : '100vw'} eager />
  ) : null;
  const copy = (
    <div className="page-hero-copy">
      {eyebrow && <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>{eyebrow}</motion.p>}
      <SplitHeading as="h1" text={title} delay={0.15} />
      {lede && <motion.p className="lede" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>{lede}</motion.p>}
      {children}
    </div>
  );
  if (layout === 'split' && media) {
    return (
      <section className="page-hero page-hero-split">
        <div className="container page-hero-grid">
          {copy}
          <motion.figure
            className={`page-hero-arch ${fit === 'contain' ? 'is-contain' : ''}`}
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 1.5, delay: 0.2, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.div initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 2.2, delay: 0.2, ease: [0.2, 0.7, 0.2, 1] }}>
              {media}
            </motion.div>
          </motion.figure>
        </div>
      </section>
    );
  }
  return (
    <section className={`page-hero ${media ? 'has-image' : ''}`}>
      {media && (
        <motion.div className="page-hero-img" initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.8, ease: [0.2, 0.7, 0.2, 1] }}>
          {media}
        </motion.div>
      )}
      <div className="container page-hero-inner">{copy}</div>
    </section>
  );
}

export function Lightbox({ items, index, onClose, onIndex }) {
  useEffect(() => {
    if (index == null) return;
    const on = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [index, items.length, onClose, onIndex]);
  return (
    <AnimatePresence>
      {index != null && (
        <motion.div className="lightbox" role="dialog" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <AnimatePresence mode="wait">
            <motion.figure key={index} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <img src={items[index].src} alt={items[index].alt} />
              <figcaption>{items[index].caption || items[index].alt}</figcaption>
            </motion.figure>
          </AnimatePresence>
          <button className="lb-nav lb-prev" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length); }} aria-label="Previous"><Icon name="arrow-left" className="flip-rtl" /></button>
          <button className="lb-nav lb-next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }} aria-label="Next"><Icon name="arrow-right" className="flip-rtl" /></button>
          <button className="lb-close icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PostCard({ post, large, index = 0 }) {
  return (
    <motion.article
      className={`postcard ${large ? 'postcard-lg' : ''}`}
      lang="en"
      dir="ltr"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Link to={`/journal/${post.slug}`} className="postcard-link">
        <div className="postcard-img">
          {post.cover?.src && <img src={post.cover.src} alt={post.cover.alt || ''} loading="lazy" />}
        </div>
        <div className="postcard-body">
          <p className="eyebrow">{post.category} · {post.readingMinutes} min read</p>
          <h3>{post.title}</h3>
          {post.excerpt && <p className="postcard-ex">{post.excerpt}</p>}
          <p className="postcard-date">{formatDate(post.publishedAt)}</p>
        </div>
      </Link>
    </motion.article>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

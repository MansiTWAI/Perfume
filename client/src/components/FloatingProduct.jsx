import { useEffect, useRef } from 'react';
import { cx } from '../lib/format';
import { renderSrcSet } from '../lib/renders';

const canTilt = () => {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// A product render suspended in its scene: a slow float, a contact shadow
// that breathes with it, a faint reflection, and on desktop a tilt toward the
// pointer with a light sweep that follows it across the glass.
//
// `track` lets a larger element (a whole card) drive the tilt.
export default function FloatingProduct({
  render,
  alt,
  className,
  sizes = '(max-width: 800px) 60vw, 30vw',
  eager = false,
  tilt = true,
  reflect = true,
  track,
  strength = 1,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const area = track?.current || el;
    if (!el || !area || !tilt || !canTilt()) return;
    let frame = 0;
    const set = (rx, ry, gx) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--rx', `${rx}deg`);
        el.style.setProperty('--ry', `${ry}deg`);
        el.style.setProperty('--gx', `${gx}%`);
      });
    };
    const move = (e) => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.classList.add('is-tilting');
      set(-y * 7 * strength, x * 10 * strength, 50 + x * 90);
    };
    const leave = () => {
      el.classList.remove('is-tilting');
      set(0, 0, 50);
    };
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerleave', leave);
    };
  }, [tilt, track, strength]);

  if (!render) return null;
  const img = {
    src: render.src,
    srcSet: renderSrcSet(render),
    sizes,
    width: render.w,
    height: render.h,
    decoding: 'async',
    loading: eager ? 'eager' : 'lazy',
    draggable: false,
  };

  return (
    <div ref={ref} className={cx('fp', className)} style={{ '--ar': `${render.w} / ${render.h}`, '--arn': render.w / render.h, '--mask': `url(${render.src})` }}>
      <span className="fp-glow" aria-hidden="true" />
      <span className="fp-shadow" aria-hidden="true" />
      <div className="fp-float">
        <div className="fp-obj">
          <img className="fp-img" alt={alt} {...img} fetchpriority={eager ? 'high' : undefined} />
          <span className="fp-sheen" aria-hidden="true" />
          {reflect && <img className="fp-reflect" alt="" aria-hidden="true" {...img} loading="lazy" />}
        </div>
      </div>
    </div>
  );
}

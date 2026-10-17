import { useEffect, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext';

// A gold foil over an offer: the shopper scratches it (finger, pen or mouse)
// to see the code underneath. Once about half is cleared, the rest falls away.
// "Reveal" does the same for keyboard and screen-reader users. Revealed codes
// are remembered on this device, so the card stays open.
const KEY = 'ab_scratched';
const read = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
};
export const isScratched = (code) => read().has(code);
function remember(code) {
  try {
    const s = read();
    s.add(code);
    localStorage.setItem(KEY, JSON.stringify([...s].slice(-50)));
  } catch {
    /* storage unavailable: it opens for this visit only */
  }
}

export default function ScratchCover({ code, onReveal }) {
  const { t } = useStore();
  const canvas = useRef(null);
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);
  const drawing = useRef(false);
  const last = useRef(null);
  const moves = useRef(0);

  // Paint the foil to fit the card (and again if the card changes size).
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const paint = () => {
      const { width, height } = c.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grad = g.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#8a6424');
      grad.addColorStop(0.35, '#d7c3a0');
      grad.addColorStop(0.55, '#b8955a');
      grad.addColorStop(1, '#7a5a20');
      g.fillStyle = grad;
      g.fillRect(0, 0, width, height);
      // Fine diagonal grain, like a printed foil.
      g.globalAlpha = 0.12;
      g.strokeStyle = '#fff';
      for (let x = -height; x < width; x += 6) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + height, height);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#2b080c';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '500 11px Jost, system-ui, sans-serif';
      g.fillText(t('SCRATCH TO REVEAL').split('').join(' '), width / 2, height / 2 - 12);
      g.font = '400 22px "Bodoni Moda", Georgia, serif';
      g.fillText(t('A gift is waiting for you'), width / 2, height / 2 + 12);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [t]);

  function finish() {
    if (fading) return;
    setFading(true);
    remember(code);
    onReveal?.();
    setTimeout(() => setGone(true), 450);
  }

  // How much foil is left, sampled on a coarse grid.
  function cleared() {
    const c = canvas.current;
    const g = c.getContext('2d');
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let clear = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 24) {
      n++;
      if (data[i] < 40) clear++;
    }
    return n ? clear / n : 0;
  }

  function scratch(e) {
    if (!drawing.current || fading) return;
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = 34;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    const from = last.current || { x, y };
    g.moveTo(from.x, from.y);
    g.lineTo(x, y);
    g.stroke();
    last.current = { x, y };
    if (++moves.current % 6 === 0 && cleared() > 0.45) finish();
  }

  if (gone) return null;
  return (
    <div className={`scratch-cover${fading ? ' is-gone' : ''}`}>
      <canvas
        ref={canvas}
        aria-hidden="true"
        onPointerDown={(e) => { drawing.current = true; last.current = null; e.currentTarget.setPointerCapture?.(e.pointerId); scratch(e); }}
        onPointerMove={scratch}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      <button type="button" className="scratch-reveal" onClick={finish}>{t('Reveal')}</button>
    </div>
  );
}

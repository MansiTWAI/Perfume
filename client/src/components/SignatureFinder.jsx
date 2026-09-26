import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { stopScroll } from './SmoothScroll';

const Q = [
  { q: 'When will you wear it most?', o: [['Daytime, work and family lunches', 'Light, polished, close to the skin', -1], ['Evenings, dinners and occasions', 'Something people notice', 1], ['Both, depending on the day', 'A little of each', 0]] },
  { q: 'Which room draws you in?', o: [['A sunlit courtyard with jasmine and marble', 'Ivory, warm light, open air', -1], ['A candlelit majlis with velvet and dark wood', 'Low light, gold, depth', 1]] },
  { q: 'The celebration you are dressing for', o: [['Nikah, Eid morning or a haldi', 'Bright, graceful, first light', -1], ['Sangeet, a reception or an Eid night out', 'Dramatic, late and memorable', 1], ['An everyday ritual, just for me', 'Your own signature', 0]] },
  { q: 'Which notes call to you?', o: [['Jasmine, rose and amber', 'Floral warmth', -1], ['Saffron, incense and oud', 'Smoke and spice', 1]] },
];

const R = {
  elarisse: { name: 'ELARISSE', img: '/media/elarisse-campaign.webp', copy: 'A fragrance beyond time. Luminous saffron, jasmine and amber for days that should feel effortless.' },
  zafreon: { name: 'ZAFREON', img: '/media/zafreon-campaign.webp', copy: 'A bold fragrance, a higher story. Saffron, incense and oud for evenings you want remembered.' },
  'signature-duo': { name: 'SIGNATURE DUO', img: '/media/duo-triptych.webp', copy: 'You live in both worlds. Wear ELARISSE by day and ZAFREON by night.' },
};

export default function SignatureFinder() {
  const { finderOpen, setFinderOpen } = useStore();
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState([]);
  const score = ans.reduce((a, b) => a + b, 0);
  const done = step >= Q.length;
  const result = score <= -2 ? 'elarisse' : score >= 2 ? 'zafreon' : 'signature-duo';

  useEffect(() => {
    stopScroll(finderOpen);
    if (finderOpen) {
      setStep(0);
      setAns([]);
    }
    const onKey = (e) => e.key === 'Escape' && setFinderOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [finderOpen, setFinderOpen]);

  const pick = (v) => {
    setAns((a) => [...a.slice(0, step), v]);
    setStep((s) => s + 1);
  };

  const lean = score < 0 ? 'elarisse' : score > 0 ? 'zafreon' : null;
  const bg = done ? R[result].img : lean ? R[lean].img : '/media/duo-triptych.webp';

  return (
    <AnimatePresence>
      {finderOpen && (
        <motion.div className="finder" role="dialog" aria-modal="true" aria-label="Find your signature" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent>
          <AnimatePresence mode="popLayout">
            <motion.img key={bg} src={bg} alt="" className="finder-bg" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 0.35, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} />
          </AnimatePresence>
          <button className="finder-close icon-btn" onClick={() => setFinderOpen(false)} aria-label="Close">✕</button>
          <div className="finder-inner">
            <div className="finder-progress">
              {Q.map((_, i) => <i key={i} className={i < ans.length ? 'on' : ''} />)}
            </div>
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.45 }}>
                  <p className="eyebrow">Find your signature · {step + 1} of {Q.length}</p>
                  <h2>{Q[step].q}</h2>
                  <div className="finder-opts">
                    {Q[step].o.map(([t, s, v], i) => (
                      <button key={t} className="finder-opt" onClick={() => pick(v)}>
                        <span className="k">{String.fromCharCode(97 + i)}</span>
                        <span>{t}<small>{s}</small></span>
                      </button>
                    ))}
                  </div>
                  {step > 0 && <button className="link-quiet" onClick={() => { setStep(step - 1); setAns(ans.slice(0, step - 1)); }}>← Back</button>}
                </motion.div>
              ) : (
                <motion.div key="result" className="finder-result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                  <p className="eyebrow">Your signature is</p>
                  <h2 className="finder-name">{R[result].name}</h2>
                  <p className="lede">{R[result].copy}</p>
                  <div className="btn-row">
                    <Link to={`/fragrances/${result}`} className="btn btn-primary" onClick={() => setFinderOpen(false)}>Discover {R[result].name}</Link>
                    <button className="btn btn-ghost" onClick={() => { setStep(0); setAns([]); }}>Start again</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

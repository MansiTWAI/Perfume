import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { renderFor } from '../lib/renders';
import FloatingProduct from './FloatingProduct';
import { stopScroll } from './SmoothScroll';

// Each answer leans toward ELARISSE (-1), ZAFREON (+1) or neither (0).
const Q = {
  en: [
    { q: 'When will you wear it most?', o: [['Daytime, work and family lunches', 'Light, polished, close to the skin', -1], ['Evenings, dinners and occasions', 'Something people notice', 1], ['Both, depending on the day', 'A little of each', 0]] },
    { q: 'Which room draws you in?', o: [['A sunlit courtyard with jasmine and marble', 'Ivory, warm light, open air', -1], ['A candlelit majlis with velvet and dark wood', 'Low light, gold, depth', 1]] },
    { q: 'The celebration you are dressing for', o: [['Nikah, Eid morning or a haldi', 'Bright, graceful, first light', -1], ['Sangeet, a reception or an Eid night out', 'Dramatic, late and memorable', 1], ['An everyday ritual, just for me', 'Your own signature', 0]] },
    { q: 'Which notes call to you?', o: [['Jasmine, rose and amber', 'Floral warmth', -1], ['Saffron, incense and oud', 'Smoke and spice', 1]] },
  ],
  ar: [
    { q: 'متى سترتديه غالباً؟', o: [['في النهار، للعمل وغداء العائلة', 'خفيف وأنيق وقريب من البشرة', -1], ['في الأمسيات والعشاء والمناسبات', 'حضور يلفت الانتباه', 1], ['الاثنان، حسب اليوم', 'قليل من كلٍّ منهما', 0]] },
    { q: 'أيّ مكان يجذبك؟', o: [['فناء مشمس بالياسمين والرخام', 'عاج وضوء دافئ وهواء طلق', -1], ['مجلس على ضوء الشموع بالمخمل والخشب الداكن', 'ضوء خافت وذهب وعمق', 1]] },
    { q: 'المناسبة التي تستعد لها', o: [['عقد قران أو صباح العيد', 'مشرق ورشيق كأول الضوء', -1], ['حفل زفاف أو استقبال أو ليلة العيد', 'درامي ومتأخر ولا يُنسى', 1], ['طقس يومي، لي وحدي', 'توقيعك الخاص', 0]] },
    { q: 'أيّ النفحات تناديك؟', o: [['الياسمين والورد والعنبر', 'دفء زهري', -1], ['الزعفران والبخور والعود', 'دخان وتوابل', 1]] },
  ],
};

const R = {
  en: {
    elarisse: 'A fragrance beyond time. Luminous saffron, jasmine and amber for days that should feel effortless.',
    zafreon: 'A bold fragrance, a higher story. Saffron, incense and oud for evenings you want remembered.',
    'signature-duo': 'You live in both worlds. Wear ELARISSE by day and ZAFREON by night.',
  },
  ar: {
    elarisse: 'عطر يتجاوز الزمن. زعفران وياسمين وعنبر مضيء لأيام تبدو فيها الأناقة بلا عناء.',
    zafreon: 'عطر جريء، حكاية أسمى. زعفران وبخور وعود لأمسيات تريد أن تُذكر.',
    'signature-duo': 'تعيش في العالمين معاً. ارتدِ ELARISSE نهاراً وZAFREON ليلاً.',
  },
};
const NAME = { elarisse: 'ELARISSE', zafreon: 'ZAFREON', 'signature-duo': 'SIGNATURE DUO' };

export default function SignatureFinder() {
  const { finderOpen, setFinderOpen, lang, t } = useStore();
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState([]);
  const questions = Q[lang] || Q.en;
  const score = ans.reduce((a, b) => a + b, 0);
  const done = step >= questions.length;
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

  // The bottle on stage follows the answers: the leaning fragrance, or both.
  const lean = done ? result : score < 0 ? 'elarisse' : score > 0 ? 'zafreon' : 'signature-duo';
  const render = renderFor(lean);

  return (
    <AnimatePresence>
      {finderOpen && (
        <motion.div className="finder" role="dialog" aria-modal="true" aria-label={t('Find your signature')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-lenis-prevent>
          <button className="finder-close icon-btn" onClick={() => setFinderOpen(false)} aria-label={t('Dismiss')}>✕</button>
          <div className="finder-layout">
            <div className="finder-stage" aria-hidden="true">
              <AnimatePresence mode="wait">
                <motion.div
                  key={lean}
                  className="finder-bottle"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
                >
                  {render && <FloatingProduct render={render} alt="" tilt={false} className={lean === 'signature-duo' ? 'fp-plinth' : undefined} reflect={lean !== 'signature-duo'} sizes="(max-width: 860px) 40vw, 30vw" />}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="finder-inner">
              <div className="finder-progress">
                {questions.map((_, i) => <i key={i} className={i < ans.length ? 'on' : ''} />)}
              </div>
              <AnimatePresence mode="wait">
                {!done ? (
                  <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.45 }}>
                    <p className="eyebrow">{t('Find your signature')} · <span dir="ltr">{step + 1} / {questions.length}</span></p>
                    <h2>{questions[step].q}</h2>
                    <div className="finder-opts">
                      {questions[step].o.map(([label, sub, v], i) => (
                        <button key={label} className="finder-opt" onClick={() => pick(v)}>
                          <span className="k" dir="ltr">{String.fromCharCode(97 + i)}</span>
                          <span>{label}<small>{sub}</small></span>
                        </button>
                      ))}
                    </div>
                    {step > 0 && <button className="link-quiet" onClick={() => { setStep(step - 1); setAns(ans.slice(0, step - 1)); }}>{t('Back')}</button>}
                  </motion.div>
                ) : (
                  <motion.div key="result" className="finder-result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    <p className="eyebrow">{t('Your signature is')}</p>
                    <h2 className="finder-name">{NAME[result]}</h2>
                    <p className="lede">{(R[lang] || R.en)[result]}</p>
                    <div className="btn-row">
                      <Link to={`/fragrances/${result}`} className="btn btn-primary" onClick={() => setFinderOpen(false)}>{t('Discover {name}', { name: NAME[result] })}</Link>
                      <button className="btn btn-ghost" onClick={() => { setStep(0); setAns([]); }}>{t('Start again')}</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

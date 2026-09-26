import { Fragment, useRef } from 'react';
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';

const EASE = [0.2, 0.7, 0.2, 1];

// Fades and lifts content in as it enters the viewport.
export function Reveal({ children, delay = 0, y = 32, as = 'div', className, ...rest }) {
  const M = motion[as] || motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </M>
  );
}

// Splits a heading into words that rise out of a mask one after another.
export function SplitHeading({ text, as = 'h2', className, delay = 0 }) {
  const M = motion[as];
  const words = String(text).split(' ');
  return (
    <M className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -8% 0px' }} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="split-mask" aria-hidden="true">
            <motion.span
              className="split-word"
              variants={{ hidden: { y: '110%' }, show: { y: '0%', transition: { duration: 0.9, delay: delay + i * 0.06, ease: EASE } } }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </M>
  );
}

// Each word brightens as the paragraph scrolls through the viewport.
export function ScrollText({ text, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className={className} aria-label={text} style={{ position: 'relative' }}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>
      ))}
    </p>
  );
}

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0.18, 1]);
  return (
    <motion.span style={{ opacity }} aria-hidden="true">{children} </motion.span>
  );
}

// Image that drifts slightly slower than the page.
export function Parallax({ children, strength = 60, className }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength]);
  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden', position: 'relative' }}>
      <motion.div style={{ y, height: '100%' }}>{children}</motion.div>
    </div>
  );
}

// Button that leans toward the pointer.
export function Magnetic({ children, strength = 0.35 }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15 });
  const sy = useSpring(y, { stiffness: 200, damping: 15 });
  function move(e) {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  }
  function leave() {
    x.set(0);
    y.set(0);
  }
  return (
    <motion.span ref={ref} className="magnetic" style={{ x: sx, y: sy }} onMouseMove={move} onMouseLeave={leave}>
      {children}
    </motion.span>
  );
}

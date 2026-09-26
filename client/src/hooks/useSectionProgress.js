import { useEffect } from 'react';
import { useMotionValue } from 'framer-motion';

// 0 when the section's top reaches the top of the viewport, 1 when its bottom
// reaches the bottom. Measured directly so it is correct from the first frame,
// including after route transitions.
export function useSectionProgress(ref) {
  const progress = useMotionValue(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - innerHeight;
      progress.set(span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 0);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    return () => {
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
      cancelAnimationFrame(raf);
    };
  }, [ref, progress]);
  return progress;
}

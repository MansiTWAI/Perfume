import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const BottleScene = lazy(() => import('./three/BottleScene'));

function canRender3D() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// Real-time bottle with a photographic fallback. The photograph shows first,
// then the 3D scene fades in once it is ready. Rendering pauses off-screen.
export default function BottleStage({ variant, progress, interactive, stage, fallback, className = '' }) {
  const ref = useRef(null);
  const [enabled] = useState(canRender3D);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);

  return (
    <div ref={ref} className={`bottle-stage ${ready ? 'is-ready' : ''} ${className}`}>
      {!enabled && fallback && <img className="bottle-fallback" src={fallback.src} alt={fallback.alt} />}
      {enabled && (
        <div className="bottle-canvas" aria-hidden={!interactive} role={interactive ? 'img' : undefined} aria-label={interactive ? `${variant} bottle, drag to turn` : undefined}>
          <Suspense fallback={null}>
            <BottleScene variant={variant} progress={progress} interactive={interactive} stage={stage} active={visible} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

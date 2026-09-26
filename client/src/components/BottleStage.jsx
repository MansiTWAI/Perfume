import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';

const BottleScene = lazy(() => import('./three/BottleScene'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const prefersCalm = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// If WebGL fails at runtime (driver, blocked context), show the photograph.
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('3D scene unavailable, showing the photograph instead.', error?.message);
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Real-time bottle with a photographic fallback. Visitors who prefer reduced
// motion still get the 3D bottle, held still apart from their own scrolling.
// Rendering pauses whenever the stage is off-screen.
export default function BottleStage({ variant, progress, interactive, stage, fallback, className = '' }) {
  const ref = useRef(null);
  const [enabled, setEnabled] = useState(hasWebGL);
  const [calm] = useState(prefersCalm);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);

  return (
    <div ref={ref} className={`bottle-stage ${ready ? 'is-ready' : ''} ${className}`}>
      {(!enabled || !ready) && fallback && !stage && <img className="bottle-fallback" src={fallback.src} alt={fallback.alt} />}
      {!enabled && fallback && stage && <img className="bottle-fallback" src={fallback.src} alt={fallback.alt} />}
      {enabled && (
        <div className="bottle-canvas" aria-hidden={!interactive} role={interactive ? 'img' : undefined} aria-label={interactive ? `${variant} bottle, drag to turn` : undefined}>
          <SceneBoundary onFail={() => setEnabled(false)}>
            <Suspense fallback={null}>
              <BottleScene variant={variant} progress={progress} interactive={interactive} stage={stage} calm={calm} active={visible} onReady={() => setReady(true)} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}

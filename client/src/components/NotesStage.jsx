import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cx } from '../lib/format';

const NotesScene = lazy(() => import('./three/NotesScene'));

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

// If WebGL fails at runtime the notes simply don't appear; the bottle stays.
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.warn('3D notes unavailable.', error?.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// A transparent layer of 3D fragrance notes to sit behind (side="back") or in
// front of (side="front") a product render. The 3D code loads in its own
// chunk, and rendering pauses whenever the layer is off-screen.
export default function NotesStage({ className, ...scene }) {
  const ref = useRef(null);
  const [enabled] = useState(hasWebGL);
  const [calm] = useState(prefersCalm);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div ref={ref} className={cx('notes-stage', ready && 'is-ready', className)} aria-hidden="true">
      <SceneBoundary>
        <Suspense fallback={null}>
          <NotesScene {...scene} calm={calm} active={visible} onReady={() => setReady(true)} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}

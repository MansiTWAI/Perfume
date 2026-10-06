import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cx } from '../lib/format';

const NotesScene = lazy(() => import('./three/NotesScene'));

// The notes are decoration: phones that would struggle, and anyone saving
// data, get the bottle alone.
function lowPower() {
  try {
    if (navigator.connection?.saveData) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    return touch && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
  } catch {
    return false;
  }
}

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
  const [enabled] = useState(() => !lowPower() && hasWebGL());
  const [calm] = useState(prefersCalm);
  const [visible, setVisible] = useState(false);
  // The 3D code (a large download) is fetched only once the layer nears the screen.
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setSeen(true);
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={ref}
      className={cx('pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[1400ms] [&_canvas]:outline-none', ready && 'opacity-100', className)}
      aria-hidden="true"
    >
      {seen && (
        <SceneBoundary>
          <Suspense fallback={null}>
            <NotesScene {...scene} calm={calm} active={visible} onReady={() => setReady(true)} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';

// Muted, looping background film. React does not reliably set the `muted`
// attribute, which browsers require for autoplay, so it is set here directly.
// Playback pauses while the film is off-screen to save battery.
export default function AutoVideo({ src, poster, className, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} />;
}

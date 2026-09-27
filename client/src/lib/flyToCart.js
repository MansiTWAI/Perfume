// A small copy of the bottle drifts toward the bag icon when something is
// added. Skipped for reduced motion or when either element is missing.
export function flyToCart(sourceEl) {
  const bag = document.getElementById('bag-button');
  if (!sourceEl || !bag || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const from = sourceEl.getBoundingClientRect();
  const to = bag.getBoundingClientRect();
  if (!from.width) return;
  const ghost = sourceEl.cloneNode(false);
  const size = Math.min(from.width, from.height, 160);
  // Cut-out renders fly as the bottle itself, not a round thumbnail.
  const cutout = sourceEl.classList.contains('fp-img');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2 - size / 2}px`,
    top: `${from.top + from.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: cutout ? 'contain' : 'cover',
    borderRadius: cutout ? '0' : '50%',
    zIndex: 999,
    pointerEvents: 'none',
    boxShadow: cutout ? 'none' : '0 20px 40px rgba(0,0,0,.35)',
  });
  ghost.removeAttribute('srcset');
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 0.95 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(0.55)`, opacity: 0.9, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12)`, opacity: 0.2 },
    ],
    { duration: 900, easing: 'cubic-bezier(.6,0,.2,1)' }
  );
  anim.onfinish = () => {
    ghost.remove();
    bag.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
  };
}

import { forwardRef } from 'react';
import { srcSet } from '../lib/format';

// Responsive image: serves the 800px file to phones when one exists.
const Img = forwardRef(function Img({ src, alt = '', sizes = '(max-width: 800px) 100vw, 50vw', eager, ...rest }, ref) {
  if (!src) return <span ref={ref} className={`img-empty ${rest.className || ''}`} style={rest.style} aria-hidden="true" />;
  return (
    <img
      ref={ref}
      src={src}
      srcSet={srcSet(src)}
      sizes={srcSet(src) ? sizes : undefined}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...rest}
    />
  );
});

// A small product picture (bag, search, checkout). A product saved without a
// photo shows the house emblem instead of a broken image.
export function Thumb({ src, width, height, className = '', ...rest }) {
  if (!src) return <span className={`img-empty ${className}`} style={{ width, height }} aria-hidden="true" />;
  return <img src={src} alt="" width={width} height={height} className={className} {...rest} />;
}

export default Img;

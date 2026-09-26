import { forwardRef } from 'react';
import { srcSet } from '../lib/format';

// Responsive image: serves the 800px file to phones when one exists.
const Img = forwardRef(function Img({ src, alt = '', sizes = '(max-width: 800px) 100vw, 50vw', eager, ...rest }, ref) {
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

export default Img;

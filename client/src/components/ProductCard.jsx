import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { flyToCart } from '../lib/flyToCart';
import Img from './Img';

export default function ProductCard({ product, index = 0, className = '', sizes = '(max-width: 800px) 90vw, 40vw' }) {
  const { priceOf, fmt, addToCart, toast, t } = useStore();
  const imgRef = useRef(null);
  const [a, b] = product.images || [];
  const soldOut = product.stock <= 0;

  const add = () => {
    flyToCart(imgRef.current);
    addToCart(product);
    toast(t('{name} added to your bag', { name: product.name }));
  };

  return (
    <motion.article
      className={`pcard ${className}`}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 1.1, delay: index * 0.1, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <Link to={`/fragrances/${product.slug}`} className="pcard-media" aria-label={`${product.name}, ${product.subtitle}`}>
        {a && <Img ref={imgRef} src={a.src} alt={a.alt} className="pcard-img" sizes={sizes} />}
        {b && <Img src={b.src} alt="" className="pcard-img pcard-img-2" sizes={sizes} aria-hidden="true" />}
      </Link>
      <div className="pcard-body">
        <div className="pcard-title">
          <h3><Link to={`/fragrances/${product.slug}`}>{product.name}</Link></h3>
          <p>{product.family} · <span dir="ltr">{product.sizeLabel.replace(' / 3.4 FL.OZ.', '')}</span></p>
        </div>
        <div className="pcard-buy">
          <span className="pcard-price">{fmt(priceOf(product))}</span>
          <button className="pcard-add" disabled={soldOut} onClick={add}>
            {t(soldOut ? 'Sold out' : 'Add to bag')}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

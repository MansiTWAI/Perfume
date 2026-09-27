import { useState } from 'react';
import Seo, { breadcrumbLd } from '../components/Seo';
import { PageHero, Loading } from '../components/Bits';
import ProductCard from '../components/ProductCard';
import { Reveal } from '../components/Motion';
import { useProducts } from '../hooks/useProducts';
import { useStore } from '../context/StoreContext';

export default function Collection() {
  const { products, loading } = useProducts();
  const { setFinderOpen, t } = useStore();
  const [picked, setFamily] = useState('All');
  // Filters come from the product data itself, never a fixed list.
  const families = ['All', ...new Set((products || []).map((p) => p.family).filter(Boolean))];
  // Family names change with the language; an unknown one means All.
  const family = families.includes(picked) ? picked : 'All';
  const list = (products || []).filter((p) => family === 'All' || p.family === family);

  return (
    <>
      <Seo
        title="Premium Eau de Parfum Collection | AL BARAKAH LIFESTYLE"
        description="Discover the AL BARAKAH LIFESTYLE collection of premium Eau de Parfum: ELARISSE, ZAFREON and the Signature Duo gift set. Delivered across India and to the UAE."
        jsonLd={[
          breadcrumbLd([['Home', '/'], ['Fragrances', '/fragrances']]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: (products || []).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${window.location.origin}/fragrances/${p.slug}`, name: p.name })),
          },
        ]}
      />
      <PageHero eyebrow={t('The collection')} title={t('Eau de Parfum')} image="/media/duo-triptych.webp" lede={t('Each fragrance has its own personality, and every presentation has a purpose.')} />
      <section className="section collection-page">
        <div className="container">
          <div className="filter-row">
            <div className="chips" role="group" aria-label={t('Filter by fragrance family')}>
              {families.map((c) => (
                <button key={c} className="chip" aria-pressed={family === c} onClick={() => setFamily(c)}>{c === 'All' ? t('All') : c}</button>
              ))}
            </div>
            <button className="text-link" onClick={() => setFinderOpen(true)}>{t('Not sure? Take the four-question guide')}</button>
          </div>
          {loading ? <Loading /> : (
            <div className="product-grid">
              {list.map((p, i) => <ProductCard key={p._id || p.slug} product={p} index={i} />)}
            </div>
          )}
          <Reveal className="collection-note">
            <p className="eyebrow">{t('Next from the house')}</p>
            <p>{t('The collection will continue into oud, amber, musk and woods, and later into beauty and lifestyle. Join the Journal letter to hear first.')}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

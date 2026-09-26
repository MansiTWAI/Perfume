import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE = 'AL BARAKAH LIFESTYLE';

export default function Seo({ title, description, image = '/media/duo-triptych-800.webp', type = 'website', jsonLd }) {
  const { pathname } = useLocation();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = origin + pathname;
  const full = title?.includes(SITE) ? title : title ? `${title} | ${SITE}` : `Luxury Perfume & Fragrance House in India | ${SITE}`;
  const ld = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return (
    <Helmet>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content={SITE} />
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={origin + image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={origin + image} />
      {ld.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}

export const orgLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE,
  url: window.location.origin,
  logo: window.location.origin + '/media/emblem.webp',
  slogan: 'leave your signature',
  email: 'you@albarakah.me',
  telephone: '+91 91112 79997',
  address: { '@type': 'PostalAddress', streetAddress: 'Plot Number 61, Friends Colony, Jalpally', addressLocality: 'Hyderabad', addressRegion: 'Telangana', addressCountry: 'IN' },
});

export const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: window.location.origin + path })),
});

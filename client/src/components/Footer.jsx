import { Link } from 'react-router-dom';
import { CONTACT, mapLink, whatsappLink } from '../lib/format';
import { useStore } from '../context/StoreContext';
import Newsletter from './Newsletter';

const COLUMNS = [
  ['Shop', [['/fragrances', 'All fragrances'], ['/fragrances/elarisse', 'ELARISSE'], ['/fragrances/zafreon', 'ZAFREON'], ['/fragrances/signature-duo', 'Signature Duo']]],
  ['The House', [['/about-us', 'About Us'], ['/our-story', 'Our Story'], ['/mission-vision', 'Mission & Vision'], ['/fragrance-heritage', 'Heritage'], ['/journal', 'Journal'], ['/gallery', 'Gallery']]],
  ['Care', [['/contact', 'Contact'], ['/faq', 'FAQ'], ['/shipping-policy', 'Shipping Policy'], ['/refund-policy', 'Refund & Cancellation'], ['/track', 'Track an order']]],
];
// Product names are the same in every language.
const NAMES = new Set(['ELARISSE', 'ZAFREON', 'Signature Duo']);

export default function Footer() {
  const { t } = useStore();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <p className="footer-statement">
            {t('A contemporary fragrance house from Hyderabad,')} <em>{t('shaped by Indian richness and Middle Eastern artistry.')}</em>
          </p>
          <div className="footer-news">
            <p className="eyebrow">{t('The Journal, by letter')}</p>
            <Newsletter source="footer" />
          </div>
        </div>

        <div className="footer-grid">
          {COLUMNS.map(([title, links]) => (
            <nav key={title} aria-label={t(title)}>
              <p className="footer-h">{t(title)}</p>
              <ul>
                {links.map(([to, label]) => (
                  <li key={to}><Link to={to}>{NAMES.has(label) ? label : t(label)}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <p className="footer-h">{t('Visit & write')}</p>
            <address>
              <a href={mapLink} target="_blank" rel="noreferrer">{CONTACT.address}</a>
              <a href={`tel:+${CONTACT.phoneRaw}`} dir="ltr">{CONTACT.phone}</a>
              <a href={whatsappLink(t('Hello Al Barakah'))} target="_blank" rel="noreferrer">{t('WhatsApp')}</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </address>
          </div>
        </div>

        <div className="footer-sign">
          <img src="/media/emblem.webp" alt="AL BARAKAH LIFESTYLE" width="96" height="100" loading="lazy" className="emblem-tile" />
          <p className="footer-tagline" lang="en">leave your signature</p>
        </div>

        <div className="footer-base">
          <p>© {new Date().getFullYear()} AL BARAKAH LIFESTYLE · {t('Fragrances · Beauty · Lifestyle')}</p>
          <p>
            <Link to="/privacy-policy">{t('Privacy')}</Link>
            <Link to="/terms">{t('Terms')}</Link>
            <Link to="/shipping-policy">{t('Shipping')}</Link>
            <Link to="/refund-policy">{t('Refunds')}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

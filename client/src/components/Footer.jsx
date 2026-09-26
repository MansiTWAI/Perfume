import { Link } from 'react-router-dom';
import { CONTACT, mapLink, whatsappLink } from '../lib/format';
import Newsletter from './Newsletter';

const COLUMNS = [
  ['Shop', [['/fragrances', 'All fragrances'], ['/fragrances/elarisse', 'ELARISSE'], ['/fragrances/zafreon', 'ZAFREON'], ['/fragrances/signature-duo', 'Signature Duo']]],
  ['The House', [['/our-story', 'Our Story'], ['/mission-vision', 'Mission & Vision'], ['/fragrance-heritage', 'Heritage'], ['/journal', 'Journal'], ['/gallery', 'Gallery']]],
  ['Care', [['/contact', 'Contact'], ['/faq', 'FAQ'], ['/shipping-returns', 'Shipping & Returns'], ['/track', 'Track an order']]],
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <p className="footer-statement">
            A contemporary fragrance house from Hyderabad, <em>shaped by Indian richness and Middle Eastern artistry.</em>
          </p>
          <div className="footer-news">
            <p className="eyebrow">The Journal, by letter</p>
            <Newsletter source="footer" />
          </div>
        </div>

        <div className="footer-grid">
          {COLUMNS.map(([title, links]) => (
            <nav key={title} aria-label={title}>
              <p className="footer-h">{title}</p>
              <ul>
                {links.map(([to, label]) => (
                  <li key={to}><Link to={to}>{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <p className="footer-h">Visit &amp; write</p>
            <address>
              <a href={mapLink} target="_blank" rel="noreferrer">{CONTACT.address}</a>
              <a href={`tel:+${CONTACT.phoneRaw}`}>{CONTACT.phone}</a>
              <a href={whatsappLink('Hello Al Barakah')} target="_blank" rel="noreferrer">WhatsApp</a>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </address>
          </div>
        </div>

        <div className="footer-sign">
          <img src="/media/emblem.webp" alt="AL BARAKAH LIFESTYLE" width="96" height="100" loading="lazy" className="emblem-tile" />
          <p className="footer-tagline">leave your signature</p>
        </div>

        <div className="footer-base">
          <p>© {new Date().getFullYear()} AL BARAKAH LIFESTYLE · Fragrances · Beauty · Lifestyle</p>
          <p>
            <Link to="/privacy-policy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

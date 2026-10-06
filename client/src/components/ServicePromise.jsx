import { useStore } from '../context/StoreContext';
import { Reveal } from './Motion';

const ICON = {
  delivery: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7zM6.5 18.5a1.5 1.5 0 1 0 0-.01M17.5 18.5a1.5 1.5 0 1 0 0-.01" />,
  pay: <path d="M3 7h18v10H3zM3 10.5h18M7 14.5h4" />,
  gift: <path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1" />,
  chat: <path d="M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5" />,
};

// The house's service promises, stated for the visitor's own market, as a
// row of four (two on tablets, one on phones). Every
// line here is something the site actually does; nothing is decorative.
export default function ServicePromise() {
  const { region, fmt, t } = useStore();
  const rule = region.ships ? region.shipping : null;
  const cod = region.payments?.includes('cod');

  const items = [
    region.ships
      ? { icon: 'delivery', title: t('Delivered across {country}', { country: t(region.code === 'AE' ? 'the UAE' : region.name) }), text: rule ? t('Complimentary over {amount}', { amount: fmt(rule.freeOver) }) : '' }
      : { icon: 'delivery', title: t('Gulf delivery on request'), text: t('Arranged personally on WhatsApp.') },
    cod
      ? { icon: 'pay', title: t('Cash on delivery'), text: t('Pay when your order arrives.') }
      : { icon: 'pay', title: t('Secure payment link'), text: t('We confirm your order first, then send a secure link.') },
    { icon: 'gift', title: t('The Signature Card'), text: t('A complimentary printed gift note, in your words.') },
    { icon: 'chat', title: t('A personal concierge'), text: t('Fragrance advice from the house on WhatsApp.') },
  ];

  return (
    <ul className="mx-auto grid max-w-[calc(var(--max)_-_2*var(--gutter))] list-none grid-cols-1 gap-x-10 gap-y-12 p-0 text-center sm:grid-cols-2 lg:grid-cols-4" aria-label={t('Our promise')}>
      {items.map((it, i) => (
        <Reveal
          as="li"
          key={it.icon}
          delay={i * 0.08}
          className="grid content-start justify-items-center gap-2.5"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" className="mb-1.5 text-gold-soft">{ICON[it.icon]}</svg>
          <h3 className="font-display text-[clamp(19px,1.5vw,22px)] leading-tight">{it.title}</h3>
          {it.text && <p className="text-[14.5px] leading-relaxed text-mute">{it.text}</p>}
        </Reveal>
      ))}
    </ul>
  );
}

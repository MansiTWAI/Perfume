import { useStore } from '../context/StoreContext';
import { Reveal } from './Motion';
import Icon from './Icon';

const ICON = { delivery: 'truck', pay: 'card', gift: 'gift', chat: 'chat' };

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
          <Icon name={ICON[it.icon]} size={24} className="mb-1.5 text-gold-soft" />
          <h3 className="font-display text-[clamp(19px,1.5vw,22px)] leading-tight">{it.title}</h3>
          {it.text && <p className="text-[14px] leading-relaxed text-mute">{it.text}</p>}
        </Reveal>
      ))}
    </ul>
  );
}

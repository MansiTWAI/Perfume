// Store policies the concierge may quote, condensed from the published policy
// pages (client/src/pages/InfoPages.jsx, updated 03 October 2026). Delivery
// charges and payment methods come live from config/commerce.js. When a
// policy page changes, update the matching entry here.
import { REGIONS, paymentsFor } from '../../config/commerce.js';

export const CONTACT = { whatsapp: '+91 91112 79997', whatsappLink: 'https://wa.me/919111279997', email: 'you@albarakah.me', hours: 'We usually reply on WhatsApp within working hours (IST).' };

const PAY_NAMES = { cod: 'cash on delivery', 'pay-on-confirmation': 'pay on confirmation (we confirm by WhatsApp or email and send a secure payment link)', online: 'pay online now with Razorpay (UPI, cards, netbanking, wallets)' };

function delivery() {
  return REGIONS.map((r) =>
    r.ships
      ? `${r.name}: delivered. Prices ${r.taxLabel}. Delivery ${r.currency} ${r.shipping.flat}, free on orders of ${r.currency} ${r.shipping.freeOver} or more.`
      : `${r.name}: not delivered online yet; order by WhatsApp enquiry (prices shown are estimates).`
  ).join('\n');
}

export const POLICY_TOPICS = ['shipping', 'returns', 'payment', 'tracking', 'gifting', 'contact', 'order_changes'];

export function policy(topic) {
  switch (topic) {
    case 'shipping':
      return { page: '/shipping-policy', facts: [delivery(), 'Orders are processed after payment confirmation; launches, holidays and busy periods can take longer.', 'Delivery estimates are shown at checkout or with the order and are estimates, not guarantees.', 'Perfume contains alcohol, so some destinations or carriers may restrict shipping.', 'International orders may carry customs duties and import taxes paid by the customer.'] };
    case 'returns':
      return { page: '/refund-policy', facts: ['Cancel before dispatch: contact us quickly; if not yet handed to the courier we try to cancel and refund.', 'Opened, sprayed or used perfume is generally not returnable for change of mind (hygiene).', 'Damaged, wrong or defective items: contact us promptly with the order number and photos/video of the packaging and product.', 'Unopened returns, where offered, must be unused, sealed and complete; get return instructions first.', 'Approved refunds go back to the original payment method, subject to bank/provider timelines.', `Requests: email ${CONTACT.email} or WhatsApp ${CONTACT.whatsapp} with the order number.`] };
    case 'payment':
      return { page: '/checkout', facts: REGIONS.filter((r) => r.ships).map((r) => `${r.name}: ${paymentsFor(r).map((p) => PAY_NAMES[p] || p).join('; ')}.`) };
    case 'tracking':
      return { page: '/track', facts: ['Track any order on the Track Order page with the tracking ID (starts with ABL) and the email used at checkout.', 'Signed-in customers see all their orders under My orders.', 'Courier tracking events may not update continuously.'] };
    case 'gifting':
      return { page: '/checkout', facts: ['A complimentary printed Signature Card (gift note with recipient name, occasion and message) can be added at checkout and is placed in the box.'] };
    case 'order_changes':
      return { page: '/profile/orders', facts: ['Signed-in customers can change the delivery address or gift card until the order ships, and quantities until it is packed (unpaid orders only), from My orders.', 'Orders can be cancelled from My orders until they ship; paid orders are refunded.'] };
    case 'contact':
    default:
      return { page: '/contact', facts: [`WhatsApp / phone: ${CONTACT.whatsapp}`, `Email: ${CONTACT.email}`, CONTACT.hours] };
  }
}

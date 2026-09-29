// Couriers the admin can pick for an order. The tracking link the customer
// sees is built from the courier and the tracking (AWB) number, so nobody has
// to paste URLs. Used by the admin screen, the Excel import and the server.
//
// `url` has {n} where the tracking number goes. Where a courier has no public
// deep link, `url` is its tracking page and the customer enters the number
// shown next to it. Check these against your courier accounts; "Other" lets
// you type any link.
export const COURIERS = [
  // India
  { name: 'Delhivery', region: 'IN', url: 'https://www.delhivery.com/track-v2/package/{n}' },
  { name: 'Blue Dart', region: 'IN', url: 'https://www.bluedart.com/web/guest/trackdartresultthirdparty?trackFor=0&trackNo={n}' },
  { name: 'DTDC', region: 'IN', url: 'https://www.dtdc.in/tracking.asp' },
  { name: 'India Post (Speed Post)', region: 'IN', url: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx' },
  { name: 'Shiprocket', region: 'IN', url: 'https://shiprocket.co/tracking/{n}' },
  { name: 'Xpressbees', region: 'IN', url: 'https://www.xpressbees.com/shipment/tracking?awbNo={n}' },
  { name: 'Ekart', region: 'IN', url: 'https://ekartlogistics.com/shipmenttrack/{n}' },
  { name: 'Ecom Express', region: 'IN', url: 'https://www.ecomexpress.in/tracking/?awb_field={n}' },
  // UAE and international
  { name: 'Aramex', region: 'AE', url: 'https://www.aramex.com/us/en/track/results?ShipmentNumber={n}' },
  { name: 'Emirates Post', region: 'AE', url: 'https://www.emiratespost.ae/all-services/track-a-package' },
  { name: 'DHL Express', region: 'AE', url: 'https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}' },
  { name: 'FedEx', region: 'AE', url: 'https://www.fedex.com/fedextrack/?trknbr={n}' },
  // Handed over in person (Hyderabad) — no tracking link.
  { name: 'Hand delivery', region: '', url: '' },
];

export const courierByName = (name) => COURIERS.find((c) => c.name.toLowerCase() === String(name || '').trim().toLowerCase());

// Tracking link for a known courier and number; '' when it cannot be built.
export function trackingUrl(courier, number) {
  const c = courierByName(courier);
  if (!c?.url) return '';
  const n = String(number || '').trim();
  if (c.url.includes('{n}')) return n ? c.url.replace('{n}', encodeURIComponent(n)) : '';
  return c.url;
}

export const isUrl = (s) => /^https?:\/\/\S+\.\S+/i.test(String(s || '').trim());

// Ready-made notes for the customer's tracking page, by status.
export const STATUS_NOTES = {
  'Order Placed': ['We have received your order.'],
  Confirmed: ['Your order is confirmed. We are preparing it.', 'Payment received, thank you. We are preparing your order.', 'Confirmed on WhatsApp. We are preparing your order.'],
  Packed: ['Packed and gift-wrapped, ready for the courier.', 'Packed with your Signature Card.'],
  Shipped: ['Handed to the courier. Your tracking number is on your order page.', 'Dispatched from Hyderabad.'],
  'Out for Delivery': ['Out for delivery today.', 'Arriving today. Please keep your phone nearby.'],
  Delivered: ['Delivered. Thank you for choosing AL BARAKAH LIFESTYLE.', 'Delivered. We would love to hear what you think.'],
  Cancelled: ['Cancelled at your request.', 'Cancelled: this fragrance is out of stock. We will be in touch about a refund or an alternative.', 'Cancelled: we could not confirm the order. Please contact us on WhatsApp.'],
};

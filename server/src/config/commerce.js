// Markets, currencies and delivery rules.
//
// Only India and the UAE are confirmed delivery markets (see the brand's
// 2030 vision). The other GCC countries are listed so visitors can find
// themselves, but they order by WhatsApp enquiry until logistics are confirmed.
// Shipping amounts are placeholders until the brand confirms its courier rates.
//
// To add a market: add a region here, add its currency to the Product price
// schema, and set prices in the admin.
// Units of a currency per AED, from its rate per US dollar.
function aed(perUsd) {
  return Math.round((perUsd / 3.6725) * 10000) / 10000;
}

export const REGIONS = [
  {
    code: 'IN', name: 'India', currency: 'INR', ships: true,
    taxLabel: 'incl. GST', shipping: { flat: 99, freeOver: 2999 },
    payments: ['cod', 'pay-on-confirmation'],
  },
  {
    code: 'AE', name: 'United Arab Emirates', currency: 'AED', ships: true,
    taxLabel: 'incl. 5% VAT', shipping: { flat: 35, freeOver: 300 },
    payments: ['pay-on-confirmation'],
  },
  // Enquiry markets show an indicative price in their own currency, converted
  // from the AED price. Every GCC currency except the Kuwaiti dinar is pegged
  // to the US dollar, so these rates barely move; the exact amount is
  // confirmed on WhatsApp before the customer pays.
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', ships: false, base: 'AED', fx: aed(3.75) },
  { code: 'QA', name: 'Qatar', currency: 'QAR', ships: false, base: 'AED', fx: aed(3.64) },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', ships: false, base: 'AED', fx: aed(0.307) },
  { code: 'OM', name: 'Oman', currency: 'OMR', ships: false, base: 'AED', fx: aed(0.3845) },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', ships: false, base: 'AED', fx: aed(0.376) },
];

// Currencies products are actually priced and sold in.
export const CURRENCIES = [...new Set(REGIONS.filter((r) => r.ships).map((r) => r.currency))];


export const ORDER_STAGES = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
// Not a step on the timeline: an order can be cancelled from any stage.
export const ORDER_CANCELLED = 'Cancelled';
export const ORDER_STATUSES = [...ORDER_STAGES, ORDER_CANCELLED];

export const regionByCode = (code) => REGIONS.find((r) => r.code === code);

export function shippingFor(region, subtotal) {
  const rule = region?.shipping;
  if (!rule) return 0;
  return subtotal >= rule.freeOver ? 0 : rule.flat;
}

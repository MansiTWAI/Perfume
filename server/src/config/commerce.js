// Markets, currencies and delivery rules.
//
// Only India and the UAE are confirmed delivery markets (see the brand's
// 2030 vision). The other GCC countries are listed so visitors can find
// themselves, but they order by WhatsApp enquiry until logistics are confirmed.
// Shipping amounts are placeholders until the brand confirms its courier rates.
//
// To add a market: add a region here, add its currency to the Product price
// schema, and set prices in the admin.
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
  { code: 'SA', name: 'Saudi Arabia', currency: 'AED', ships: false },
  { code: 'QA', name: 'Qatar', currency: 'AED', ships: false },
  { code: 'KW', name: 'Kuwait', currency: 'AED', ships: false },
  { code: 'OM', name: 'Oman', currency: 'AED', ships: false },
  { code: 'BH', name: 'Bahrain', currency: 'AED', ships: false },
];

export const CURRENCIES = [...new Set(REGIONS.map((r) => r.currency))];

export const ORDER_STAGES = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

export const regionByCode = (code) => REGIONS.find((r) => r.code === code);

export function shippingFor(region, subtotal) {
  const rule = region?.shipping;
  if (!rule) return 0;
  return subtotal >= rule.freeOver ? 0 : rule.flat;
}

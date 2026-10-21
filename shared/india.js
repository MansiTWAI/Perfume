// Indian delivery addresses: the states and union territories the checkout
// offers, and a check for addresses that are plainly outside India (an order
// priced in rupees ships with Delhivery, which delivers within India only).
// Used by the checkout, the admin order form and the server.
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Older and everyday spellings, so "New Delhi" or "Orissa" still count.
const ALIASES = {
  'new delhi': 'Delhi', 'nct of delhi': 'Delhi', 'delhi ncr': 'Delhi', orissa: 'Odisha', pondicherry: 'Puducherry',
  uttaranchal: 'Uttarakhand', 'j&k': 'Jammu and Kashmir', 'jammu & kashmir': 'Jammu and Kashmir', 'andaman & nicobar': 'Andaman and Nicobar Islands',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu', 'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  tamilnadu: 'Tamil Nadu', 'tamil nadu': 'Tamil Nadu', up: 'Uttar Pradesh', mp: 'Madhya Pradesh', ap: 'Andhra Pradesh', wb: 'West Bengal',
  ts: 'Telangana', tg: 'Telangana', ka: 'Karnataka', mh: 'Maharashtra', tn: 'Tamil Nadu', hp: 'Himachal Pradesh',
};
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z&]+/g, ' ').trim();

// The state's proper name, or '' when it is not an Indian state or territory.
export function indianState(value) {
  const k = key(value);
  if (!k) return '';
  return INDIAN_STATES.find((s) => key(s) === k) || ALIASES[k] || '';
}

// Countries and big cities customers of this house come from. Finding one in
// an Indian address means the shopper picked the wrong market. Names that are
// also Indian landmarks (Mecca Masjid, Paris Corner…) are left out.
const FOREIGN = [
  'egypt', 'cairo', 'giza', 'alexandria', 'uae', 'u a e', 'united arab emirates', 'dubai', 'abu dhabi', 'sharjah', 'ajman',
  'ras al khaimah', 'fujairah', 'saudi', 'saudi arabia', 'ksa', 'riyadh', 'jeddah', 'dammam',
  'qatar', 'doha', 'kuwait', 'oman', 'muscat', 'bahrain', 'manama', 'lebanon', 'beirut', 'iraq', 'baghdad', 'iran',
  'tehran', 'istanbul', 'pakistan', 'karachi', 'lahore', 'islamabad', 'bangladesh', 'dhaka', 'nepal', 'kathmandu',
  'sri lanka', 'colombo', 'maldives', 'singapore', 'malaysia', 'kuala lumpur', 'usa', 'u s a', 'united states',
  'new york', 'canada', 'toronto', 'united kingdom', 'australia', 'sydney', 'melbourne', 'germany',
];
const FOREIGN_RX = new RegExp(`(^| )(${FOREIGN.join('|')})( |$)`);

// The foreign place named in an address ('' when there is none).
export function foreignPlace(...parts) {
  const text = ` ${parts.map(key).join(' ')} `.replace(/\s+/g, ' ');
  const m = text.match(FOREIGN_RX);
  return m ? m[2].replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

// 10 digits, starting 6–9, after an optional +91 / 0.
export const indianMobile = (v) => /^[6-9]\d{9}$/.test(String(v || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''));
export const indianPin = (v) => /^[1-9][0-9]{5}$/.test(String(v || '').replace(/\s/g, ''));

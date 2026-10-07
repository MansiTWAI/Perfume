// Shipment statuses as the customer and the team see them. The server sends
// the status key (see server/src/config/commerce.js); wording lives here.

// What the customer reads: plain, reassuring, no courier jargon.
export const CUSTOMER_STATUS = {
  pending: 'Being prepared',
  created: 'Booked with Delhivery',
  awb_assigned: 'Booked with Delhivery',
  picked_up: 'Picked up',
  in_transit: 'On its way to you',
  out_for_delivery: 'Out for delivery today',
  delivered: 'Delivered',
  exception: 'Running a little late',
  rto: 'Returning to us',
  returned: 'Returned to us',
  cancelled: 'Shipment cancelled',
};

// The admin's shorter labels.
export const ADMIN_STATUS = {
  pending: 'Awaiting shipment',
  created: 'Shipment created',
  awb_assigned: 'AWB assigned',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  exception: 'Delayed',
  rto: 'Returning',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

// Colour family for a status pill: active (gold), done (green), warn (amber), cancelled (red).
export function shipTone(status) {
  if (status === 'delivered') return 'is-done';
  if (['exception', 'rto', 'returned'].includes(status)) return 'is-warn';
  if (['cancelled', 'failed'].includes(status)) return 'is-cancelled';
  return 'is-active';
}

// "just now", "12 minutes ago", "3 hours ago", else the date and time.
export function ago(date, t, locale = 'en-GB') {
  if (!date) return '';
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t(mins === 1 ? '1 minute ago' : '{n} minutes ago', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t(hours === 1 ? '1 hour ago' : '{n} hours ago', { n: hours });
  return dateTime(date, locale);
}

export const dateTime = (date, locale = 'en-GB') =>
  new Date(date).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const dayOnly = (date, locale = 'en-GB') =>
  new Date(date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' });

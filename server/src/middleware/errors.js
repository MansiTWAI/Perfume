// Every error response carries a stable, machine-readable `code` next to the
// human-readable `message`: { "code": "OUT_OF_STOCK", "message": "Only 2 of
// ZAFREON left in stock." }. Apps branch on `code` (and translate it); the
// message can be shown as is. Codes are part of the public API: add new ones
// freely, never rename or remove one.
//
// A route may set the code itself (res.status(409).json({ code, message }));
// otherwise it is derived from the status and the message below.

const BY_MESSAGE = [
  // Most specific first: the first match wins.
  [/reset link is invalid|reset link has expired/i, 'RESET_TOKEN_INVALID'],
  [/refresh token/i, 'REFRESH_TOKEN_INVALID'],
  [/left in stock|just sold out|not enough .* in stock|no longer has .* in stock/i, 'OUT_OF_STOCK'],
  [/no longer available|is not available|was not part of this order/i, 'PRODUCT_UNAVAILABLE'],
  [/do not deliver to this country/i, 'REGION_NOT_SUPPORTED'],
  [/your bag is empty|needs at least one fragrance/i, 'CART_EMPTY'],
  [/can hold up to/i, 'CART_FULL'],
  [/not in your bag/i, 'CART_ITEM_NOT_FOUND'],
  [/email and password do not match/i, 'INVALID_CREDENTIALS'],
  [/current password is not correct/i, 'WRONG_PASSWORD'],
  [/already exists|already uses this email|slug or email is already in use/i, 'ALREADY_EXISTS'],
  [/password of at least/i, 'WEAK_PASSWORD'],
  [/valid email/i, 'INVALID_EMAIL'],
  [/valid phone/i, 'INVALID_PHONE'],
  [/please sign in/i, 'AUTH_REQUIRED'],
  [/admin access only/i, 'ADMIN_ONLY'],
  [/could not find this order in your account|order not found|no order matches/i, 'ORDER_NOT_FOUND'],
  [/can no longer be (changed|cancelled here)|already paid, so its items|items can no longer be changed/i, 'ORDER_NOT_EDITABLE'],
  [/already cancelled/i, 'ORDER_ALREADY_CANCELLED'],
  [/already reviewed/i, 'ALREADY_REVIEWED'],
  [/once your order has been delivered/i, 'ORDER_NOT_DELIVERED'],
  [/email is not set up/i, 'EMAIL_NOT_CONFIGURED'],
  [/online payment is not (set up|available)/i, 'PAYMENT_NOT_CONFIGURED'],
  [/payment could not be verified/i, 'PAYMENT_VERIFICATION_FAILED'],
  [/payment provider/i, 'PAYMENT_PROVIDER_ERROR'],
  [/already paid/i, 'ALREADY_PAID'],
  [/preview is more than an hour old/i, 'IMPORT_EXPIRED'],
  [/import (is already|can no longer)/i, 'IMPORT_NOT_PENDING'],
  [/excel|\.xlsx|workbook|order id" column|order rows|blank template|no orders found in this file/i, 'INVALID_SPREADSHEET'],
  [/larger than 4 mb|upload a jpg/i, 'INVALID_UPLOAD'],
  [/cloud storage/i, 'UPLOAD_FAILED'],
  [/too many/i, 'RATE_LIMITED'],
];

const BY_STATUS = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export function codeFor(status, message = '') {
  const hit = BY_MESSAGE.find(([rx]) => rx.test(message));
  return hit ? hit[1] : BY_STATUS[status] || (status >= 500 ? 'SERVER_ERROR' : 'ERROR');
}

// Adds `code` to every JSON error response that does not have one.
export function errorCodes(_req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body) && body.message && !body.code) {
      body = { code: codeFor(res.statusCode, String(body.message)), ...body };
    }
    return json(body);
  };
  next();
}

// Codes that routes always set themselves.
const SET_BY_ROUTES = [
  'COUPON_INVALID', 'COUPON_EXPIRED', 'COUPON_MIN_NOT_MET', 'COUPON_ALREADY_USED',
  'OTP_INVALID', 'OTP_EXPIRED', 'OTP_NOT_CONFIGURED', 'ACCOUNT_NOT_FOUND', 'ACCOUNT_BLOCKED',
  'ADDRESS_NOT_FOUND', 'INVALID_STATUS',
];

export const ERROR_CODES = [...new Set([...BY_MESSAGE.map(([, c]) => c), ...Object.values(BY_STATUS), ...SET_BY_ROUTES, 'ERROR'])].sort();

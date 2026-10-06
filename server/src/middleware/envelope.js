// The app contract (/api/v1): every JSON response has the same shape.
//
//   success:   { "success": true,  "message": "…", "data": … }
//   paginated: { "success": true,  "message": "…", "data": [ … ], "pagination": { page, limit, total, totalPages } }
//   error:     { "success": false, "message": "…", "code": "OUT_OF_STOCK", "errors": [ { field, message } ] }
//
// Routes keep returning their plain objects; this wraps them. The website uses
// /api, which keeps the plain format, so nothing changes for it.
import { codeFor } from './errors.js';

// Responses that must stay exactly as they are (machine formats).
const RAW = [/^\/api\/openapi\.json$/, /^\/api\/payments\/(razorpay\/)?webhook$/];

function defaultMessage(method, status) {
  if (status === 201) return 'Created successfully';
  if (method === 'GET') return 'Fetched successfully';
  if (method === 'DELETE') return 'Deleted successfully';
  return 'Updated successfully';
}

const isPaged = (b) => b && Array.isArray(b.items) && typeof b.total === 'number' && typeof b.page === 'number';

export function envelope(req, res, next) {
  if (!req.apiV1 || RAW.some((rx) => rx.test(req.path))) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    // Database documents: work with their plain JSON form.
    if (body && !Array.isArray(body) && typeof body.toJSON === 'function') body = body.toJSON();
    if (body && typeof body === 'object' && 'success' in body) return json(body); // already shaped
    const status = res.statusCode;
    if (status >= 400) {
      const message = String(body?.message || 'Something went wrong.');
      return json({
        success: false,
        message,
        code: body?.code || codeFor(status, message),
        ...(Array.isArray(body?.errors) && { errors: body.errors }),
      });
    }
    if (Array.isArray(body)) return json({ success: true, message: defaultMessage(req.method, status), data: body });
    if (isPaged(body)) {
      const { items, total, page, pages, limit, message, ...meta } = body;
      return json({
        success: true,
        message: message || defaultMessage(req.method, status),
        data: items,
        pagination: { page, limit, total, totalPages: pages },
        ...(Object.keys(meta).length && { meta }),
      });
    }
    if (body && typeof body === 'object') {
      // { ok: true, message, ...rest } → the message, and rest as the data.
      if (typeof body.message === 'string') {
        const { ok: _ok, message, ...rest } = body;
        return json({ success: true, message, data: Object.keys(rest).length ? rest : null });
      }
      return json({ success: true, message: defaultMessage(req.method, status), data: body });
    }
    return json({ success: true, message: defaultMessage(req.method, status), data: body ?? null });
  };
  next();
}

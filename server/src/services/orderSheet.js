// Orders <-> Excel. The database stays the source of truth: a sheet can only
// change the fields marked `editable`, on orders matched by their Order ID
// (the immutable order number). Items, prices and totals are read-only in
// Excel, because they are tied to stock and to what the customer paid.
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { ORDER_STAGES } from '../config/commerce.js';
import { addTableSheet, addNotesSheet, cellText } from './excel.js';
import { COURIERS, courierByName, trackingUrl, isUrl } from '../../../shared/couriers.js';

export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'];
export const MAX_IMPORT_ROWS = 20000;
const CLEAR = 'CLEAR';

// key, header, width, type, and for editable columns the order path they write.
export const ORDER_COLUMNS = [
  { key: 'orderNumber', header: 'Order ID', width: 14, freeze: true, note: 'Immutable. Used to find the order; never change it.' },
  { key: 'trackingId', header: 'Tracking ID', width: 15 },
  { key: 'createdAt', header: 'Order Date', type: 'datetime', width: 18 },
  { key: 'name', header: 'Customer Name', width: 22, editable: { path: 'customer.name', required: true, max: 120 } },
  { key: 'email', header: 'Email', width: 28, readOnlyCheck: true },
  { key: 'phone', header: 'Phone', width: 17, editable: { path: 'customer.phone', required: true, max: 40, phone: true } },
  { key: 'line1', header: 'Address Line 1', width: 30, editable: { path: 'customer.address.line1', required: true, max: 200 } },
  { key: 'line2', header: 'Address Line 2', width: 22, editable: { path: 'customer.address.line2', max: 200 } },
  { key: 'city', header: 'City', width: 16, editable: { path: 'customer.address.city', required: true, max: 80 } },
  { key: 'state', header: 'State / Emirate', width: 16, editable: { path: 'customer.address.state', max: 80 } },
  { key: 'postalCode', header: 'Postal Code', width: 12, editable: { path: 'customer.address.postalCode', required: true, max: 20 } },
  { key: 'country', header: 'Country', width: 18 },
  { key: 'items', header: 'Items', width: 36, wrap: true },
  { key: 'qty', header: 'Total Qty', type: 'int', width: 10 },
  { key: 'currency', header: 'Currency', width: 10, readOnlyCheck: true },
  { key: 'subtotal', header: 'Subtotal', type: 'money', width: 13 },
  { key: 'shipping', header: 'Shipping', type: 'money', width: 12 },
  { key: 'total', header: 'Total', type: 'money', width: 14, readOnlyCheck: true },
  { key: 'paymentMethod', header: 'Payment Method', width: 20 },
  { key: 'paymentStatus', header: 'Payment Status', width: 15, editable: { path: 'paymentStatus', options: PAYMENT_STATUSES } },
  { key: 'status', header: 'Order Status', width: 17, editable: { path: 'status', options: ORDER_STAGES } },
  { key: 'statusNote', header: 'Status Note', width: 26, editable: { note: true, max: 300 }, note: 'Optional. Saved in the tracking history when the Order Status changes.' },
  { key: 'carrier', header: 'Courier', width: 16, editable: { path: 'carrier', max: 80, courier: true }, note: 'Pick from the list, or type another courier name.' },
  { key: 'trackingNumber', header: 'Tracking Number', width: 18, editable: { path: 'trackingNumber', max: 80 }, note: 'The courier AWB / consignment number. For couriers in the list the customer tracking link is built from it automatically.' },
  { key: 'carrierUrl', header: 'Courier Tracking URL', width: 30, editable: { path: 'carrierUrl', max: 500, url: true }, note: 'Optional. Leave blank: for couriers in the list the link is made from the Tracking Number.' },
  { key: 'eta', header: 'Expected Delivery', width: 18, editable: { path: 'eta', max: 60, eta: true } },
  { key: 'notes', header: 'Internal Notes', width: 30, editable: { path: 'notes', max: 2000 } },
  { key: 'gift', header: 'Signature Card', width: 26, wrap: true },
  { key: 'updatedAt', header: 'Last Updated', type: 'datetime', width: 18 },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BY_HEADER = new Map(ORDER_COLUMNS.map((c) => [norm(c.header), c]));
// Friendly aliases people type in their own sheets.
for (const [alias, key] of [['orderno', 'orderNumber'], ['ordernumber', 'orderNumber'], ['status', 'status'], ['payment', 'paymentStatus'], ['eta', 'eta'], ['carrier', 'carrier'], ['trackingurl', 'carrierUrl'], ['notes', 'notes']]) {
  BY_HEADER.set(alias, ORDER_COLUMNS.find((c) => c.key === key));
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export function orderToRow(o) {
  const c = o.customer || {};
  const a = c.address || {};
  return {
    orderNumber: o.orderNumber,
    trackingId: o.trackingId,
    createdAt: o.createdAt,
    name: c.name,
    email: c.email,
    phone: c.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    items: (o.items || []).map((i) => `${i.name} × ${i.qty}`).join('; '),
    qty: (o.items || []).reduce((s, i) => s + (i.qty || 0), 0),
    currency: o.currency,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    carrierUrl: o.carrierUrl,
    eta: o.eta,
    notes: o.notes,
    gift: o.giftNote?.enabled ? `${o.giftNote.name || ''} · ${o.giftNote.occasion || ''}: ${o.giftNote.message || ''}` : '',
    updatedAt: o.updatedAt,
  };
}

const VALIDATIONS = { status: ORDER_STAGES, paymentStatus: PAYMENT_STATUSES, carrier: COURIERS.map((c) => c.name) };

export function instructions() {
  return [
    'How to update orders with Excel:',
    '1. Export orders (or download this template), edit the gold columns, save as .xlsx, then upload it in Admin → Orders → Upload Excel.',
    '2. You will see a preview of every change and every problem before anything is saved. Nothing changes until you press Confirm.',
    '3. Works for one order or thousands. Remove the rows you did not change if you like; unchanged rows are simply skipped.',
    '',
    'Rules:',
    '• Order ID finds the order. It never changes, and an Order ID can appear only once per file.',
    '• Only the gold columns can be changed: customer name, phone and address, payment status, order status, status note, courier, tracking number, courier tracking URL, expected delivery and internal notes.',
    '• Burgundy columns (items, prices, totals, email, dates) are for reference and are never written back. Change items or prices on the order itself.',
    '• A blank cell leaves the current value as it is. To empty an optional field (e.g. courier), type CLEAR.',
    `• Order Status must be one of: ${ORDER_STAGES.join(', ')}.`,
    `• Payment Status must be one of: ${PAYMENT_STATUSES.join(', ')}.`,
    '• Courier: pick from the drop-down (or type another name). Add the Tracking Number and, for couriers in the list, the customer tracking link is filled in for you. Courier Tracking URL is optional: leave it blank unless you use another courier and have its link (starting with https://). A number typed there is saved as the Tracking Number.',
    '• When the Order Status changes, the customer sees it on their tracking page, with the Status Note if you wrote one.',
    '',
    'New orders:',
    'New orders cannot be created from Excel, because each order must reserve stock and take its prices from the catalogue. Use Add Order (or the checkout) and they will appear in the next export.',
    '',
    'Accepted files: .xlsx from Excel, Google Sheets (File → Download → .xlsx) or LibreOffice (Save as Excel 2007-365). Up to 4 MB and 20,000 rows.',
  ];
}

export function buildOrdersWorkbook(wb, orders, { title, meta, tz }) {
  addTableSheet(wb, 'Orders', { title, meta, columns: ORDER_COLUMNS, rows: orders.map(orderToRow), tz, validations: VALIDATIONS });
  addNotesSheet(wb, 'How to edit', 'Updating orders with Excel', instructions());
  return wb;
}

// The template has no sample row: a sample Order ID that gets uploaded by
// mistake only produces an error. The example lives on the "How to edit" sheet.
// With `orders`, the rows come pre-filled with each order's ID and reference
// details, and every gold (editable) column left blank to fill in.
export function buildTemplate(wb, { orders = [], tz = 0, scope } = {}) {
  const refs = ['orderNumber', 'trackingId', 'createdAt', 'email', 'country', 'items', 'currency', 'total'];
  const rows = orders.map((o) => {
    const full = orderToRow(o);
    return Object.fromEntries(refs.map((k) => [k, full[k]]));
  });
  addTableSheet(wb, 'Orders', {
    title: 'Order update template',
    meta: [
      ['Step 1', rows.length
        ? `The ${rows.length.toLocaleString()} order${rows.length === 1 ? '' : 's'} below are ${scope || 'from the Orders page'}. Delete the rows you do not need, or add rows with other Order IDs.`
        : 'One row per order: type or paste its Order ID (e.g. from Export Excel or the Orders page).'],
      ['Step 2', 'Fill only the gold columns you want to change. Blank cells leave the order as it is.'],
      ['Step 3', 'Save as .xlsx and upload it in Admin → Orders → Upload Excel. You will see a preview before anything is saved.'],
    ],
    columns: ORDER_COLUMNS,
    rows,
    tz,
    validations: VALIDATIONS,
  });
  addNotesSheet(wb, 'How to edit', 'Updating orders with Excel', [
    ...instructions(),
    '',
    'Example row:',
    'Order ID AB-26K7Q2M · Order Status: Shipped · Status Note: Handed to courier · Courier: Blue Dart · Courier Tracking URL: https://www.bluedart.com/tracking · Payment Status: paid. Everything else left blank.',
  ]);
  return wb;
}

// Order IDs as people paste them: any case, stray spaces, Excel's typographic dashes.
export const cleanOrderId = (v) =>
  String(v || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, '');
// The sample ID shipped in earlier templates (AB-26XXXXX).
const isSampleId = (id) => /^AB-\d{2}X{5}$/.test(id);

// ---------- import ----------

function fmtEta(v) {
  if (v instanceof Date) return v.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return v;
}

function textFor(col, raw) {
  if (raw instanceof Date) return col.editable?.eta ? fmtEta(raw) : raw.toISOString().slice(0, 10);
  return String(raw).replace(/\s+/g, ' ').trim();
}

/** Reads the workbook and returns { sheetName, headerRow, columns, rows: [{ row, values: {key: raw} }] }. */
export async function readOrderSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw Object.assign(new Error('This file could not be read. Save it as an Excel workbook (.xlsx) and try again.'), { status: 400 });
  }
  const ws = wb.getWorksheet('Orders') || wb.worksheets.find((s) => s.state !== 'hidden' && s.actualRowCount > 0);
  if (!ws) throw Object.assign(new Error('The workbook has no sheet with data.'), { status: 400 });

  // The header row is the first row (of the first 15) with an "Order ID" cell.
  let headerRow = 0;
  const colMap = new Map();
  const unknown = [];
  for (let r = 1; r <= Math.min(15, ws.rowCount) && !headerRow; r++) {
    const row = ws.getRow(r);
    const cells = [];
    row.eachCell((cell, c) => cells.push([c, norm(cellText(cell.value))]));
    if (cells.some(([, h]) => BY_HEADER.get(h)?.key === 'orderNumber')) {
      headerRow = r;
      for (const [c, h] of cells) {
        const col = BY_HEADER.get(h);
        if (!col) {
          if (h) unknown.push(cellText(row.getCell(c).value));
        } else if (![...colMap.values()].includes(col)) colMap.set(c, col);
      }
    }
  }
  if (!headerRow) {
    throw Object.assign(new Error('Could not find an "Order ID" column. Start from Export Excel or Download Template so the headers match.'), { status: 400 });
  }

  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    const values = {};
    let any = false;
    for (const [c, col] of colMap) {
      const v = cellText(row.getCell(c).value);
      if (v !== '') {
        values[col.key] = v;
        any = true;
      }
    }
    if (!any) continue;
    rows.push({ row: r, values });
    if (rows.length > MAX_IMPORT_ROWS) {
      throw Object.assign(new Error(`This file has more than ${MAX_IMPORT_ROWS.toLocaleString()} order rows. Split it into smaller files.`), { status: 400 });
    }
  }
  return { sheetName: ws.name, headerRow, columns: [...colMap.values()].map((c) => c.key), unknown, rows };
}

const label = (key) => ORDER_COLUMNS.find((c) => c.key === key)?.header || key;

/**
 * Validates every row against the database and works out the changes.
 * Nothing is written. Returns { changes, errors, warnings, unchanged, samples }.
 */
export async function planOrderImport(sheet) {
  const errors = [];
  const warnings = [];
  const changes = [];
  let unchanged = 0;
  let samples = 0;

  // Duplicate Order IDs make the intended values ambiguous: reject all copies.
  const seen = new Map();
  for (const r of sheet.rows) {
    const id = cleanOrderId(r.values.orderNumber);
    if (id && !isSampleId(id)) seen.set(id, [...(seen.get(id) || []), r.row]);
  }

  const ids = [...seen.keys()];
  const orders = new Map();
  for (let i = 0; i < ids.length; i += 5000) {
    const found = await Order.find({ orderNumber: { $in: ids.slice(i, i + 5000) } }).lean();
    for (const o of found) orders.set(o.orderNumber, o);
  }
  // A Tracking ID pasted into the Order ID column: point to the right Order ID.
  const missing = ids.filter((id) => !orders.has(id));
  const byTracking = new Map();
  for (let i = 0; i < missing.length; i += 5000) {
    const found = await Order.find({ trackingId: { $in: missing.slice(i, i + 5000) } }).select('orderNumber trackingId').lean();
    for (const o of found) byTracking.set(o.trackingId, o.orderNumber);
  }

  for (const { row, values } of sheet.rows) {
    const id = cleanOrderId(values.orderNumber);
    const err = (field, message) => errors.push({ row, orderId: id || '', field: field ? label(field) : '', message });
    if (isSampleId(id)) {
      samples++;
      warnings.push({ row, orderId: id, field: 'Order ID', message: 'This is the sample row from the template, so it was skipped. You can delete it.' });
      continue;
    }
    if (!id) {
      err('orderNumber', 'The Order ID is empty. Add the Order ID of the order to update (new orders cannot be created from Excel; use Add Order).');
      continue;
    }
    if (seen.get(id).length > 1) {
      err('orderNumber', `Order ID appears ${seen.get(id).length} times in this file (rows ${seen.get(id).join(', ')}). Keep one row per order.`);
      continue;
    }
    const order = orders.get(id);
    if (!order) {
      err(
        'orderNumber',
        byTracking.has(id)
          ? `This is a Tracking ID. Use the Order ID ${byTracking.get(id)} for this order instead.`
          : 'No order has this Order ID. Check it for typos (Order IDs look like AB-26K7Q2M). New orders cannot be created from Excel; use Add Order.'
      );
      continue;
    }

    const set = {};
    const diffs = [];
    let rowOk = true;
    let note = '';
    for (const col of ORDER_COLUMNS) {
      if (!(col.key in values)) continue;
      const raw = values[col.key];

      if (col.readOnlyCheck) {
        const current = get(orderToRow(order), col.key);
        const a = String(raw).trim().toLowerCase();
        const b = String(current ?? '').trim().toLowerCase();
        const same = col.key === 'total' ? Math.abs(Number(raw) - Number(current)) < 0.005 : a === b;
        if (!same) warnings.push({ row, orderId: id, field: col.header, message: `${col.header} is read-only in Excel; the change was ignored.` });
        continue;
      }
      const ed = col.editable;
      if (!ed) continue;

      let v = textFor(col, raw);
      if (ed.note) {
        if (v.length > ed.max) {
          err(col.key, `Keep the status note under ${ed.max} characters.`);
          rowOk = false;
        } else note = v;
        continue;
      }
      if (v.toUpperCase() === CLEAR) {
        if (ed.required || ed.options) {
          err(col.key, `${col.header} is required and cannot be cleared.`);
          rowOk = false;
          continue;
        }
        v = '';
      }
      if (ed.options) {
        const match = ed.options.find((o) => o.toLowerCase() === v.toLowerCase());
        if (!match && col.key === 'status' && /^cancel/i.test(v)) {
          err(col.key, 'To cancel an order, open it in Admin → Orders and set its status to Cancelled, so its items go back into stock.');
          rowOk = false;
          continue;
        }
        if (!match) {
          err(col.key, `"${v}" is not a valid ${col.header}. Use one of: ${ed.options.join(', ')}.`);
          rowOk = false;
          continue;
        }
        v = match;
      }
      if (v.length > ed.max) {
        err(col.key, `${col.header} is too long (${v.length} characters; the limit is ${ed.max}).`);
        rowOk = false;
        continue;
      }
      if (ed.phone && (v.replace(/\D/g, '').length < 6 || !/^[+\d][\d\s()./-]*$/.test(v))) {
        err(col.key, `"${v}" does not look like a phone number.`);
        rowOk = false;
        continue;
      }
      // The tracking link is optional and never blocks a row. A tracking number
      // typed here is kept as the Tracking Number; anything else is skipped.
      if (ed.url && v && !isUrl(v)) {
        const asNumber = /^[A-Za-z0-9-]{4,40}$/.test(v) && !('trackingNumber' in values);
        if (asNumber && v !== (order.trackingNumber || '')) {
          set.trackingNumber = v;
          diffs.push({ field: 'Tracking Number', from: String(order.trackingNumber || ''), to: v });
          warnings.push({ row, orderId: id, field: col.header, message: `"${v}" is not a link, so it was saved as the Tracking Number.` });
        } else if (!asNumber) {
          warnings.push({ row, orderId: id, field: col.header, message: `"${v}" is not a link (links start with https://), so it was left out. This column is optional.` });
        }
        continue;
      }
      const current = get(order, ed.path) ?? '';
      if (String(current) !== v) {
        set[ed.path] = v;
        diffs.push({ field: col.header, from: String(current), to: v });
      }
    }
    // The same rules as Admin → Orders: Razorpay owns the payment status of
    // online payments, reopening a cancelled order must reserve stock again,
    // and a booked Delhivery shipment owns the courier, AWB and address.
    if (rowOk) {
      const fail = (field, message) => { err(field, message); rowOk = false; };
      const keys = Object.keys(set);
      const booked = order.shipment?.awb && order.shipment.status !== 'cancelled';
      if ('paymentStatus' in set && order.payment?.providerPaymentId) fail('paymentStatus', 'This order was paid online, so its payment status follows Razorpay. To return money, use Refund in Admin → Orders.');
      if ('status' in set && order.status === 'Cancelled') fail('status', 'This order is cancelled. Reopen it in Admin → Orders, so its items are reserved from stock again.');
      if (booked && keys.some((k) => ['carrier', 'trackingNumber', 'carrierUrl'].includes(k))) fail('trackingNumber', 'This order ships with Delhivery, so its courier and AWB are set automatically. Cancel the Delhivery shipment first to use another courier.');
      if (booked && keys.some((k) => k === 'customer.phone' || k.startsWith('customer.address'))) fail('line1', 'The parcel is already booked with Delhivery for the current address. Cancel the shipment in Admin → Shipping before changing it.');
    }
    if (!rowOk) continue;

    // Couriers from the list are saved with their usual spelling, and their
    // tracking link is built from the tracking number unless one was given.
    if (set.carrier && courierByName(set.carrier)) {
      const canonical = courierByName(set.carrier).name;
      if (canonical !== set.carrier) diffs.find((d) => d.field === 'Courier').to = canonical;
      set.carrier = canonical;
      if (canonical === order.carrier) {
        delete set.carrier;
        diffs.splice(diffs.findIndex((d) => d.field === 'Courier'), 1);
      }
    }
    if (('carrier' in set || 'trackingNumber' in set) && !('carrierUrl' in set)) {
      const link = trackingUrl(set.carrier ?? order.carrier, set.trackingNumber ?? order.trackingNumber);
      if (link && link !== order.carrierUrl) {
        set.carrierUrl = link;
        diffs.push({ field: 'Courier Tracking URL', from: String(order.carrierUrl || ''), to: link });
      }
    }

    const statusChange = set.status ? { status: set.status, note: note || 'Updated by the house.' } : null;
    if (note && !statusChange) warnings.push({ row, orderId: id, field: 'Status Note', message: 'The status note was ignored because the Order Status did not change.' });
    if (!diffs.length) {
      unchanged++;
      continue;
    }
    changes.push({ row, orderId: order._id, orderNumber: order.orderNumber, updatedAt: order.updatedAt, patch: set, statusChange, diffs });
  }
  return { changes, errors, warnings, unchanged, samples };
}

const TX_UNSUPPORTED = (e) => e?.code === 20 || /replica set|Transaction numbers/i.test(e?.message || '');

/**
 * Applies planned changes. Each update only matches if the order has not been
 * edited since the preview (same updatedAt); otherwise it is reported as a
 * conflict instead of overwriting someone else's change. Runs in a
 * transaction (all or nothing) when the database supports one.
 */
export async function applyOrderChanges(changes) {
  const current = new Map();
  const ids = changes.map((c) => c.orderId);
  for (let i = 0; i < ids.length; i += 5000) {
    for (const o of await Order.find({ _id: { $in: ids.slice(i, i + 5000) } }).select('updatedAt').lean()) current.set(String(o._id), o.updatedAt?.getTime());
  }
  const conflicts = [];
  const ready = [];
  for (const c of changes) {
    const now = current.get(String(c.orderId));
    if (now === undefined) conflicts.push({ row: c.row, orderId: c.orderNumber, field: '', message: 'This order no longer exists.' });
    else if (now !== new Date(c.updatedAt).getTime()) conflicts.push({ row: c.row, orderId: c.orderNumber, field: '', message: 'This order was changed by someone else after the preview. Export again and re-apply.' });
    else ready.push(c);
  }

  const at = new Date();
  const ops = ready.map((c) => ({
    updateOne: {
      filter: { _id: c.orderId, updatedAt: c.updatedAt },
      update: {
        $set: c.patch,
        ...(c.statusChange ? { $push: { history: { status: c.statusChange.status, note: c.statusChange.note, at } } } : {}),
      },
    },
  }));

  const run = async (session) => {
    let modified = 0;
    for (let i = 0; i < ops.length; i += 1000) {
      const res = await Order.bulkWrite(ops.slice(i, i + 1000), { ordered: false, session });
      modified += res.modifiedCount;
    }
    return modified;
  };

  let modified = 0;
  let transactional = false;
  if (ops.length) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        modified = await run(session);
      });
      transactional = true;
    } catch (e) {
      if (!TX_UNSUPPORTED(e)) throw e;
      modified = await run(undefined);
    } finally {
      await session.endSession();
    }
  }
  const raced = ready.length - modified;
  if (raced > 0) conflicts.push({ row: 0, orderId: '', field: '', message: `${raced} order(s) changed during the import and were not updated.` });
  return { updated: modified, conflicts, transactional };
}

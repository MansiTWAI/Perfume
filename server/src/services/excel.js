// Excel building blocks: every report gets the same look (title block, bold
// frozen header, filters, sensible widths, dates and currency formatted).
import ExcelJS from 'exceljs';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const MONEY = { INR: '"₹"#,##0.00', AED: '"AED "#,##0.00' };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B0E14' } };
const EDIT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8A6424' } };

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AL BARAKAH LIFESTYLE admin';
  wb.created = new Date();
  return wb;
}

// Excel has no time zones: shift UTC dates to the admin's clock before writing.
export const localDate = (d, tz = 0) => (d ? new Date(new Date(d).getTime() - tz * 60000) : null);

export function tzLabel(tz = 0) {
  const m = -tz;
  const sign = m >= 0 ? '+' : '-';
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/**
 * Adds a sheet: a title block, then a table with a frozen, filterable header.
 * columns: [{ header, key, width, type: 'text'|'date'|'datetime'|'money'|'int', editable }]
 * rows: plain objects; for money columns `row.currency` picks ₹ or AED.
 * Returns { ws, headerRow }.
 */
export function addTableSheet(wb, name, { title, meta = [], columns, rows, tz = 0, validations = {} }) {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 18 } });
  let r = 1;
  if (title) {
    ws.getCell(r, 1).value = title;
    ws.getCell(r, 1).font = { bold: true, size: 14, color: { argb: 'FF4B0E14' } };
    r++;
  }
  for (const [k, v] of meta) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF7A665D' } };
    ws.getCell(r, 2).value = v;
    r++;
  }
  if (title || meta.length) r++; // blank line before the table
  const headerRow = r;

  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width || Math.min(40, Math.max(12, c.header.length + 4));
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = c.editable ? EDIT_FILL : HEADER_FILL;
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF2A1A17' } } };
    if (c.note) cell.note = c.note;
  });
  ws.getRow(headerRow).height = 30;

  rows.forEach((row, n) => {
    const excelRow = ws.getRow(headerRow + 1 + n);
    columns.forEach((c, i) => {
      let v = row[c.key];
      const cell = excelRow.getCell(i + 1);
      if (v === undefined || v === null || v === '') return;
      if (c.type === 'date' || c.type === 'datetime') {
        v = localDate(v, tz);
        cell.numFmt = c.type === 'date' ? 'dd mmm yyyy' : 'dd mmm yyyy hh:mm';
      } else if (c.type === 'money') {
        cell.numFmt = MONEY[row[c.currencyKey || 'currency']] || '#,##0.00';
      } else if (c.type === 'int') {
        cell.numFmt = '0';
      }
      cell.value = v;
      if (c.wrap) cell.alignment = { wrapText: true, vertical: 'top' };
    });
  });

  const lastRow = headerRow + Math.max(rows.length, 1);
  ws.views = [{ state: 'frozen', ySplit: headerRow, xSplit: columns.findIndex((c) => c.freeze) + 1 || 0 }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: columns.length } };

  // Drop-down lists for columns with a fixed set of values (e.g. Status).
  for (const [key, list] of Object.entries(validations)) {
    const idx = columns.findIndex((c) => c.key === key);
    if (idx < 0) continue;
    const letter = ws.getColumn(idx + 1).letter;
    const end = Math.max(lastRow, headerRow + 2000);
    ws.dataValidations.add(`${letter}${headerRow + 1}:${letter}${end}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${list.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Unknown value',
      error: `Use one of: ${list.join(', ')}`,
    });
  }
  return { ws, headerRow };
}

export function addNotesSheet(wb, name, title, lines) {
  const ws = wb.addWorksheet(name);
  ws.getColumn(1).width = 110;
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF4B0E14' } };
  lines.forEach((line, i) => {
    const cell = ws.getCell(i + 3, 1);
    cell.value = line;
    cell.alignment = { wrapText: true, vertical: 'top' };
    if (/^[A-Z][A-Za-z ]+:$/.test(line)) cell.font = { bold: true };
  });
  return ws;
}

export async function sendWorkbook(res, wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  res.set({
    'Content-Type': XLSX_TYPE,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.send(Buffer.from(buf));
}

// orders_last_1_month.xlsx, users_2026-09-01_to_2026-09-29.xlsx, …
export function fileName(prefix, period) {
  const part = !period || period.key === 'all' ? 'all_time' : period.label.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[^a-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${prefix}_${part}.xlsx`;
}

// A cell's value as text, whatever Excel / Sheets / LibreOffice stored in it.
export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if ('result' in v) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    if (v.error) return '';
    return '';
  }
  return String(v).trim();
}

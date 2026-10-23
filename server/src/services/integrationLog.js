// Records what an outside service did (IntegrationEvent). Called from the
// services themselves, so it never throws and never slows them down.
//
// Successful routine activity is noted at most once every 15 minutes per
// service and message kind (enough to show "working, last success at …"
// without a row per email); failures are always noted, except an identical
// failure repeated within a minute.
import IntegrationEvent from '../models/IntegrationEvent.js';

const seen = new Map();
const QUIET_OK = 15 * 60 * 1000;
const QUIET_FAIL = 60 * 1000;
const oneLine = (s, max = 300) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function noteActivity(integration, ok, message, { group = '' } = {}) {
  const key = `${integration}|${ok}|${ok ? group || message : message}`;
  const now = Date.now();
  if (now - (seen.get(key) || 0) < (ok ? QUIET_OK : QUIET_FAIL)) return;
  seen.set(key, now);
  if (seen.size > 500) seen.clear();
  IntegrationEvent.create({ integration, kind: 'activity', ok, message: oneLine(message) }).catch(() => {});
}

// Checks, tests and setting changes by the team: always recorded.
export const noteAction = (integration, kind, ok, message, by = '', ms) =>
  IntegrationEvent.create({ integration, kind, ok, message: oneLine(message), by, ...(ms != null && { ms }) }).catch(() => null);

// For the tests: forget the quiet periods.
export const resetActivityLog = () => seen.clear();

// The OpenAPI description (/api/openapi.json, the Postman collection) lists
// exactly the routes the server has: nothing missing, nothing stale.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, close } from './helpers.js';
import { openapi } from '../src/docs/openapi.js';

after(close);

// Mount prefix of a router layer, from its regexp (Express 4).
const prefixOf = (layer) => {
  const m = (layer.regexp?.source || '').match(/^\^((?:\\\/[^\\?(]+)+)\\\/\?\(\?=\\\/\|\$\)$/);
  return m ? m[1].replace(/\\\//g, '/') : '';
};
function routes() {
  const out = new Set();
  const walk = (stack, base) => {
    for (const l of stack) {
      if (l.route) {
        for (const m of Object.keys(l.route.methods)) {
          const path = (base + l.route.path).replace(/\/+$/, '');
          if (path.startsWith('/api/')) out.add(`${m.toUpperCase()} ${path.slice(4).replace(/:(\w+)/g, '{$1}')}`);
        }
      } else if (l.name === 'router' && l.handle?.stack) walk(l.handle.stack, base + prefixOf(l));
    }
  };
  walk(app._router.stack, '');
  return out;
}

test('every route is documented and every documented route exists', () => {
  const code = routes();
  const spec = openapi('https://albarakah.me');
  const documented = new Set(Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter((k) => ['get', 'post', 'put', 'patch', 'delete'].includes(k)).map((m) => `${m.toUpperCase()} ${p}`)));
  assert.ok(code.size > 150, `found ${code.size} routes`);
  assert.deepEqual([...code].filter((r) => !documented.has(r)).sort(), [], 'routes missing from docs/openapi.js');
  assert.deepEqual([...documented].filter((r) => !code.has(r)).sort(), [], 'documented routes that no longer exist');
});

test('every operation has a tag and a summary', () => {
  const spec = openapi('https://albarakah.me');
  const tags = new Set(spec.tags.map((t) => t.name));
  for (const [p, ops] of Object.entries(spec.paths)) {
    for (const [m, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
      assert.ok(op.summary, `${m} ${p} has no summary`);
      assert.ok(op.tags?.length && op.tags.every((t) => tags.has(t)), `${m} ${p} has an unknown tag: ${op.tags}`);
    }
  }
});

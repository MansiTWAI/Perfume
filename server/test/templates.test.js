// WhatsApp notification templates (manual and AI-drafted), preview, products
// and coupons in messages, scheduling and the checks made right before
// sending. WhatsApp and Gemini are faked.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  http, reset, close, makeUser, makeProduct, Product, Coupon, Lead, WhatsAppContact, WhatsAppMessage, WhatsAppCampaign, whatsapp, wa, gemini,
} from './helpers.js';

after(close);
beforeEach(reset);

const sub = (phone, name = 'Aisha Khan', extra = {}) => http('POST', '/api/whatsapp/subscribe', { body: { phone, name, consent: true, ...extra } });
const W = (token) => ({
  get: (p) => http('GET', `/api/admin/whatsapp${p}`, { token }),
  post: (p, body) => http('POST', `/api/admin/whatsapp${p}`, { token, body }),
  put: (p, body) => http('PUT', `/api/admin/whatsapp${p}`, { token, body }),
  patch: (p, body) => http('PATCH', `/api/admin/whatsapp${p}`, { token, body }),
  del: (p) => http('DELETE', `/api/admin/whatsapp${p}`, { token }),
});
async function setup() {
  const { token } = await makeUser('admin');
  const p = await makeProduct({ slug: 'zafreon', inr: 2799, aed: 129 });
  await Product.updateOne({ _id: p._id }, { images: [{ src: '/media/panel-zafreon.webp' }, { src: '/media/zafreon-bottle-marble.jpg' }] });
  await Coupon.create({ code: 'WELCOME10', type: 'percent', percent: 10, maxDiscount: { INR: 500, AED: 25 }, active: true });
  return { w: W(token), token, product: p };
}

describe('templates', () => {
  test('create manually with variables, edit, duplicate, switch off and delete', async () => {
    const { w } = await setup();
    const bad = await w.post('/templates', { name: 'x', message: 'Hello {nmae}' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /Unknown variable \{nmae\}/);
    assert.equal((await w.post('/templates', { name: 'x', message: '{product} is back' })).status, 400); // {product} without a product
    assert.equal((await w.post('/templates', { name: '', message: 'Hi' })).status, 400);
    assert.equal((await w.post('/templates', { name: 'x', message: 'Hi', product: 'gone' })).status, 400);
    assert.equal((await w.post('/templates', { name: 'x', message: 'Hi', image: '/media/panel-zafreon.webp' })).body.errors.some((e) => e.field === 'image'), true);
    assert.equal((await w.post('/templates', { name: 'x', message: 'Hi', cta: { path: 'https://evil.example' } })).status, 400);

    const made = await w.post('/templates', {
      name: 'ZAFREON back in stock', title: 'Back in stock ✨', message: '{product} is back at {price}. Use {coupon} for {discount}.',
      product: 'zafreon', image: '/media/zafreon-bottle-marble.jpg', coupon: 'welcome10', cta: { label: 'Shop Now' },
    });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.source, 'manual');
    assert.equal(made.body.coupon, 'WELCOME10');
    const id = made.body.id;
    const edited = await w.put(`/templates/${id}`, { title: 'Now in stock' });
    assert.equal(edited.body.title, 'Now in stock');
    assert.equal(edited.body.message, made.body.message);
    const copy = await w.post(`/templates/${id}/duplicate`);
    assert.equal(copy.body.name, 'ZAFREON back in stock (copy)');
    assert.equal((await w.patch(`/templates/${id}`, { active: false })).body.active, false);
    assert.equal((await w.get('/templates?active=true')).body.total, 1);
    assert.equal((await w.del(`/templates/${copy.body.id}`)).status, 200);
    assert.equal((await w.get('/templates')).body.total, 1);
  });

  test('AI drafts a template to edit; it never saves or sends, and only known variables survive', async () => {
    const { w } = await setup();
    await sub('9876543400');
    gemini.reply(gemini.text(JSON.stringify({ name: 'ZAFREON launch', title: 'New fragrance just arrived ✨', message: 'Discover {product}, saffron and oud, now {price}. Use {coupon} for {discount}. {secret} {link}', ctaLabel: 'Shop Now' })));
    const d = await w.post('/templates/generate', { brief: 'Announce ZAFREON with the welcome offer', product: 'zafreon', coupon: 'WELCOME10', tone: 'elegant' });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.equal(d.body.source, 'ai');
    assert.equal(d.body.product, 'zafreon');
    assert.equal(d.body.image, '/media/zafreon-bottle-marble.jpg'); // the first picture WhatsApp can show
    assert.ok(!d.body.message.includes('{secret}') && !d.body.message.includes('{link}'));
    assert.ok(d.body.message.includes('{product}') && d.body.message.includes('{coupon}'));
    // The facts went to the AI; no customer data did.
    const sent = JSON.stringify(gemini.requests.at(-1).body);
    assert.ok(sent.includes('ZAFREON') && !sent.includes('9876543400'));
    assert.equal(await WhatsAppCampaign.countDocuments(), 0);
    assert.equal(wa.sent.length, 0);
    assert.equal((await w.get('/templates')).body.total, 0);
    // Saving the edited draft marks it as AI-written.
    const saved = await w.post('/templates', { ...d.body, title: 'Edited by the team' });
    assert.equal(saved.body.source, 'ai');
    // Broken AI output is reported, not sent.
    gemini.reply(gemini.text('not json'));
    assert.equal((await w.post('/templates/generate', { brief: 'x' })).status, 502);
  });
});

describe('preview and product/coupon checks', () => {
  test('preview fills variables per customer and market; problems block sending', async () => {
    const { w } = await setup();
    await sub('+971501234567', 'Omar Siddiqui');
    const omar = await WhatsAppContact.findOne({ phone: '+971501234567' });
    const content = { title: 'Back ✨', message: '{product} is {price}. {coupon} gives {discount}.', product: 'zafreon', coupon: 'WELCOME10', image: '/media/zafreon-bottle-marble.jpg' };
    const pv = await w.post('/preview', { ...content, contactId: String(omar._id) });
    assert.equal(pv.body.greeting, 'Hello Omar,');
    assert.equal(pv.body.text, 'ZAFREON is AED 129. WELCOME10 gives 10% off (up to AED 25).');
    assert.match(pv.body.cta.url, /\/fragrances\/zafreon\?coupon=WELCOME10$/);
    assert.match(pv.body.image, /^https?:\/\/.+zafreon-bottle-marble\.jpg$/);
    assert.equal(pv.body.canSend, true);

    await Coupon.updateOne({ code: 'WELCOME10' }, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await w.post('/preview', content);
    assert.equal(expired.body.canSend, false);
    assert.match(expired.body.problems[0], /WELCOME10 has expired/);
    await Product.updateOne({ slug: 'zafreon' }, { published: false });
    assert.ok((await w.post('/preview', content)).body.problems.some((p) => /hidden from the shop/.test(p)));
    await Product.deleteOne({ slug: 'zafreon' });
    assert.ok((await w.post('/preview', content)).body.problems.some((p) => /no longer exists/.test(p)));
    // And sending is refused the same way.
    const send = await w.post('/campaigns', { ...content, audience: 'all' });
    assert.equal(send.status, 400);
    assert.equal(send.body.code, 'CONTENT_PROBLEM');
  });

  test('a scheduled notification whose product is deleted before it goes out is stopped with the reason', async () => {
    const { w } = await setup();
    await sub('9876543410');
    const at = new Date(Date.now() + 3600e3).toISOString();
    const c = await w.post('/campaigns', { audience: 'all', title: 'Soon', message: '{product} arrives tonight', product: 'zafreon', scheduledAt: at });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    assert.ok(c.body.scheduledAt);
    await whatsapp.pumpWhatsApp();
    assert.equal(wa.sent.length, 0, 'not before its time');
    assert.equal((await w.get('/status')).body.scheduled, 1);
    await Product.deleteOne({ slug: 'zafreon' });
    await WhatsAppMessage.updateMany({}, { nextAttemptAt: new Date(Date.now() - 1000) });
    await whatsapp.pumpWhatsApp();
    assert.equal(wa.sent.length, 0);
    const detail = await w.get(`/campaigns/${c.body.id}`);
    assert.match(detail.body.problem, /no longer exists/);
    assert.equal(detail.body.counts.failed, 1);
    assert.match(detail.body.messages.items[0].error, /^Not sent: The product/);
    // Retry is refused while the product is still gone.
    assert.equal((await w.post(`/campaigns/${c.body.id}/retry`)).status, 409);
  });

  test('scheduled notifications can be cancelled; nothing is sent; past times are refused', async () => {
    const { w } = await setup();
    await sub('9876543420');
    assert.equal((await w.post('/campaigns', { audience: 'all', message: 'Hi', scheduledAt: new Date(Date.now() - 3600e3).toISOString() })).status, 400);
    const c = await w.post('/campaigns', { audience: 'all', message: 'Eid preview evening', scheduledAt: new Date(Date.now() + 864e5).toISOString() });
    const cancel = await w.post(`/campaigns/${c.body.id}/cancel`);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.cancelled, 1);
    await WhatsAppMessage.updateMany({}, { nextAttemptAt: new Date(Date.now() - 1000) });
    await whatsapp.pumpWhatsApp();
    assert.equal(wa.sent.length, 0);
    const d = await w.get(`/campaigns/${c.body.id}`);
    assert.ok(d.body.cancelledAt);
    assert.equal(d.body.counts.skipped, 1);
    assert.equal((await w.post(`/campaigns/${c.body.id}/cancel`)).status, 409);
  });
});

describe('sending with templates', () => {
  test('a saved template goes to AI leads only, with the picture and Shop Now button when the picture template is set up', async () => {
    const { w } = await setup();
    const lead = await Lead.create({ name: 'Lead', intent: 'ready', sessionIds: ['s-1'] });
    const { default: ChatSession } = await import('../src/models/ChatSession.js');
    await ChatSession.create({ sessionId: 's-1', lead: lead._id, messages: [] });
    await sub('9876543430', 'Lead Person', { sessionId: 's-1' });
    await sub('9876543431', 'Not A Lead');
    assert.equal((await w.post('/audience', { audience: 'leads' })).body.recipients, 1);
    assert.equal((await w.post('/audience', { audience: 'all' })).body.recipients, 2);
    const t = await w.post('/templates', { name: 'Launch', title: 'New fragrance just arrived ✨', message: 'Discover {product} at {price}.', product: 'zafreon', image: '/media/zafreon-bottle-marble.jpg', coupon: 'WELCOME10', cta: { label: 'Shop Now' } });

    process.env.WHATSAPP_NOTIFY_MEDIA_TEMPLATE = 'house_update_image';
    try {
      const c = await w.post('/campaigns', { audience: 'leads', templateId: t.body.id, confirm: true });
      assert.equal(c.status, 201, JSON.stringify(c.body));
      assert.equal(c.body.recipients, 1);
      assert.equal(c.body.templateName, 'Launch');
      await whatsapp.whatsappIdle();
      assert.equal(wa.sent.length, 1);
      const tpl = wa.sent[0].body.template;
      assert.equal(wa.sent[0].to, '919876543430');
      assert.equal(tpl.name, 'house_update_image');
      const [header, body, button] = tpl.components;
      assert.equal(header.type, 'header');
      assert.match(header.parameters[0].image.link, /zafreon-bottle-marble\.jpg$/);
      assert.deepEqual(body.parameters.map((p) => p.text), ['Lead', '*New fragrance just arrived ✨* Discover ZAFREON at ₹2,799.']);
      assert.equal(button.sub_type, 'url');
      assert.equal(button.parameters[0].text, 'fragrances/zafreon?coupon=WELCOME10');
      assert.equal((await w.get(`/templates/${t.body.id}`)).body.timesUsed, 1);
    } finally {
      delete process.env.WHATSAPP_NOTIFY_MEDIA_TEMPLATE;
    }
  });

  test('without the picture template, the link goes at the end of the text; a switched-off template cannot be sent', async () => {
    const { w } = await setup();
    await sub('9876543440');
    const t = await w.post('/templates', { name: 'Offer', message: 'Use {coupon} for {discount}.', coupon: 'WELCOME10' });
    const c = await w.post('/campaigns', { audience: 'all', templateId: t.body.id });
    assert.equal(c.status, 201);
    await whatsapp.whatsappIdle();
    const body = wa.sent[0].body.template.components;
    assert.equal(body.length, 1);
    assert.match(body[0].parameters[1].text, /^Use WELCOME10 for 10% off \(up to ₹500\)\. Shop Now: https?:\/\/.+\/\?coupon=WELCOME10$/);
    await w.patch(`/templates/${t.body.id}`, { active: false });
    assert.equal((await w.post('/campaigns', { audience: 'all', templateId: t.body.id })).status, 400);
    assert.equal((await w.post('/campaigns', { audience: 'all', message: 'x', confirm: false })).status, 400);
  });

  test('overview numbers: subscribers this month, delivery rate, templates', async () => {
    const { w } = await setup();
    await sub('9876543450');
    await w.post('/templates', { name: 'One', message: 'Hello' });
    await w.post('/campaigns', { audience: 'all', message: 'A note from the house.' });
    await whatsapp.whatsappIdle();
    const s = (await w.get('/status')).body;
    assert.equal(s.month.joined, 1);
    assert.equal(s.month.notifications, 1);
    assert.equal(s.month.sent, 1);
    assert.equal(s.templates, 1);
    const opts = (await w.get('/options')).body;
    assert.equal(opts.products[0].slug, 'zafreon');
    assert.deepEqual(opts.products[0].images.map((i) => i.ok), [false, true]);
    assert.equal(opts.coupons[0].code, 'WELCOME10');
  });
});

describe('app API (/api/v1)', () => {
  test("a template's own message stays in data, not taken as the status message", async () => {
    const { token } = await setup();
    const made = await http('POST', '/api/v1/admin/whatsapp/templates', { token, body: { name: 'Envelope', message: 'Hello {name}, {product} is back.', product: 'zafreon' } });
    assert.equal(made.status, 201);
    assert.equal(made.body.success, true);
    assert.equal(made.body.message, 'Created successfully');
    assert.equal(made.body.data.message, 'Hello {name}, {product} is back.');
    const got = await http('GET', `/api/v1/admin/whatsapp/templates/${made.body.data.id}`, { token });
    assert.equal(got.body.data.message, 'Hello {name}, {product} is back.');
    // A plain status reply still uses its message.
    const s = await http('POST', '/api/v1/whatsapp/subscribe', { body: { phone: '+919876500111', consent: true } });
    assert.match(s.body.message, /WhatsApp/);
    assert.equal(s.body.data.subscribed, true);
  });
});

import { Link } from 'react-router-dom';
import Seo, { breadcrumbLd, orgLd } from '../components/Seo';
import { PageHero, Accordion } from '../components/Bits';
import { Reveal } from '../components/Motion';
import { CONTACT } from '../lib/format';
import { useStore } from '../context/StoreContext';

const FAQS = {
  en: [
    ['What is an Eau de Parfum?', 'An Eau de Parfum typically contains 15–20% perfume oil. It is rich enough to develop through the day without feeling heavy. Both ELARISSE and ZAFREON are Eau de Parfum.'],
    ['Which fragrance should I choose?', 'ELARISSE is luminous and floral-amber, lovely for daytime and celebrations. ZAFREON is darker, with saffron, incense and oud, made for evenings. Try our Find Your Signature quiz from the top of any page.'],
    ['Are your fragrances unisex?', 'Yes. Both fragrances are designed for anyone drawn to their character.'],
    ['Do you deliver outside India?', 'We deliver across India and to the UAE, with selected Middle Eastern destinations to follow. Duties and delivery windows for international orders are confirmed before dispatch.'],
    ['Can I add a gift note?', 'Yes. At checkout, add a Signature Card with the recipient’s name, the occasion and a personal line. We print it and place it in the box.'],
    ['How do I track my order?', 'Use the tracking ID from your order confirmation on the Track Order page, together with the email you used at checkout.'],
    ['How should I store my perfume?', 'Keep it in its box, away from sunlight, heat and humidity. Avoid the bathroom and never leave it in a car.'],
  ],
  ar: [
    ['ما هو أو دو بارفان؟', 'يحتوي أو دو بارفان عادةً على 15–20% من زيت العطر، وهو غنيّ بما يكفي ليتطوّر طوال اليوم دون أن يكون ثقيلاً. ELARISSE وZAFREON كلاهما أو دو بارفان.'],
    ['أيّ عطر أختار؟', 'ELARISSE مضيء، زهري عنبري، جميل للنهار والاحتفالات. وZAFREON أعمق، بالزعفران والبخور والعود، صُنع للأمسيات. جرّب اختبار «اكتشف توقيعك» من أعلى أي صفحة.'],
    ['هل عطوركم للجنسين؟', 'نعم. صُمّم العطران لكل من ينجذب إلى طابعهما.'],
    ['هل توصلون خارج الهند؟', 'نوصل إلى جميع أنحاء الهند وإلى الإمارات، وتتبعها وجهات مختارة في الشرق الأوسط. نؤكد الرسوم الجمركية ومدة التوصيل للطلبات الدولية قبل الشحن.'],
    ['هل يمكنني إضافة بطاقة إهداء؟', 'نعم. عند إتمام الطلب أضف بطاقة إهداء تحمل اسم المُهدى إليه والمناسبة وسطراً شخصياً، نطبعها ونضعها داخل العلبة.'],
    ['كيف أتتبّع طلبي؟', 'استخدم رقم التتبّع من تأكيد طلبك في صفحة تتبّع الطلب، مع البريد الإلكتروني الذي استخدمته عند الطلب.'],
    ['كيف أحفظ عطري؟', 'احفظه في علبته بعيداً عن أشعة الشمس والحرارة والرطوبة. تجنّب الحمّام، ولا تتركه في السيارة أبداً.'],
  ],
};

function LegalPage({ title, seoTitle, description, eyebrow, path, image, alt, extraLd, children }) {
  const ld = [breadcrumbLd([['Home', '/'], [title, path]]), extraLd].filter(Boolean);
  return (
    <>
      <Seo title={seoTitle || title} description={description} jsonLd={ld} />
      <PageHero eyebrow={eyebrow} title={title} layout="split" image={image} alt={alt} />
      <section className="section light">
        <div className="container narrow prose legal">{children}</div>
      </section>
    </>
  );
}

export function Faq() {
  const { lang, t } = useStore();
  const faqs = FAQS[lang] || FAQS.en;
  return (
    <>
      <Seo
        title="Frequently Asked Questions | AL BARAKAH LIFESTYLE"
        description="Answers about AL BARAKAH LIFESTYLE fragrances, delivery across India and the UAE, gift notes, tracking and perfume care."
        jsonLd={[
          breadcrumbLd([['Home', '/'], ['FAQ', '/faq']]),
          { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
        ]}
      />
      <PageHero eyebrow={t('Help')} title={t('Questions, answered')} layout="split" image="/media/elarisse-campaign.webp" alt="ELARISSE beneath palace arches at sunset" lede={t('Fragrance, delivery, gifting and care.')} />
      <section className="section">
        <div className="container narrow">
          <Accordion items={faqs} />
          <Reveal className="center" style={{ marginTop: 48 }}>
            <p className="section-lede">{t('Still wondering? {link}.', { link: <Link to="/contact" className="text-link">{t('Speak with the house')}</Link> })}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}

const UPDATED = '03 October 2026';

// Numbered policy sections: [heading, body]. Body may be a string or JSX.
function Sections({ items }) {
  return items.map(([h, body], i) => (
    <section key={h}>
      <h2>{i + 1}. {h}</h2>
      {typeof body === 'string' ? <p>{body}</p> : body}
    </section>
  ));
}

const Updated = () => <p className="legal-updated"><em>Effective / Last Updated: {UPDATED}</em></p>;

const ContactLine = () => (
  <p dir="ltr">
    <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · <a href={`tel:+${CONTACT.phoneRaw}`}>{CONTACT.phone}</a>
  </p>
);

const SHIPPING_SECTIONS = [
  ['Where We Ship', 'We intend to serve customers across India. Selected Middle East destinations may be offered from time to time; exact countries and eligible products are confirmed at checkout.'],
  ['Order Processing', 'Orders are normally processed after successful payment confirmation. Processing may take longer during launches, promotions, weekends, holidays or unusually high order volumes.'],
  ['Delivery Estimates', 'Estimated delivery times are shown at checkout or communicated with the order where available. They are estimates unless a specific guaranteed service is expressly offered.'],
  ['Shipping Charges', 'Applicable shipping charges are shown before order completion. Free-shipping promotions may have destination or minimum-order conditions.'],
  ['Tracking', <p>Where available, customers receive tracking information. Courier tracking events may not update continuously. Follow your order on the <Link to="/track">Track Order</Link> page.</p>],
  ['Address Accuracy', 'Customers must provide a complete and accurate address, recipient name and contact number. Re-dispatch charges may apply when a shipment is returned because of incorrect or incomplete information.'],
  ['Delivery Attempts', 'Courier partners may make delivery attempts according to their operating procedures. Customers should remain reachable at the provided contact number.'],
  ['Damaged Packages', <p>Where reasonably possible, photograph or record visibly damaged packaging before opening. If the product is damaged, contact support promptly with the order number and evidence. See our <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>.</p>],
  ['Wrong or Missing Items', <p>Contact us promptly if an incorrect or incomplete order is received. We will review and resolve it under the <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link> and applicable law.</p>],
  ['International Shipping', 'International orders may involve customs duties, import taxes, documentation and destination-country restrictions. Unless stated otherwise, applicable destination charges are the customer’s responsibility.'],
  ['Fragrance Transport', 'Perfumes containing alcohol can be subject to carrier, aviation, customs or dangerous-goods restrictions. Shipping options may therefore vary by destination. Orders may be modified or cancelled if transport is not legally or operationally available.'],
  ['Delays', 'Courier, customs, weather and transport disruptions can affect delivery. We will reasonably assist with delayed shipments.'],
];

export function Shipping() {
  return (
    <LegalPage
      title="Shipping Policy"
      seoTitle="Shipping Policy | AL BARAKAH LIFESTYLE Perfumes"
      description="Learn about AL BARAKAH LIFESTYLE perfume shipping across India, delivery timelines, tracking, damaged packages and selected international destinations."
      eyebrow="Delivery"
      path="/shipping-policy"
      image="/media/elarisse-bottle.webp"
      alt="ELARISSE in its ivory and gold presentation box"
    >
      <Updated />
      <p>AL BARAKAH LIFESTYLE aims to provide reliable, trackable and secure delivery. Shipping availability, timelines and charges depend on destination, product availability, courier service and options offered at checkout.</p>
      <Sections items={SHIPPING_SECTIONS} />
      <h2>Questions about delivery?</h2>
      <ContactLine />
    </LegalPage>
  );
}

const REFUND_SECTIONS = [
  ['Cancellation Before Dispatch', 'Request cancellation as soon as possible. If the order has not been processed or handed to the courier, we will make reasonable efforts to cancel it. If accepted, the eligible amount is refunded through the original payment method or another permitted method.'],
  ['Cancellation After Dispatch', 'Once handed to the courier, cancellation may no longer be operationally possible. Contact support immediately; where return-to-origin is available, the matter may be processed after the shipment returns.'],
  ['Opened or Used Perfume', 'Opened, sprayed, used or tampered-with perfume products are generally not eligible for a change-of-mind return because of hygiene and product-integrity considerations. This does not remove rights applicable to defective, damaged or incorrect goods.'],
  ['Unopened Returns', 'Where an unopened return is offered, the product should normally be unused, unopened, in original packaging, complete and suitable for resale. Obtain return instructions before sending anything back.'],
  ['Damaged in Transit', 'Contact us promptly and provide order details plus clear photos/video of outer packaging, label, internal packaging and product. Evidence may be needed for courier investigation.'],
  ['Wrong Product', 'If a materially different product is delivered, contact support promptly. After verification, replacement, return or refund may be arranged.'],
  ['Defective Product', 'If a product appears defective, provide order and product/batch details where available. We may inspect or investigate before approving replacement or refund.'],
  ['Leakage / Broken Bottle', 'For leakage, breakage or significant packaging failure, provide evidence and avoid unsafe handling. Resolution depends on the issue, evidence, courier findings and applicable rights.'],
  ['Change of Mind', 'Not liking a fragrance after opening or using it is generally a preference issue rather than a defect. Fragrance perception varies with skin chemistry, environment and personal preference.'],
  ['Refund Amount', 'If a refund is approved, the amount is determined according to the order, return condition, shipping charges, discounts and applicable law.'],
  ['Refund Method', 'Approved refunds are normally returned to the original payment method, subject to payment-provider capabilities and bank processing times.'],
  ['Promotional Orders', 'Bundles, discounts, gifts and coupon campaigns may have additional return/refund conditions displayed with the promotion.'],
  ['Unavailable Products', 'If we accept an order but cannot fulfil it because a product becomes unavailable or cannot be shipped to the destination, we will inform the customer and process the applicable refund or alternative.'],
  ['Abuse & Fraud', 'Suspicious refund patterns, false damage claims or promotional abuse may be investigated. Any action remains subject to applicable law and mandatory consumer rights.'],
  ['Return Shipping', 'Who pays return shipping depends on the reason for return and the instructions provided for the approved return. Do not send a product to an unauthorised address.'],
  ['How to Request', <p>Email <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or call/WhatsApp <a href={`tel:+${CONTACT.phoneRaw}`} dir="ltr">{CONTACT.phone}</a>. Provide order number, customer name, product, reason and evidence where relevant. Do not return a product before receiving instructions.</p>],
  ['Processing', 'After receiving the returned product or required evidence, we will communicate the next step within a reasonable operational period, subject to courier investigation, payment processing and applicable legal timelines.'],
  ['Consumer Rights', 'Nothing in this policy is intended to remove or reduce mandatory rights available under Indian law. Where a legal requirement provides a different entitlement, the applicable requirement prevails.'],
];

export function Refund() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      seoTitle="Refund & Cancellation Policy | AL BARAKAH LIFESTYLE"
      description="Understand cancellation, returns, refunds and support for damaged, incorrect or defective AL BARAKAH perfume orders."
      eyebrow="Customer care"
      path="/refund-policy"
      image="/media/zafreon-logo.webp"
      alt="The ZAFREON emblem in gold"
    >
      <Updated />
      <p>This policy explains how cancellations, returns, replacements and refunds are handled for our perfume, fragrance and personal-use products.</p>
      <div className="legal-summary">
        <h2>In short</h2>
        <ul>
          <li><strong>Before dispatch:</strong> contact us quickly for cancellation.</li>
          <li><strong>Opened/used perfume:</strong> generally no change-of-mind return.</li>
          <li><strong>Damaged, incorrect or defective:</strong> contact us promptly with evidence.</li>
          <li><strong>Approved refunds:</strong> normally go back to the original payment method, subject to provider timelines and applicable law.</li>
        </ul>
      </div>
      <Sections items={REFUND_SECTIONS} />
      <p>Delivery questions are covered in our <Link to="/shipping-policy">Shipping Policy</Link>.</p>
    </LegalPage>
  );
}

const PRIVACY_SECTIONS = [
  ['Scope', 'This Policy applies to personal information processed through the AL BARAKAH LIFESTYLE website, online ordering experience, customer-support communications and related digital channels.'],
  ['Information We May Collect', 'We may collect identity and contact information; billing and shipping details; order history; payment transaction references; support communications; technical/device information; website usage data; and cookie information, depending on the services enabled.'],
  ['How We Use Information', 'We use information to fulfil orders, arrange delivery, process payments, provide support, communicate service updates, improve the website and products, prevent fraud and abuse, measure performance, send permitted marketing communications, and comply with legal, tax, accounting and regulatory obligations.'],
  ['Consent & Legal Basis', 'Where consent is the applicable basis, consent should be clear, specific, informed and affirmative. Marketing consent is never hidden in a pre-ticked box. Where applicable, you have a practical method to withdraw consent.'],
  ['Cookies & Analytics', 'Cookies may support essential website functions, preferences, analytics and marketing measurement, with appropriate consent where required by applicable law.'],
  ['Payment Providers', 'Online payments may be processed by authorised payment gateways. We may receive transaction status and reference information needed to fulfil an order; complete card credentials are normally handled by the payment provider.'],
  ['Service Providers', 'We may share the minimum information reasonably necessary with logistics companies, payment processors, hosting/technology providers, customer-support providers, analytics services and other vendors that help operate the business.'],
  ['Legal Disclosures', 'Information may be disclosed where required or permitted by law, regulation, court order, governmental request, fraud investigation, security investigation or protection of rights.'],
  ['Security', 'We use reasonable technical and organisational safeguards appropriate to the information handled. No online system can be guaranteed completely secure.'],
  ['Retention', 'Information is retained for as long as reasonably necessary for fulfilment, support, accounting, tax, fraud prevention, legal compliance and dispute resolution, subject to applicable requirements.'],
  ['Privacy Choices', 'Depending on applicable law, you may request access, correction or deletion of certain information, withdraw consent where consent is the basis, and opt out of promotional communications.'],
  ['Children', 'Our online store is intended for general consumers. We do not knowingly seek personal data from children in circumstances where such collection is prohibited by law.'],
  ['Third-Party Links', 'Third-party websites and services linked from our website operate under their own privacy policies.'],
  ['Policy Changes', 'We may update this Policy to reflect changes in our business, technology, service providers or legal requirements. The updated version will carry a revised date.'],
  ['Privacy Contact', <><p>Privacy questions or requests may be sent to:</p><ContactLine /></>],
];

export function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      seoTitle="Privacy Policy | AL BARAKAH LIFESTYLE"
      description="Read the AL BARAKAH LIFESTYLE Privacy Policy covering personal data, cookies, payments, security and privacy choices."
      eyebrow="Legal"
      path="/privacy-policy"
      image="/media/zafreon-logo.webp"
      alt="The ZAFREON emblem in gold"
    >
      <Updated />
      <p>AL BARAKAH LIFESTYLE respects your privacy. This Privacy Policy explains what information we may collect, why we collect it, how we use and protect it, when it may be shared, and the choices available to you when you use our website, place an order, contact us or otherwise interact with our digital services.</p>
      <Sections items={PRIVACY_SECTIONS} />
    </LegalPage>
  );
}

const TERMS_SECTIONS = [
  ['Website Use', 'Use the website only for lawful purposes. Do not attempt unauthorised access, introduce malicious code, scrape protected areas, impersonate another person, manipulate transactions or use the website for fraud.'],
  ['Intellectual Property', 'AL BARAKAH LIFESTYLE, its logos, Arabic calligraphy, brand marks, product names, photographs, packaging artwork, website copy and visual identity are owned by or licensed to the relevant rights holder. Unauthorised commercial use or reproduction is prohibited except where legally permitted.'],
  ['Product Information', 'We aim to keep product descriptions, notes, sizes, images and packaging information accurate. Minor differences in colour, packaging finish, batch characteristics or photographic appearance may occur.'],
  ['Fragrance Experience', 'Fragrance perception is personal and can vary with skin chemistry, climate and application. A personal dislike after opening or use is not automatically a product defect.'],
  ['Prices & Taxes', 'Prices are displayed in INR unless otherwise stated. Applicable taxes and delivery charges are presented before order completion.'],
  ['Offers', 'Discounts, bundles, coupons and gifts may have campaign-specific conditions such as minimum order values, eligible products and validity periods.'],
  ['Orders', 'Orders are subject to availability, payment confirmation, security checks and fulfilment capability. If an order cannot be fulfilled, we will inform you and handle the applicable refund or alternative arrangement.'],
  ['Payments', 'Payments may be processed by authorised third-party providers. Customers must provide accurate billing information and use payment methods they are authorised to use.'],
  ['Returns & Refunds', <p>Returns, cancellations and refunds are governed by the <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>. Mandatory consumer rights are not excluded.</p>],
  ['Shipping', <p>Delivery is governed by the <Link to="/shipping-policy">Shipping Policy</Link>. Delivery estimates may change due to courier, weather, transport, regulatory or other external factors.</p>],
  ['Reviews & User Content', 'Submitted reviews and media should be truthful, lawful and non-infringing. We may moderate or remove content that violates applicable rules.'],
  ['Prohibited Conduct', 'Do not misuse promotions, create fraudulent accounts, submit false payment/refund claims, manipulate reviews or interfere with website security.'],
  ['Third-Party Services', 'Payment, analytics, hosting, logistics and communications may involve third-party providers whose own terms may apply.'],
  ['Force Majeure', 'We are not responsible for delays caused by events beyond reasonable control, including natural disasters, severe weather, government restrictions, strikes, major transport disruptions or technology failures.'],
  ['Liability', 'To the maximum extent permitted by applicable law, indirect or consequential losses may be limited. Nothing here excludes rights or liability that cannot legally be excluded.'],
  ['Governing Law', 'These Terms are governed by the laws applicable in India.'],
  ['Changes', 'We may update these Terms as products, services, technology or legal obligations change. The current published version applies subject to applicable law.'],
];

export function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      seoTitle="Terms & Conditions | AL BARAKAH LIFESTYLE"
      description="Read the terms governing website use, perfume orders, pricing, payments, shipping, intellectual property and customer responsibilities."
      eyebrow="Legal"
      path="/terms"
      image="/media/elarisse-logo-ivory.webp"
      alt="The ELARISSE emblem in gold"
    >
      <Updated />
      <p>These Terms govern access to and use of the AL BARAKAH LIFESTYLE website and purchases made through it. By using the website or placing an order, you agree to comply with these Terms together with our <Link to="/privacy-policy">Privacy Policy</Link>, <Link to="/shipping-policy">Shipping Policy</Link> and <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>.</p>
      <Sections items={TERMS_SECTIONS} />
      <h2>Contact</h2>
      <ContactLine />
    </LegalPage>
  );
}

const PHILOSOPHY = [
  ['Character', 'fragrances should have a recognisable personality.'],
  ['Balance', 'top, heart and base notes should work as a coherent composition.'],
  ['Elegance', 'luxury is expressed through restraint, presentation and attention to detail.'],
  ['Versatility', 'collections should offer options for everyday wear, evenings, celebrations and gifting.'],
  ['Experience', 'fragrance, bottle, packaging and service should feel like one complete brand experience.'],
];

export function About() {
  return (
    <LegalPage
      title="About Us"
      seoTitle="About AL BARAKAH LIFESTYLE | Premium Fragrance Brand"
      description="Discover the story, philosophy and fragrance journey of AL BARAKAH LIFESTYLE, a premium fragrance, beauty and lifestyle brand from Hyderabad, India."
      eyebrow="AL BARAKAH — Leave your signature"
      path="/about-us"
      image="/media/duo-triptych.webp"
      alt="ELARISSE and ZAFREON Eau de Parfum"
      extraLd={orgLd()}
    >
      <p>Welcome to AL BARAKAH LIFESTYLE, a premium fragrance, beauty and lifestyle brand created for people who believe that personal style is not complete without a signature scent. Our world is built around fragrance, refinement, self-expression and the details that turn an ordinary moment into a memorable one.</p>
      <p>The name AL BARAKAH carries the idea of blessing, abundance and goodness. That spirit informs our approach: we aim to create products and experiences that feel considered, meaningful and worthy of being remembered.</p>
      <h2>Our Story</h2>
      <p>AL BARAKAH LIFESTYLE brings together the richness of fragrance traditions from India and the Middle East with a contemporary luxury sensibility. We are building a brand that respects the heritage of perfumery while speaking to today’s customer—someone who wants distinctive fragrance, elegant presentation and an experience that feels personal. <Link to="/our-story">Read the full story</Link>.</p>
      <h2>Our Fragrance Philosophy</h2>
      <p>We believe a great perfume should evolve. The opening creates an impression, the heart reveals character and the base leaves a memorable trail. Our creative direction therefore considers the complete fragrance journey rather than relying only on the first spray.</p>
      <ul>
        {PHILOSOPHY.map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
      </ul>
      <h2>Our Collections</h2>
      <p>AL BARAKAH LIFESTYLE is developing a portfolio across fragrance, beauty and lifestyle. The initial fragrance direction includes <Link to="/fragrances/elarisse">ELARISSE</Link> and <Link to="/fragrances/zafreon">ZAFREON</Link>, with future collections designed to expand the brand’s olfactory universe. <Link to="/fragrances">Explore the collection</Link>.</p>
      <h2>Made for India and Beyond</h2>
      <p>Our brand is rooted in Hyderabad, Telangana, while our online presence allows us to serve customers across India and, where specifically offered, selected destinations in the Middle East. International availability, delivery timelines, duties, taxes and return eligibility may vary by destination — see our <Link to="/shipping-policy">Shipping Policy</Link>.</p>
      <h2>Our Commitment</h2>
      <p>Trust is central to a fragrance brand. We aim to provide clear product information, transparent commercial terms, secure payment processing, responsible customer support and an online experience that respects the customer at every stage.</p>
      <h2>Our Vision</h2>
      <p>To build a distinctive fragrance and lifestyle house recognised for refined scent creation, elegant design, thoughtful customer experience and a timeless brand identity.</p>
      <h2>Our Mission</h2>
      <p>To create and present fragrances and lifestyle products that help people express individuality, create memories and leave a lasting impression—while building long-term relationships through quality, transparency and service.</p>
      <hr />
      <p>AL BARAKAH LIFESTYLE is a premium fragrance and lifestyle brand from Hyderabad, India, offering luxury perfumes, Eau de Parfum, Arabic-inspired fragrances, unisex perfumes and lifestyle products. Our collections are created for customers looking for distinctive scents, elegant packaging and memorable perfume experiences. Explore AL BARAKAH fragrances online, discover signature scents for everyday wear and special occasions, and experience a modern fragrance house inspired by Indian and Middle Eastern perfumery.</p>
    </LegalPage>
  );
}

export function NotFound() {
  const { t } = useStore();
  return (
    <>
      <Seo title="Page not found" />
      <PageHero eyebrow="404" title={t('This page has left no trace')} image="/media/zafreon-campaign.webp" lede={t('The page you are looking for may have moved. Let us take you somewhere memorable.')}>
        <div className="btn-row" style={{ marginTop: 32 }}>
          <Link to="/" className="btn btn-primary">{t('Return home')}</Link>
          <Link to="/fragrances" className="btn btn-ghost">{t('View the fragrances')}</Link>
        </div>
      </PageHero>
    </>
  );
}

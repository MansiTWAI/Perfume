import { Link } from 'react-router-dom';
import Seo, { breadcrumbLd } from '../components/Seo';
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

function LegalPage({ title, seoTitle, eyebrow, path, image, alt, children }) {
  return (
    <>
      <Seo title={seoTitle || title} jsonLd={breadcrumbLd([['Home', '/'], [title, path]])} />
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

const SHIPPING = {
  en: {
    title: 'Shipping & Returns',
    eyebrow: 'Delivery',
    body: (
      <>
        <h2>Where we deliver</h2>
        <p>We deliver across India from our home in Hyderabad, and to the United Arab Emirates. Selected Middle Eastern destinations will follow, subject to courier coverage, customs requirements, import rules and destination restrictions.</p>
        <h2>Delivery charges</h2>
        <p>Delivery charges are shown in your bag and at checkout before you place your order. Orders above the threshold shown in your bag qualify for complimentary delivery.</p>
        <h2>International orders</h2>
        <p>Unless checkout states otherwise, customers may be responsible for destination duties, taxes and local charges. We confirm these and the expected delivery window before dispatch.</p>
        <h2>Tracking</h2>
        <p>Every order receives a tracking ID. Follow each stage, from Order Placed to Delivered, on the <Link to="/track">Track Order</Link> page.</p>
        <h2>Returns</h2>
        <p>Because fragrance is a personal-care product, opened bottles cannot be returned unless they arrive damaged or incorrect. If your order arrives damaged, please contact us within 48 hours of delivery with photographs of the parcel and product, and we will make it right.</p>
        <h2>Contact</h2>
      </>
    ),
  },
  ar: {
    title: 'الشحن والإرجاع',
    eyebrow: 'التوصيل',
    body: (
      <>
        <h2>أين نوصل</h2>
        <p>نوصل إلى جميع أنحاء الهند من مقرّنا في حيدر آباد، وإلى الإمارات العربية المتحدة. وتتبعها وجهات مختارة في الشرق الأوسط، رهناً بتغطية شركات الشحن ومتطلبات الجمارك وقواعد الاستيراد وقيود كل وجهة.</p>
        <h2>رسوم التوصيل</h2>
        <p>تظهر رسوم التوصيل في حقيبتك وعند إتمام الطلب قبل تأكيده. والطلبات التي تتجاوز الحدّ الظاهر في حقيبتك تحصل على توصيل مجاني.</p>
        <h2>الطلبات الدولية</h2>
        <p>ما لم تذكر صفحة الطلب خلاف ذلك، قد يتحمّل العميل الرسوم الجمركية والضرائب والرسوم المحلية في بلد الوصول. نؤكد هذه الرسوم ومدة التوصيل المتوقعة قبل الشحن.</p>
        <h2>التتبّع</h2>
        <p>يحصل كل طلب على رقم تتبّع. تابع كل مرحلة، من تقديم الطلب حتى التسليم، في صفحة <Link to="/track">تتبّع الطلب</Link>.</p>
        <h2>الإرجاع</h2>
        <p>لأن العطر منتج للعناية الشخصية، لا يمكن إرجاع القوارير المفتوحة إلا إذا وصلت تالفة أو غير صحيحة. إذا وصل طلبك تالفاً، يُرجى التواصل معنا خلال 48 ساعة من التسليم مع صور للطرد والمنتج، وسنعالج الأمر.</p>
        <h2>التواصل</h2>
      </>
    ),
  },
};

export function Shipping() {
  const { lang } = useStore();
  const c = SHIPPING[lang] || SHIPPING.en;
  return (
    <LegalPage title={c.title} seoTitle="Shipping & Returns" eyebrow={c.eyebrow} path="/shipping-returns" image="/media/elarisse-bottle.webp" alt="ELARISSE in its ivory and gold presentation box">
      {c.body}
      <p dir="ltr">{CONTACT.email} · {CONTACT.phone}</p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy" eyebrow="Legal" path="/privacy-policy" image="/media/zafreon-logo.webp" alt="The ZAFREON emblem in gold">
      <p>This Privacy Policy explains how AL BARAKAH LIFESTYLE (“we”, “us”, “our”) collects, uses, stores and protects personal information when you visit albarakah.me, use our mobile application, create an account, place an order, contact us, subscribe to communications or otherwise interact with our services.</p>
      <h2>Information we collect</h2>
      <p>Name, mobile number, email, billing and delivery address, order history, account information, customer-service communications, device and usage information, and information you choose to provide.</p>
      <h2>How we use it</h2>
      <p>Order processing, delivery, customer support, account management, enquiries, service improvement, security, fraud prevention, legal compliance and permitted marketing.</p>
      <h2>Payments</h2>
      <p>Third-party payment providers may process payment information under their own terms.</p>
      <h2>Cookies and analytics</h2>
      <p>Cookies, pixels and analytics may be used for preferences, performance, usage measurement and marketing effectiveness, with appropriate consent where required.</p>
      <h2>Service providers</h2>
      <p>Necessary information may be shared with authorised payment, logistics, hosting, analytics, communications and support providers.</p>
      <h2>Security and retention</h2>
      <p>We use reasonable technical and organisational safeguards, but no internet system is completely secure. Information may be retained as necessary for orders, accounting, tax, legal, regulatory and dispute-resolution purposes.</p>
      <h2>Your choices</h2>
      <p>Subject to applicable law, you may have rights relating to access, correction, deletion, consent withdrawal and grievance handling.</p>
      <h2>International processing</h2>
      <p>Sales and service between India and the Middle East may require cross-border processing, subject to applicable law.</p>
      <h2>Contact</h2>
      <p>{CONTACT.email} · {CONTACT.phone}</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms & Conditions" eyebrow="Legal" path="/terms" image="/media/elarisse-logo-ivory.webp" alt="The ELARISSE emblem in gold">
      <p>These Terms &amp; Conditions govern use of the AL BARAKAH LIFESTYLE website, mobile application, products, services and online ordering.</p>
      <h2>Acceptance</h2>
      <p>Using the website or app, or placing an order, means you accept these Terms, the Privacy Policy and the Shipping &amp; Returns policy.</p>
      <h2>Product information</h2>
      <p>We aim to provide accurate descriptions, images, sizes, prices and availability. Packaging and colour may vary slightly. Product labels and supplied packaging remain authoritative for product-specific information.</p>
      <h2>Fragrance descriptions</h2>
      <p>Individual fragrance perception varies with skin chemistry, environment and preference. Descriptions do not guarantee identical perception for every customer.</p>
      <h2>Prices and orders</h2>
      <p>Prices and availability may change before confirmation. Orders are subject to availability, payment authorisation and verification.</p>
      <h2>Delivery and international charges</h2>
      <p>Delivery covers India and selected Middle East destinations, subject to courier coverage, customs and import requirements. Unless checkout states otherwise, customers may be responsible for destination duties, taxes and local charges.</p>
      <h2>Accounts</h2>
      <p>Customers must keep credentials secure and provide accurate information, and must not interfere with the security of the website or app.</p>
      <h2>Intellectual property</h2>
      <p>Brand names, logos, artwork, photographs, product names and website content belong to AL BARAKAH LIFESTYLE or its licensors.</p>
      <h2>Force majeure</h2>
      <p>We are not responsible for delays caused by events beyond reasonable control.</p>
      <h2>Contact</h2>
      <p>{CONTACT.email} · {CONTACT.phone}</p>
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

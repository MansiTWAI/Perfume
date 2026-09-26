import { Link } from 'react-router-dom';
import Seo, { breadcrumbLd, orgLd } from '../components/Seo';
import { PageHero } from '../components/Bits';
import { Reveal, SplitHeading, ScrollText, Parallax } from '../components/Motion';

export function Story() {
  return (
    <>
      <Seo
        title="Our Story | The House Behind AL BARAKAH LIFESTYLE"
        description="From a young perfume collector to a career in the perfume industry from 2013: the founder's story behind AL BARAKAH LIFESTYLE, a contemporary fragrance house from Hyderabad."
        jsonLd={[orgLd(), breadcrumbLd([['Home', '/'], ['Our Story', '/our-story']])]}
      />
      <PageHero eyebrow="Our story" title="A signature, built from passion" image="/media/elarisse-still.webp" alt="ELARISSE and its presentation box" lede="From a young collector’s curiosity to a contemporary fragrance house in Hyderabad." />
      <section className="section">
        <div className="container story-grid">
          <div className="story-sticky">
            <Reveal><p className="eyebrow">Founder’s statement</p></Reveal>
            <Reveal delay={0.1}>
              <blockquote className="big-quote">“I did not want to create just another perfume. I wanted to create a signature: a fragrance house built from passion, research and the desire to bring a contemporary collection to people who truly appreciate the art of fragrance.”</blockquote>
            </Reveal>
          </div>
          <div className="story-chapters">
            {[
              ['The beginning', 'A collector’s curiosity', 'At a very young age, I started testing my skills through my passionate perfume collection. I was always curious about why certain fragrances felt different, why some stayed in memory and how different raw materials could create completely different impressions.'],
              ['2013', 'Into the perfume industry', 'I always wanted to bring the best possible experience to the perfume industry. That curiosity became a professional path. In 2013, I started my career in the perfume industry and began deeper research into the many raw materials used in perfumery.'],
              ['The learning', 'Creativity, structure, patience', 'The journey has been about continuous learning: understanding materials, experimenting with fragrance directions and observing what people connect with. Great perfumery is a balance between creativity, structure, quality and patience.'],
              ['Today', 'A contemporary house', 'AL BARAKAH LIFESTYLE brings that journey into a contemporary brand. The ambition is to respect the richness of traditional perfumery while creating a collection that feels modern, elegant and distinctive.'],
            ].map(([k, t, p], i) => (
              <Reveal key={k} className="chapter" delay={i * 0.05}>
                <p className="chapter-k">{k}</p>
                <h2>{t}</h2>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="section philosophy">
        <div className="container narrow">
          <ScrollText className="philosophy-text" text="“Al Barakah” is associated with blessing and abundance. In our story, it means adding meaning and beauty to everyday life." />
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <Parallax className="tall-img"><img src="/media/duo-triptych.webp" alt="ELARISSE and ZAFREON" loading="lazy" /></Parallax>
          <div>
            <Reveal><p className="eyebrow">The fragrances</p></Reveal>
            <SplitHeading text="Two sides of one philosophy" />
            <Reveal delay={0.1}>
              <p className="section-lede">ELARISSE explores luminous elegance: ivory, gold, crystal and warmth. ZAFREON takes a darker route: black, gold, oud-inspired textures, incense and the confidence of a deeper presence.</p>
              <p className="section-lede">The world continues into oud, amber, musk, woods and other traditions, each interpreted through a modern lens.</p>
              <div className="btn-row" style={{ marginTop: 28 }}>
                <Link to="/fragrances" className="btn btn-primary">Discover the collection</Link>
                <Link to="/journal/the-art-of-leaving-a-signature" className="btn btn-ghost">Read the manifesto</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}

export function Mission() {
  const goals = [
    'Build a strong and recognisable fragrance identity in India and the United Arab Emirates.',
    'Develop a distinctive contemporary fragrance portfolio.',
    'Make long-lasting fragrance experiences a core product-development priority, supported by quality and consistency.',
    'Explore refined fragrance directions including oud, amber, musk, woods and other established traditions.',
    'Continue research into perfume raw materials and fragrance construction.',
    'Create a premium digital customer journey across website and mobile application.',
    'Expand thoughtfully into beauty and lifestyle.',
    'Build editorial authority through the Journal.',
    'Develop reliable customer service and after-sales processes.',
    'Build long-term customer trust and a recognisable international visual identity.',
  ];
  return (
    <>
      <Seo title="Mission, Vision & Goals | AL BARAKAH LIFESTYLE" description="The mission, vision and 2030 goals of AL BARAKAH LIFESTYLE: a recognised fragrance and lifestyle house in India and the UAE." jsonLd={breadcrumbLd([['Home', '/'], ['Mission & Vision', '/mission-vision']])} />
      <PageHero eyebrow="Mission & vision" title="Toward 2030" layout="split" image="/media/panel-house.webp" alt="ELARISSE and ZAFREON beneath the AL BARAKAH LIFESTYLE arch" lede="A contemporary Indian luxury house with a strong presence in India and the United Arab Emirates." />
      <section className="section">
        <div className="container mv-grid">
          <Reveal className="mv-card">
            <p className="eyebrow">Vision</p>
            <p className="mv-text">To build AL BARAKAH LIFESTYLE into a recognised and respected fragrance and lifestyle house, with a strong presence in India and the United Arab Emirates by 2030, combining contemporary design, fragrance passion, research, product identity and a premium customer experience.</p>
          </Reveal>
          <Reveal className="mv-card" delay={0.1}>
            <p className="eyebrow">Mission</p>
            <p className="mv-text">To create refined fragrance, beauty and lifestyle experiences that help people express individuality, create memories and leave a distinctive personal signature, while continuously learning and respecting the depth and heritage of perfumery.</p>
          </Reveal>
        </div>
      </section>
      <section className="section goals-section">
        <div className="container">
          <div className="section-head">
            <Reveal><p className="eyebrow">2030 goals</p></Reveal>
            <SplitHeading text="Ten commitments" />
          </div>
          <ol className="goals">
            {goals.map((g, i) => (
              <Reveal as="li" key={i} delay={(i % 2) * 0.08}>
                <span className="goal-n">{String(i + 1).padStart(2, '0')}</span>
                <p>{g}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <section className="section philosophy">
        <div className="container narrow">
          <p className="eyebrow center">Brand promise</p>
          <ScrollText className="philosophy-text" text="Every detail should feel intentional. Every product should have a reason to exist. Every customer should understand what they are buying. Every fragrance should have the opportunity to become part of someone’s story." />
        </div>
      </section>
    </>
  );
}

export function Heritage() {
  return (
    <>
      <Seo title="Fragrance Heritage | India, Arabia & the Art of Scent" description="Indian perfumery heritage and Middle Eastern fragrance culture: attar, oud, bakhoor, saffron and jasmine, and how they meet in AL BARAKAH LIFESTYLE." jsonLd={breadcrumbLd([['Home', '/'], ['Fragrance Heritage', '/fragrance-heritage']])} />
      <PageHero eyebrow="Fragrance heritage" title="India, Arabia and the art of scent" image="/media/zafreon-campaign.webp" alt="Saffron, oud wood and incense around ZAFREON" lede="Attar, oud, bakhoor, saffron and jasmine: two great fragrance cultures, and where they meet." />
      <section className="section">
        <div className="container narrow">
          <Reveal><p className="section-lede big">India and the Middle East share one of the oldest fragrance conversations in the world. Spices, woods and resins crossed the Arabian Sea for centuries, and each culture shaped the other.</p></Reveal>
        </div>
      </section>
      <section className="section heritage-split">
        <div className="container heritage-cols">
          <Reveal className="heritage-col">
            <p className="heritage-native" lang="hi">भारत</p>
            <h2>India</h2>
            <p>In Kannauj, attars are still distilled by the traditional <em>deg-bhapka</em> method into a sandalwood base. Indian perfumery gave the world its love of sandalwood, vetiver and mogra jasmine, and in Hyderabad the attar shops of the old city carry that tradition forward.</p>
            <ul className="dash"><li>Attar &amp; ruh</li><li>Sandalwood</li><li>Mogra jasmine</li><li>Mitti, the scent of first rain</li></ul>
          </Reveal>
          <div className="heritage-bridge" aria-hidden="true"><span /></div>
          <Reveal className="heritage-col" delay={0.12}>
            <p className="heritage-native" lang="ar">الجزيرة العربية</p>
            <h2>Arabia</h2>
            <p>In the Gulf, fragrance is hospitality. Guests are welcomed with bakhoor smoke, clothes are perfumed with oud, and the roses of Taif are prized for their spiced, honeyed character.</p>
            <ul className="dash"><li>Oud &amp; dehn al oud</li><li>Bakhoor</li><li>Taif rose</li><li>Frankincense (luban)</li></ul>
          </Reveal>
        </div>
      </section>
      <section className="section philosophy">
        <div className="container narrow">
          <ScrollText className="philosophy-text" text="Heritage provides the soul. Contemporary design gives it a place in today’s world." />
          <div className="center" style={{ marginTop: 40 }}>
            <Link to="/journal/indian-and-middle-eastern-fragrance-heritage" className="btn btn-ghost">Read the full story</Link>
          </div>
        </div>
      </section>
    </>
  );
}

import { Link } from 'react-router-dom';
import Seo, { breadcrumbLd, orgLd } from '../components/Seo';
import { PageHero } from '../components/Bits';
import { Reveal, SplitHeading, ScrollText, Parallax } from '../components/Motion';
import { useStore } from '../context/StoreContext';

// The brand pages carry long-form copy, so each page keeps its English and
// Arabic text together here rather than as scattered dictionary keys.
// The Arabic is a first draft for native review, like lib/i18n.js.

const STORY = {
  en: {
    eyebrow: 'Our story',
    title: 'A signature, built from passion',
    lede: 'From a young collector’s curiosity to a contemporary fragrance house in Hyderabad.',
    quoteLabel: 'Founder’s statement',
    quote: '“I did not want to create just another perfume. I wanted to create a signature: a fragrance house built from passion, research and the desire to bring a contemporary collection to people who truly appreciate the art of fragrance.”',
    chapters: [
      ['The beginning', 'A collector’s curiosity', 'At a very young age, I started testing my skills through my passionate perfume collection. I was always curious about why certain fragrances felt different, why some stayed in memory and how different raw materials could create completely different impressions.'],
      ['2013', 'Into the perfume industry', 'I always wanted to bring the best possible experience to the perfume industry. That curiosity became a professional path. In 2013, I started my career in the perfume industry and began deeper research into the many raw materials used in perfumery.'],
      ['The learning', 'Creativity, structure, patience', 'The journey has been about continuous learning: understanding materials, experimenting with fragrance directions and observing what people connect with. Great perfumery is a balance between creativity, structure, quality and patience.'],
      ['Today', 'A contemporary house', 'AL BARAKAH LIFESTYLE brings that journey into a contemporary brand. The ambition is to respect the richness of traditional perfumery while creating a collection that feels modern, elegant and distinctive.'],
    ],
    meaning: '“Al Barakah” is associated with blessing and abundance. In our story, it means adding meaning and beauty to everyday life.',
    fragrancesLabel: 'The fragrances',
    fragrancesTitle: 'Two sides of one philosophy',
    fragrances: [
      'ELARISSE explores luminous elegance: ivory, gold, crystal and warmth. ZAFREON takes a darker route: black, gold, oud-inspired textures, incense and the confidence of a deeper presence.',
      'The world continues into oud, amber, musk, woods and other traditions, each interpreted through a modern lens.',
    ],
    discover: 'Discover the collection',
    manifesto: 'Read the manifesto',
  },
  ar: {
    eyebrow: 'قصتنا',
    title: 'توقيعٌ وُلد من الشغف',
    lede: 'من فضولٍ مبكر تجاه العطور إلى دار عطور معاصرة في حيدر آباد.',
    quoteLabel: 'كلمة المؤسس',
    quote: '«لم أرد أن أصنع عطراً آخر فحسب، بل أردت أن أصنع توقيعاً: دار عطور قائمة على الشغف والبحث، وعلى الرغبة في تقديم مجموعة معاصرة لمن يقدّرون فن العطر حقاً.»',
    chapters: [
      ['البداية', 'فضول عاشقٍ للعطور', 'في سنّ صغيرة جداً بدأت أختبر مهاراتي من خلال مجموعتي من العطور التي أحببتها. كنت أتساءل دائماً لماذا يبدو بعض العطور مختلفاً، ولماذا يبقى بعضها في الذاكرة، وكيف تصنع المواد الخام المختلفة انطباعات مختلفة تماماً.'],
      ['2013', 'دخول عالم العطور', 'أردت دائماً أن أقدّم أفضل تجربة ممكنة في عالم العطور، فتحوّل ذلك الفضول إلى مسار مهني. في عام 2013 بدأت مسيرتي في صناعة العطور، وتعمّقت في البحث في المواد الخام الكثيرة المستخدمة في العطارة.'],
      ['التعلّم', 'إبداع وبنية وصبر', 'كانت الرحلة تعلّماً مستمراً: فهم المواد، وتجربة اتجاهات عطرية جديدة، وملاحظة ما يتصل به الناس. العطارة العظيمة توازنٌ بين الإبداع والبنية والجودة والصبر.'],
      ['اليوم', 'دار معاصرة', 'تنقل البركة لايف ستايل تلك الرحلة إلى علامة معاصرة. طموحنا أن نحترم ثراء العطارة التقليدية، وأن نصنع مجموعة تبدو عصرية وأنيقة ومميّزة.'],
    ],
    meaning: '«البركة» كلمة ترتبط بالنعمة والوفرة، وهي في قصتنا تعني أن نضيف المعنى والجمال إلى الحياة اليومية.',
    fragrancesLabel: 'العطور',
    fragrancesTitle: 'وجهان لفلسفة واحدة',
    fragrances: [
      'يستكشف ELARISSE الأناقة المضيئة: العاج والذهب والكريستال والدفء. ويسلك ZAFREON طريقاً أعمق: الأسود والذهبي وملامس مستوحاة من العود والبخور وثقة الحضور العميق.',
      'ويمتد هذا العالم إلى العود والعنبر والمسك والأخشاب وتقاليد أخرى، يُعاد تفسير كلٍّ منها برؤية عصرية.',
    ],
    discover: 'اكتشف المجموعة',
    manifesto: 'اقرأ البيان',
  },
};

export function Story() {
  const { lang } = useStore();
  const c = STORY[lang] || STORY.en;
  return (
    <>
      <Seo
        title="Our Story | The House Behind AL BARAKAH LIFESTYLE"
        description="From a young perfume collector to a career in the perfume industry from 2013: the founder's story behind AL BARAKAH LIFESTYLE, a contemporary fragrance house from Hyderabad."
        jsonLd={[orgLd(), breadcrumbLd([['Home', '/'], ['Our Story', '/our-story']])]}
      />
      <PageHero eyebrow={c.eyebrow} title={c.title} image="/media/elarisse-still.webp" alt="ELARISSE and its presentation box" lede={c.lede} />
      <section className="section">
        <div className="container story-grid">
          <div className="story-sticky">
            <Reveal><p className="eyebrow">{c.quoteLabel}</p></Reveal>
            <Reveal delay={0.1}>
              <blockquote className="big-quote">{c.quote}</blockquote>
            </Reveal>
          </div>
          <div className="story-chapters">
            {c.chapters.map(([k, t, p], i) => (
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
          <ScrollText key={c.meaning} className="philosophy-text" text={c.meaning} />
        </div>
      </section>
      <section className="section">
        <div className="container two-col">
          <Parallax className="tall-img"><img src="/media/duo-triptych.webp" alt="ELARISSE and ZAFREON" loading="lazy" /></Parallax>
          <div>
            <Reveal><p className="eyebrow">{c.fragrancesLabel}</p></Reveal>
            <SplitHeading text={c.fragrancesTitle} />
            <Reveal delay={0.1}>
              {c.fragrances.map((p) => <p key={p} className="section-lede">{p}</p>)}
              <div className="btn-row" style={{ marginTop: 28 }}>
                <Link to="/fragrances" className="btn btn-primary">{c.discover}</Link>
                <Link to="/journal/the-art-of-leaving-a-signature" className="btn btn-ghost">{c.manifesto}</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}

const MISSION = {
  en: {
    eyebrow: 'Mission & vision',
    title: 'Toward 2030',
    lede: 'A contemporary Indian luxury house with a strong presence in India and the United Arab Emirates.',
    visionLabel: 'Vision',
    vision: 'To build AL BARAKAH LIFESTYLE into a recognised and respected fragrance and lifestyle house, with a strong presence in India and the United Arab Emirates by 2030, combining contemporary design, fragrance passion, research, product identity and a premium customer experience.',
    missionLabel: 'Mission',
    mission: 'To create refined fragrance, beauty and lifestyle experiences that help people express individuality, create memories and leave a distinctive personal signature, while continuously learning and respecting the depth and heritage of perfumery.',
    goalsLabel: '2030 goals',
    goalsTitle: 'Ten commitments',
    goals: [
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
    ],
    promiseLabel: 'Brand promise',
    promise: 'Every detail should feel intentional. Every product should have a reason to exist. Every customer should understand what they are buying. Every fragrance should have the opportunity to become part of someone’s story.',
  },
  ar: {
    eyebrow: 'الرسالة والرؤية',
    title: 'نحو 2030',
    lede: 'دار فاخرة هندية معاصرة، بحضور قوي في الهند والإمارات العربية المتحدة.',
    visionLabel: 'الرؤية',
    vision: 'أن تصبح البركة لايف ستايل داراً للعطور وأسلوب الحياة معروفةً ومحترمة، بحضور قوي في الهند والإمارات العربية المتحدة بحلول عام 2030، تجمع بين التصميم المعاصر وشغف العطر والبحث وهوية المنتج وتجربة عملاء راقية.',
    missionLabel: 'الرسالة',
    mission: 'أن نصنع تجارب راقية في العطور والجمال وأسلوب الحياة تساعد الناس على التعبير عن فرادتهم وصنع الذكريات وترك توقيع شخصي مميّز، مع التعلّم المستمر واحترام عمق العطارة وإرثها.',
    goalsLabel: 'أهداف 2030',
    goalsTitle: 'عشرة التزامات',
    goals: [
      'بناء هوية عطرية قوية ومعروفة في الهند والإمارات العربية المتحدة.',
      'تطوير مجموعة عطور معاصرة ومميّزة.',
      'جعل العطور التي تدوم طويلاً أولوية أساسية في تطوير المنتجات، مدعومةً بالجودة والثبات.',
      'استكشاف اتجاهات عطرية راقية تشمل العود والعنبر والمسك والأخشاب وتقاليد عريقة أخرى.',
      'مواصلة البحث في المواد الخام للعطور وبناء التركيبات.',
      'صنع رحلة رقمية راقية للعملاء عبر الموقع والتطبيق.',
      'التوسّع المدروس في الجمال وأسلوب الحياة.',
      'بناء مرجعية تحريرية من خلال المجلة.',
      'تطوير خدمة عملاء موثوقة وخدمات ما بعد البيع.',
      'بناء ثقة طويلة الأمد مع العملاء وهوية بصرية عالمية مميّزة.',
    ],
    promiseLabel: 'وعد الدار',
    promise: 'أن يبدو كل تفصيل مقصوداً، وأن يكون لكل منتج سبب لوجوده، وأن يفهم كل عميل ما يشتريه، وأن تتاح لكل عطر فرصة ليصبح جزءاً من قصة أحدهم.',
  },
};

export function Mission() {
  const { lang } = useStore();
  const c = MISSION[lang] || MISSION.en;
  return (
    <>
      <Seo title="Mission, Vision & Goals | AL BARAKAH LIFESTYLE" description="The mission, vision and 2030 goals of AL BARAKAH LIFESTYLE: a recognised fragrance and lifestyle house in India and the UAE." jsonLd={breadcrumbLd([['Home', '/'], ['Mission & Vision', '/mission-vision']])} />
      <PageHero eyebrow={c.eyebrow} title={c.title} layout="split" image="/media/panel-house.webp" alt="ELARISSE and ZAFREON beneath the AL BARAKAH LIFESTYLE arch" lede={c.lede} />
      <section className="section">
        <div className="container mv-grid">
          <Reveal className="mv-card">
            <p className="eyebrow">{c.visionLabel}</p>
            <p className="mv-text">{c.vision}</p>
          </Reveal>
          <Reveal className="mv-card" delay={0.1}>
            <p className="eyebrow">{c.missionLabel}</p>
            <p className="mv-text">{c.mission}</p>
          </Reveal>
        </div>
      </section>
      <section className="section goals-section">
        <div className="container">
          <div className="section-head">
            <Reveal><p className="eyebrow">{c.goalsLabel}</p></Reveal>
            <SplitHeading text={c.goalsTitle} />
          </div>
          <ol className="goals">
            {c.goals.map((g, i) => (
              <Reveal as="li" key={i} delay={(i % 2) * 0.08}>
                <span className="goal-n" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
                <p>{g}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <section className="section philosophy">
        <div className="container narrow">
          <p className="eyebrow center">{c.promiseLabel}</p>
          <ScrollText key={c.promise} className="philosophy-text" text={c.promise} />
        </div>
      </section>
    </>
  );
}

const HERITAGE = {
  en: {
    eyebrow: 'Fragrance heritage',
    title: 'India, Arabia and the art of scent',
    lede: 'Attar, oud, bakhoor, saffron and jasmine: two great fragrance cultures, and where they meet.',
    intro: 'India and the Middle East share one of the oldest fragrance conversations in the world. Spices, woods and resins crossed the Arabian Sea for centuries, and each culture shaped the other.',
    india: {
      title: 'India',
      text: <>In Kannauj, attars are still distilled by the traditional <em>deg-bhapka</em> method into a sandalwood base. Indian perfumery gave the world its love of sandalwood, vetiver and mogra jasmine, and in Hyderabad the attar shops of the old city carry that tradition forward.</>,
      list: ['Attar & ruh', 'Sandalwood', 'Mogra jasmine', 'Mitti, the scent of first rain'],
    },
    arabia: {
      title: 'Arabia',
      text: 'In the Gulf, fragrance is hospitality. Guests are welcomed with bakhoor smoke, clothes are perfumed with oud, and the roses of Taif are prized for their spiced, honeyed character.',
      list: ['Oud & dehn al oud', 'Bakhoor', 'Taif rose', 'Frankincense (luban)'],
    },
    close: 'Heritage provides the soul. Contemporary design gives it a place in today’s world.',
    more: 'Read the full story',
  },
  ar: {
    eyebrow: 'إرث العطور',
    title: 'الهند والجزيرة العربية وفن العطر',
    lede: 'العطر والعود والبخور والزعفران والياسمين: ثقافتان عطريتان عظيمتان، وحيث تلتقيان.',
    intro: 'تتشارك الهند والشرق الأوسط واحداً من أقدم حوارات العطر في العالم. عبرت التوابل والأخشاب والراتنجات بحر العرب لقرون، وشكّلت كل ثقافة الأخرى.',
    india: {
      title: 'الهند',
      text: <>في قنّوج ما زالت العطور تُقطَّر بطريقة <em>ديغ-بهابكا</em> التقليدية على قاعدة من خشب الصندل. أهدت العطارة الهندية العالم حبّ الصندل ونجيل الهند وياسمين الموغرا، وفي حيدر آباد تواصل محلات العطور في المدينة القديمة هذا الإرث.</>,
      list: ['العطر والروح', 'خشب الصندل', 'ياسمين الموغرا', 'متّي، رائحة المطر الأول'],
    },
    arabia: {
      title: 'الجزيرة العربية',
      text: 'في الخليج، العطر ضيافة. يُستقبل الضيوف بدخان البخور، وتُعطَّر الثياب بالعود، ويُقدَّر ورد الطائف لطابعه المتبّل المعسول.',
      list: ['العود ودهن العود', 'البخور', 'ورد الطائف', 'اللبان'],
    },
    close: 'الإرث يمنح الروح، والتصميم المعاصر يمنحه مكاناً في عالم اليوم.',
    more: 'اقرأ القصة كاملة',
  },
};

export function Heritage() {
  const { lang } = useStore();
  const c = HERITAGE[lang] || HERITAGE.en;
  return (
    <>
      <Seo title="Fragrance Heritage | India, Arabia & the Art of Scent" description="Indian perfumery heritage and Middle Eastern fragrance culture: attar, oud, bakhoor, saffron and jasmine, and how they meet in AL BARAKAH LIFESTYLE." jsonLd={breadcrumbLd([['Home', '/'], ['Fragrance Heritage', '/fragrance-heritage']])} />
      <PageHero eyebrow={c.eyebrow} title={c.title} image="/media/zafreon-campaign.webp" alt="Saffron, oud wood and incense around ZAFREON" lede={c.lede} />
      <section className="section">
        <div className="container narrow">
          <Reveal><p className="section-lede big">{c.intro}</p></Reveal>
        </div>
      </section>
      <section className="section heritage-split">
        <div className="container heritage-cols">
          <Reveal className="heritage-col">
            <p className="heritage-native" lang="hi">भारत</p>
            <h2>{c.india.title}</h2>
            <p>{c.india.text}</p>
            <ul className="dash">{c.india.list.map((x) => <li key={x}>{x}</li>)}</ul>
          </Reveal>
          <div className="heritage-bridge" aria-hidden="true"><span /></div>
          <Reveal className="heritage-col" delay={0.12}>
            <p className="heritage-native" lang="ar">الجزيرة العربية</p>
            <h2>{c.arabia.title}</h2>
            <p>{c.arabia.text}</p>
            <ul className="dash">{c.arabia.list.map((x) => <li key={x}>{x}</li>)}</ul>
          </Reveal>
        </div>
      </section>
      <section className="section philosophy">
        <div className="container narrow">
          <ScrollText key={c.close} className="philosophy-text" text={c.close} />
          <div className="center" style={{ marginTop: 40 }}>
            <Link to="/journal/indian-and-middle-eastern-fragrance-heritage" className="btn btn-ghost">{c.more}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

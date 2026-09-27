import { createElement, Fragment } from 'react';

// English is written directly in the components and doubles as the lookup
// key, so the code stays readable. Arabic lives here.
//
// The Arabic copy is a first draft for the brand to review with a native
// editor before launch. Brand and product names stay in Latin letters, as
// they appear on the packaging.

export const LANGS = { en: { dir: 'ltr', label: 'English' }, ar: { dir: 'rtl', label: 'العربية' } };

const AR = {
  // ----- navigation & chrome -----
  'Skip to content': 'انتقل إلى المحتوى',
  Fragrances: 'العطور',
  'Our Story': 'قصتنا',
  Journal: 'المجلة',
  Heritage: 'الإرث',
  Gallery: 'المعرض',
  Contact: 'تواصل معنا',
  Search: 'بحث',
  'Your account': 'حسابك',
  'Sign in': 'تسجيل الدخول',
  'Open menu': 'فتح القائمة',
  'Close menu': 'إغلاق القائمة',
  'Bag, {n} items': 'الحقيبة، {n}',
  'Find your signature': 'اكتشف توقيعك',
  'Track an order': 'تتبّع طلبك',
  'AL BARAKAH LIFESTYLE, home': 'البركة لايف ستايل، الصفحة الرئيسية',
  Primary: 'الرئيسية',
  Menu: 'القائمة',
  'Read in Arabic': 'تصفّح بالعربية',
  'Read in English': 'Read in English',

  // ----- markets -----
  India: 'الهند',
  'United Arab Emirates': 'الإمارات العربية المتحدة',
  'Saudi Arabia': 'المملكة العربية السعودية',
  Qatar: 'قطر',
  Kuwait: 'الكويت',
  Oman: 'عُمان',
  Bahrain: 'البحرين',
  'On request': 'عند الطلب',
  'Deliver to': 'التوصيل إلى',
  'Change country, currently {name}': 'تغيير الدولة، الحالية: {name}',
  'incl. GST': 'شاملة ضريبة السلع والخدمات',
  'incl. 5% VAT': 'شاملة ضريبة القيمة المضافة 5%',
  'Estimated from UAE dirhams': 'سعر تقديري محوّل من الدرهم الإماراتي',
  'Prices are estimates converted from UAE dirhams. We confirm the exact amount on WhatsApp before you pay.':
    'الأسعار تقديرية ومحوّلة من الدرهم الإماراتي، ونؤكد المبلغ النهائي عبر واتساب قبل الدفع.',

  // ----- bag -----
  'Your bag': 'حقيبتك',
  'Close bag': 'إغلاق الحقيبة',
  'Add {amount} for complimentary delivery': 'أضف {amount} لتحصل على توصيل مجاني',
  'Your delivery is {free}': 'التوصيل {free} لطلبك',
  complimentary: 'مجاني',
  'Your bag is waiting for its first signature.': 'حقيبتك بانتظار توقيعها الأول.',
  'Discover the fragrances': 'اكتشف العطور',
  'Remove one {name}': 'إزالة قطعة من {name}',
  'Add one {name}': 'إضافة قطعة من {name}',
  Remove: 'إزالة',
  Subtotal: 'المجموع الفرعي',
  Delivery: 'التوصيل',
  Complimentary: 'مجاني',
  Total: 'الإجمالي',
  'Prices {tax}.': 'الأسعار {tax}.',
  'Delivery to {country} is arranged on request. Checkout will guide you to WhatsApp.':
    'يتم ترتيب التوصيل إلى {country} عند الطلب، وستوجّهك صفحة الطلب إلى واتساب.',
  'Proceed to checkout': 'المتابعة لإتمام الطلب',
  'Sold out': 'نفدت الكمية',
  Signature: 'توقيع',
  Bold: 'جريء',
  Gift: 'هدية',
  'Add to bag': 'أضف إلى الحقيبة',
  '{name} added to your bag': 'تمت إضافة {name} إلى حقيبتك',

  // ----- product page -----
  Home: 'الرئيسية',
  Breadcrumb: 'مسار التنقل',
  Top: 'المقدمة',
  Heart: 'القلب',
  Base: 'القاعدة',
  '{tier} note · {name}': 'نفحة {tier} · {name}',
  'Product images': 'صور المنتج',
  Film: 'فيلم',
  'Decrease quantity': 'إنقاص الكمية',
  'Increase quantity': 'زيادة الكمية',
  'Buy now': 'اشترِ الآن',
  'Currently unavailable': 'غير متوفر حالياً',
  'Only {n} left': 'بقي {n} فقط',
  'In stock, dispatched from Hyderabad': 'متوفر، ويُشحن من حيدر آباد',
  'Delivery to {country}, complimentary over {amount}': 'التوصيل إلى {country}، ومجاني للطلبات فوق {amount}',
  'Delivery to {country} is arranged on request': 'يتم ترتيب التوصيل إلى {country} عند الطلب',
  'Complimentary Signature Card gift note at checkout': 'بطاقة إهداء مجانية عند إتمام الطلب',
  'Ask us on WhatsApp': 'اسألنا عبر واتساب',
  'The composition': 'التركيبة',
  'Inside {name}': 'داخل {name}',
  'Fragrance perception varies with skin, climate and preference.': 'يختلف الإحساس بالعطر باختلاف البشرة والمناخ والذوق.',
  'How it wears': 'كيف يتطوّر على البشرة',
  'From the first spray to the memory': 'من الرشّة الأولى إلى الذكرى',
  'The story': 'الحكاية',
  'Wear it for {list}': 'ارتدِه في {list}',
  'Wear it for': 'ارتدِه في',
  'How to wear': 'طريقة الاستخدام',
  'How to store': 'طريقة الحفظ',
  'What is included': 'محتويات العلبة',
  'Delivery & returns': 'التوصيل والإرجاع',
  'We deliver across India and to the United Arab Emirates. Delivery charges are shown in your bag before checkout. Read our {link}.':
    'نوصل إلى جميع أنحاء الهند وإلى الإمارات العربية المتحدة، وتظهر رسوم التوصيل في حقيبتك قبل إتمام الطلب. اطّلع على {link}.',
  'shipping & returns policy': 'سياسة الشحن والإرجاع',
  'Also from the house': 'من الدار أيضاً',
  'Complete your signature': 'أكمل توقيعك',
  'Eau de Parfum': 'أو دو بارفان',

  // ----- collection -----
  'The collection': 'المجموعة',
  'Each fragrance has its own personality, and every presentation has a purpose.': 'لكل عطر شخصيته، ولكل تقديم غايته.',
  'Filter by fragrance family': 'تصفية حسب عائلة العطر',
  All: 'الكل',
  'Not sure? Take the four-question guide': 'لست متأكداً؟ أجب عن أربعة أسئلة لتجد عطرك',
  'Next from the house': 'القادم من الدار',
  'Coming soon': 'قريباً',
  'A new signature is on its way. The collection will continue into oud, amber, musk and woods, and later into beauty and lifestyle.':
    'توقيع جديد في الطريق. ستمتد المجموعة إلى العود والعنبر والمسك والأخشاب، ثم إلى الجمال وأسلوب الحياة.',
  'Be the first to know': 'كن أول من يعرف',

  // ----- reviews -----
  '{n} out of 5 stars': '{n} من 5 نجوم',
  '{n} verified reviews': '{n} تقييمات موثّقة',
  '{n} verified review': 'تقييم موثّق واحد',
  'Verified reviews': 'تقييمات موثّقة',
  'In their words': 'بكلماتهم',
  'Verified buyer': 'مشترٍ موثّق',
  'From the house': 'من الدار',
  '{name} has no reviews yet. Every review here comes from a delivered order and is read by the house before it appears.':
    'لا توجد تقييمات بعد لعطر {name}. كل تقييم هنا يأتي من طلب تم توصيله، وتقرؤه الدار قبل نشره.',
  'Bought it? Review it from your order': 'اشتريته؟ قيّمه من صفحة طلبك',
  'Please choose a rating.': 'يُرجى اختيار تقييم.',
  'Review your fragrance': 'قيّم عطرك',
  'Your rating': 'تقييمك',
  'Headline (optional)': 'عنوان (اختياري)',
  'In a few words': 'في كلمات قليلة',
  'Your review': 'رأيك',
  'How does it wear on you? When do you reach for it?': 'كيف يبدو على بشرتك؟ ومتى تختاره؟',
  'Only your first name, initial and city are shown. Reviews appear once the house has read them.': 'يظهر اسمك الأول والحرف الأول من اسم العائلة ومدينتك فقط. تظهر التقييمات بعد أن تقرأها الدار.',
  'Submit review': 'إرسال التقييم',

  // ----- contact -----
  '{what} copied': 'تم نسخ {what}',
  'Copying is blocked in this browser. Select the text instead.': 'النسخ غير متاح في هذا المتصفح. حدّد النص بدلاً من ذلك.',
  'Open the business card at full size': 'افتح بطاقة العمل بالحجم الكامل',
  'Phone & WhatsApp': 'الهاتف وواتساب',
  Website: 'الموقع',
  Studio: 'المقر',
  'Copy {what}': 'نسخ {what}',
  Copy: 'نسخ',
  Copied: 'تم النسخ',
  'All details': 'كل البيانات',
  'Save to contacts': 'حفظ في جهات الاتصال',
  'Copy all details': 'نسخ كل البيانات',
  'Download card': 'تنزيل البطاقة',
  'We would love to hear from you': 'يسعدنا أن نسمع منك',
  'Orders, gifting, wholesale and press. We reply personally from Hyderabad.': 'الطلبات والهدايا والجملة والصحافة. نرد عليك شخصياً من حيدر آباد.',
  'Across India and to the United Arab Emirates. Other Gulf countries on request.': 'إلى جميع أنحاء الهند والإمارات العربية المتحدة، ودول الخليج الأخرى عند الطلب.',
  'Hello Al Barakah, I have a question.': 'مرحباً البركة، لدي سؤال.',
  Name: 'الاسم',
  'Phone (optional)': 'الهاتف (اختياري)',
  Topic: 'الموضوع',
  'Product question': 'سؤال عن منتج',
  'Order & delivery': 'الطلب والتوصيل',
  'Gifting & corporate orders': 'الهدايا وطلبات الشركات',
  'Middle East delivery': 'التوصيل إلى الشرق الأوسط',
  'Press & collaborations': 'الصحافة والتعاون',
  Message: 'الرسالة',
  'Thank you. Your message has reached the house and we will reply soon.': 'شكراً لك. وصلت رسالتك إلى الدار وسنرد عليك قريباً.',
  'Sending…': 'جارٍ الإرسال…',
  'Send message': 'إرسال الرسالة',

  // ----- track & account -----
  'Follow the lamps home': 'اتبع القناديل حتى باب بيتك',
  'Enter your tracking ID and the email used at checkout.': 'أدخل رقم التتبّع والبريد الإلكتروني الذي استخدمته عند الطلب.',
  'Tracking ID': 'رقم التتبّع',
  'Email used at checkout': 'البريد الإلكتروني المستخدم عند الطلب',
  'Finding…': 'جارٍ البحث…',
  Track: 'تتبّع',
  'Order {n} · to {place}': 'الطلب {n} · إلى {place}',
  'Expected:': 'الموعد المتوقع:',
  'Courier:': 'شركة الشحن:',
  'Courier tracking': 'تتبّع الشحنة',
  'Order Placed': 'تم تقديم الطلب',
  Confirmed: 'تم التأكيد',
  Packed: 'تم التغليف',
  Shipped: 'تم الشحن',
  'Out for Delivery': 'في الطريق إليك',
  Delivered: 'تم التسليم',
  Account: 'الحساب',
  'Welcome, {name}': 'أهلاً، {name}',
  'Your orders, tracking and details, kept in one place.': 'طلباتك وتتبّعها وبياناتك في مكان واحد.',
  'Create account': 'إنشاء حساب',
  Password: 'كلمة المرور',
  'One moment…': 'لحظة من فضلك…',
  'Open the admin studio': 'فتح لوحة الإدارة',
  'Sign out': 'تسجيل الخروج',
  'Your orders': 'طلباتك',
  'Loading…': 'جارٍ التحميل…',
  'No orders yet.': 'لا توجد طلبات بعد.',

  // ----- journal & gallery -----
  'Stories, rituals and guides': 'قصص وطقوس وأدلّة',
  'A fragrance publication from the house: how to choose, wear and keep a fragrance, the heritage behind the materials, and the story of AL BARAKAH LIFESTYLE.':
    'مجلة عطور من الدار: كيف تختار عطرك وترتديه وتحفظه، والإرث وراء المكوّنات، وقصة البركة لايف ستايل. المقالات منشورة حالياً بالإنجليزية.',
  'Filter by category': 'تصفية حسب الفئة',
  'Brand Stories': 'قصص الدار',
  Guides: 'أدلّة',
  Rituals: 'طقوس',
  'Search the Journal': 'ابحث في المجلة',
  'No articles match “{q}”. Try another word, such as oud or storage.': 'لا توجد مقالات تطابق «{q}». جرّب كلمة أخرى مثل oud أو storage.',
  'Load more stories': 'عرض المزيد',
  'The house, in pictures': 'الدار بالصور',
  'Campaigns, packaging and details from the world of ELARISSE and ZAFREON.': 'حملات وتغليف وتفاصيل من عالم ELARISSE وZAFREON.',
  'Filter gallery': 'تصفية المعرض',
  Brand: 'الهوية',
  Packaging: 'التغليف',
  Campaigns: 'الحملات',
  Details: 'التفاصيل',
  Lifestyle: 'أسلوب الحياة',

  // ----- help pages -----
  Help: 'المساعدة',
  'Questions, answered': 'أسئلة وإجابات',
  'Fragrance, delivery, gifting and care.': 'العطور والتوصيل والإهداء والعناية.',
  'Still wondering? {link}.': 'ما زال لديك سؤال؟ {link}.',
  'Speak with the house': 'تحدّث مع الدار',
  'This page has left no trace': 'هذه الصفحة لم تترك أثراً',
  'The page you are looking for may have moved. Let us take you somewhere memorable.': 'ربما انتقلت الصفحة التي تبحث عنها. دعنا نأخذك إلى مكان لا يُنسى.',
  'Return home': 'العودة إلى الرئيسية',
  'View the fragrances': 'شاهد العطور',

  // ----- signature finder -----
  Back: 'رجوع',
  'Your signature is': 'توقيعك هو',
  'Start again': 'ابدأ من جديد',

  // ----- latest shelf -----
  'New arrivals': 'وصل حديثاً',
  'Latest from the house': 'أحدث ما في الدار',
  'Shop all': 'تسوّق الكل',
  Previous: 'السابق',
  Next: 'التالي',

  // ----- service promise -----
  'Our promise': 'وعدنا',
  'Delivered across {country}': 'توصيل إلى جميع أنحاء {country}',
  'the UAE': 'الإمارات',
  'Complimentary over {amount}': 'مجاناً للطلبات فوق {amount}',
  'Gulf delivery on request': 'التوصيل في الخليج عند الطلب',
  'Arranged personally on WhatsApp.': 'نرتّبه لك شخصياً عبر واتساب.',
  'Secure payment link': 'رابط دفع آمن',
  'We confirm your order first, then send a secure link.': 'نؤكد طلبك أولاً، ثم نرسل لك رابطاً آمناً للدفع.',
  'The Signature Card': 'بطاقة الإهداء',
  'A complimentary printed gift note, in your words.': 'بطاقة إهداء مطبوعة مجاناً، بكلماتك.',
  'A personal concierge': 'مستشار شخصي',
  'Fragrance advice from the house on WhatsApp.': 'نصائح العطور من الدار عبر واتساب.',

  // ----- home -----
  'Luxury perfume house · Hyderabad': 'دار عطور فاخرة · حيدر آباد',
  'Eaux de Parfum shaped by Indian richness and Middle Eastern artistry, for people who want to be remembered.':
    'عطور أو دو بارفان تجمع ثراء الهند وفنون الشرق الأوسط، لمن يريد أن يبقى في الذاكرة.',
  'Discover the collection': 'اكتشف المجموعة',
  'Scroll to open {name}': 'مرّر لتكتشف {name}',
  'Top notes': 'النفحات العليا',
  'The first impression': 'الانطباع الأول',
  'Heart notes': 'نفحات القلب',
  'The character': 'الشخصية',
  'Base notes': 'نفحات القاعدة',
  'The memory': 'الذكرى',
  'Discover {name}': 'اكتشف {name}',
  'The house': 'الدار',
  'Founded on a lifelong passion for perfume and a career in the fragrance industry that began in 2013.':
    'تأسست على شغف دائم بالعطور ومسيرة مهنية في صناعة العطور بدأت عام 2013.',
  'Read our story': 'اقرأ قصتنا',
  'A fragrance is invisible, yet it can become the most recognisable part of a person. We create for that moment: the memory that remains after the room has changed.':
    'العطر لا يُرى، لكنه قد يصبح أكثر ما يُعرف به الإنسان. نصنع لتلك اللحظة: الذكرى التي تبقى بعد أن يتغيّر المكان.',
  'The Collection': 'المجموعة',
  'Two Eaux de Parfum with two personalities. ELARISSE is ivory, luminous and made for daylight. ZAFREON is dark, smoky and made for evenings.':
    'عطران من فئة أو دو بارفان بشخصيتين مختلفتين. ELARISSE عاجيّ ومضيء وصُنع للنهار، وZAFREON داكن ودخانيّ وصُنع للمساء.',
  'Discover the gift set': 'اكتشف طقم الهدايا',
  'The materials': 'المكوّنات',
  'What the bottle holds': 'ما تحمله القارورة',
  'In {list}': 'في {list}',
  ' and ': ' و',
  ', ': '، ',
  'More than a scent.': 'أكثر من عطر.',
  'A signature.': 'إنه توقيع.',
  'Discover the scent': 'اكتشف العطر',
  'Day & night': 'نهار وليل',
  'Two worlds, one house': 'عالمان، دار واحدة',
  Craftsmanship: 'الحِرفة',
  'The bottle is only the beginning': 'القارورة ليست إلا البداية',
  'Luxury is a detail done thoughtfully: the weight of the bottle in the hand, the way the faceted cap catches light, the texture of the box, the first seconds after the fragrance touches skin.':
    'الفخامة تفصيلٌ مدروس: ثقل القارورة في اليد، وانعكاس الضوء على الغطاء المشطوف، وملمس العلبة، واللحظات الأولى بعد أن يلامس العطر البشرة.',
  '100 ml': '100 مل',
  Faceted: 'غطاء',
  'crystal-cut cap': 'بقصّة الكريستال',
  Engraved: 'طوق',
  'gold collar': 'ذهبي منقوش',
  'Ivory & gold': 'علبة تقديم',
  'presentation box': 'بالعاجي والذهبي',
  'India & the Gulf': 'الهند والخليج',
  'From Hyderabad, for India and the Gulf': 'من حيدر آباد، إلى الهند والخليج',
  'Our home is Hyderabad, a city with centuries of ties to Arabia. We deliver across India and to the United Arab Emirates, with prices shown in your currency including tax.':
    'موطننا حيدر آباد، المدينة التي تربطها بالجزيرة العربية صلات تمتد لقرون. نوصل إلى جميع أنحاء الهند وإلى الإمارات العربية المتحدة، وتظهر الأسعار بعملتك شاملة الضريبة.',
  'Delivery · prices in {currency}': 'توصيل · الأسعار بـ{currency}',
  'Order by enquiry · estimate in {currency}': 'الطلب عبر الاستفسار · سعر تقديري بـ{currency}',
  Selected: 'محدّد',
  Select: 'اختيار',
  'The Journal': 'المجلة',
  'All stories': 'كل المقالات',
  'Find the one that becomes yours.': 'اعثر على العطر الذي يصبح لك.',
  'Explore the collection': 'استكشف المجموعة',
  'Take the four-question guide': 'أجب عن أربعة أسئلة لتجد عطرك',
  'Eau de Parfum · by Al Barakah': 'أو دو بارفان · من البركة',
  'Saffron, incense and oud. Dark, polished and unmistakable, a signature for evenings.':
    'زعفران وبخور وعود. داكن وأنيق ولا يُخطئه أحد، توقيعٌ للأمسيات.',
  'Saffron, jasmine and amber. Luminous, graceful and more personal as the day unfolds.':
    'زعفران وياسمين وعنبر. مضيء ورشيق، ويزداد قرباً منك كلما مضى اليوم.',
  'Enter {name}': 'ادخل عالم {name}',
  'A Bold Fragrance · A Higher Story': 'عطر جريء · حكاية أسمى',
  'A Fragrance Beyond Time': 'عطر يتجاوز الزمن',
  'Move between ELARISSE and ZAFREON': 'تنقّل بين ELARISSE وZAFREON',
  Day: 'نهار',
  Night: 'ليل',
  'Drag to cross between worlds': 'اسحب للتنقّل بين العالمين',

  // ----- footer -----
  'A contemporary fragrance house from Hyderabad,': 'دار عطور معاصرة من حيدر آباد،',
  'shaped by Indian richness and Middle Eastern artistry.': 'تشكّلت من ثراء الهند وفنون الشرق الأوسط.',
  'The Journal, by letter': 'المجلة، في بريدك',
  Shop: 'تسوّق',
  'The House': 'الدار',
  Care: 'خدمة العملاء',
  'All fragrances': 'جميع العطور',
  'Mission & Vision': 'الرسالة والرؤية',
  FAQ: 'الأسئلة الشائعة',
  'Shipping & Returns': 'الشحن والإرجاع',
  'Visit & write': 'زورونا وراسلونا',
  WhatsApp: 'واتساب',
  'Fragrances · Beauty · Lifestyle': 'عطور · جمال · أسلوب حياة',
  Privacy: 'الخصوصية',
  Terms: 'الشروط',
  'Email address': 'البريد الإلكتروني',
  'Your email address': 'بريدك الإلكتروني',
  'Joining…': 'جارٍ الاشتراك…',
  Join: 'اشترك',
  'You are on the list. Welcome to the house.': 'تم تسجيلك. أهلاً بك في الدار.',

  // ----- checkout -----
  'Cash on delivery': 'الدفع عند الاستلام',
  'Pay when your order arrives.': 'ادفع عند وصول طلبك.',
  'Pay on confirmation': 'الدفع بعد التأكيد',
  'We confirm your order by WhatsApp or email and send a secure payment link.':
    'نؤكد طلبك عبر واتساب أو البريد الإلكتروني ونرسل لك رابط دفع آمن.',
  'Your order': 'طلبك',
  Checkout: 'إتمام الطلب',
  'Your bag is empty': 'حقيبتك فارغة',
  'Choose a fragrance to begin.': 'اختر عطراً لتبدأ.',
  Country: 'الدولة',
  '(on request)': '(عند الطلب)',
  'Ordering from {country}': 'الطلب من {country}',
  'We are arranging delivery to {country}. Send us your order on WhatsApp and we will confirm availability, delivery time and any duties before you pay.':
    'نعمل على ترتيب التوصيل إلى {country}. أرسل لنا طلبك عبر واتساب وسنؤكد التوفّر ومدة التوصيل وأي رسوم جمركية قبل الدفع.',
  'Send my order on WhatsApp': 'أرسل طلبي عبر واتساب',
  'Full name': 'الاسم الكامل',
  'Mobile (WhatsApp)': 'الجوال (واتساب)',
  Email: 'البريد الإلكتروني',
  Address: 'العنوان',
  'Address line 1': 'العنوان',
  'Address line 2 (optional)': 'تفاصيل إضافية (اختياري)',
  City: 'المدينة',
  State: 'الولاية',
  Emirate: 'الإمارة',
  'PIN code': 'الرمز البريدي',
  'Postal code / P.O. Box': 'الرمز البريدي / صندوق البريد',
  Payment: 'الدفع',
  'Signature Card': 'بطاقة الإهداء',
  'Add a complimentary gift note, printed and placed in the box': 'أضف بطاقة إهداء مجانية تُطبع وتوضع داخل العلبة',
  'Recipient’s name': 'اسم المُهدى إليه',
  Occasion: 'المناسبة',
  'Your message': 'رسالتك',
  'For every room you walk into.': 'لكل مكانٍ تدخله.',
  'Placing your order…': 'جارٍ تقديم طلبك…',
  'Place order · {amount}': 'تأكيد الطلب · {amount}',
  'By placing your order you agree to our {terms} and {privacy}.': 'بتقديم طلبك فإنك توافق على {terms} و{privacy}.',
  'Privacy Policy': 'سياسة الخصوصية',
  Eid: 'العيد',
  Ramadan: 'رمضان',
  Diwali: 'ديوالي',
  Wedding: 'زفاف',
  Birthday: 'عيد ميلاد',
  'Just because': 'بلا مناسبة',

  // ----- order placed -----
  'Thank you': 'شكراً لك',
  'Order {n}': 'الطلب {n}',
  'Your signature is on its way.': 'توقيعك في الطريق إليك.',
  'Thank you. We have received your order and will confirm it shortly by WhatsApp or email.':
    'شكراً لك. استلمنا طلبك وسنؤكده قريباً عبر واتساب أو البريد الإلكتروني.',
  'Your tracking ID': 'رقم التتبّع',
  'Order total {amount}': 'إجمالي الطلب {amount}',
  'Track your order': 'تتبّع طلبك',
  'Message us on WhatsApp': 'راسلنا عبر واتساب',

  // ----- WhatsApp messages (the customer can edit them before sending) -----
  'Hello Al Barakah': 'مرحباً البركة',
  'Hello Al Barakah, I have a question about {name}.': 'مرحباً البركة، لدي سؤال عن {name}.',
  'Hello Al Barakah, I would like help choosing a fragrance.': 'مرحباً البركة، أحتاج مساعدة في اختيار عطر.',
  'Hello Al Barakah, I would like to order {lines} for delivery to {country}.': 'مرحباً البركة، أرغب في طلب {lines} للتوصيل إلى {country}.',
  'Hello Al Barakah, I would like to order from {country}.': 'مرحباً البركة، أرغب في الطلب من {country}.',
  'Hello Al Barakah, I just placed order {n}.': 'مرحباً البركة، قدّمت للتو الطلب {n}.',

  // ----- concierge & language prompt -----
  'Ask our fragrance concierge on WhatsApp': 'اسأل مستشار العطور عبر واتساب',
  'Need help choosing?': 'تحتاج مساعدة في الاختيار؟',
  'Our concierge replies on WhatsApp.': 'مستشارنا يرد عليك عبر واتساب.',
  'Chat with us': 'تحدّث معنا',
  Dismiss: 'إغلاق',
  'Continue in English': 'Continue in English',

  // ----- seasons -----
  'Ramadan Kareem': 'رمضان كريم',
  'Gifts for the holy month': 'هدايا الشهر الفضيل',
  'Send ELARISSE, ZAFREON or the Signature Duo with a printed Ramadan card, in your own words.':
    'أرسل ELARISSE أو ZAFREON أو طقم Signature Duo مع بطاقة رمضانية مطبوعة بكلماتك.',
  'Eid al-Fitr is near': 'عيد الفطر يقترب',
  'Eid al-Adha is near': 'عيد الأضحى يقترب',
  'Order early for Eid': 'اطلب مبكراً للعيد',
  'Eid gifts with a printed Eid Mubarak card. Order early so your gift arrives in time.':
    'هدايا العيد مع بطاقة «عيد مبارك» مطبوعة. اطلب مبكراً لتصل هديتك في موعدها.',
  'Eid Mubarak': 'عيد مبارك',
  'From our house to yours': 'من دارنا إلى داركم',
  'Wishing you a blessed Eid. Add a printed Eid card to any order.': 'كل عام وأنتم بخير. أضف بطاقة عيد مطبوعة إلى أي طلب.',
  'UAE National Day': 'اليوم الوطني الإماراتي',
  'Celebrating the Union': 'احتفاءً بالاتحاد',
  'Saudi National Day': 'اليوم الوطني السعودي',
  'Celebrating the Kingdom': 'احتفاءً بالمملكة',
  'Saudi Founding Day': 'يوم التأسيس',
  'Honouring the founding': 'احتفاءً بيوم التأسيس',
  'Mark the day with a fragrance gift and a personal Signature Card.': 'احتفِ بالمناسبة بهدية عطرية وبطاقة إهداء شخصية.',
  'Choose a gift': 'اختر هدية',
  'Explore the fragrances': 'استكشف العطور',
};

// Arabic product copy, merged over the catalogue by slug.
const PRODUCT_AR = {
  elarisse: {
    tagline: 'عطر يتجاوز الزمن',
    family: 'زهري عنبري مضيء',
    description: 'بعض العطور تُعلن عن نفسها، وبعضها يصبح جزءاً من الذاكرة. صُمّم ELARISSE من النوع الثاني: أنيقٌ من اللقاء الأول، ويزداد قرباً منك كلما مضى اليوم.',
    story: 'في حُلّة من العاج والذهب، يجمع ELARISSE بين العمارة الراقية والضوء الدافئ وصور المكوّنات النفيسة. القارورة الكريستالية الصافية، والسائل الذهبي، والغطاء المنحوت، والعلبة المزخرفة هي ملامحه البصرية. إنه أكثر من عطر؛ إنه أجواء كاملة: دافئ ومشرق ومميّز بهدوء، صُمّم للحظات التي تبدو فيها الأناقة بلا عناء.',
    occasions: ['النهار', 'عقد القران والأعراس', 'صباح العيد', 'العمل', 'التجمّعات العائلية'],
    wear: [
      { time: 'الافتتاحية', label: 'أنيق', text: 'يصل الزعفران والحمضيات أولاً، مشرقين وذهبيين، كالضوء المتسلّل من مشربية.' },
      { time: 'القلب', label: 'مشرق', text: 'يتفتّح الياسمين والورد مع دفء العطر على بشرتك.' },
      { time: 'الأثر', label: 'شخصي', text: 'يبقى العنبر وخشب الصندل والمسك: ناعماً وقريباً ولك وحدك.' },
    ],
    howToWear: 'رشّه مرتين أو ثلاثاً من مسافة 15 سم تقريباً على نقاط النبض مثل الرقبة وباطن المعصمين وخلف الأذنين. ضعه على بشرة مرطّبة بعد الاستحمام مباشرة، واتركه يجف طبيعياً دون فرك المعصمين.',
    howToStore: 'احفظ القارورة في علبتها بعيداً عن أشعة الشمس والحرارة والرطوبة، ورفّ خزانة الملابس هو المكان المثالي. تجنّب الحمّام، ولا تتركه في السيارة أبداً خلال صيف الهند أو الخليج.',
    includes: ['أو دو بارفان 100 مل', 'علبة تقديم بالعاجي والذهبي'],
    faq: [
      { q: 'هل ELARISSE للجنسين؟', a: 'صُمّم ELARISSE لكل من يحب العطور الزهرية العنبرية المضيئة، ويختاره كثيرون توقيعاً نهارياً لهم.' },
      { q: 'ما حجم القارورة؟', a: 'يأتي ELARISSE بحجم 100 مل (3.4 أونصة سائلة) في علبة تقديم بالعاجي والذهبي.' },
      { q: 'هل يمكنني مزجه مع ZAFREON؟', a: 'نعم. رشّة من ZAFREON على المعصمين فوق ELARISSE على الرقبة تمنحك نسخة مسائية أدفأ وأعمق.' },
    ],
    notes: {
      Saffron: 'خيطٌ ذهبي من الدفء يفتتح العطر بثراء هادئ.',
      Bergamot: 'حمضيات إيطالية مشرقة ترفع الرشّة الأولى وتُدخل الضوء.',
      'Pink Pepper': 'بريقٌ وردي ناعم يُبقي الافتتاحية حيوية لا حلوة.',
      'Jasmine Sambac': 'الياسمين الأبيض الكريمي في حدائق الهند وأفنية الجزيرة العربية على السواء.',
      'Taif Rose': 'وردة معسولة متبّلة من مرتفعات الطائف.',
      'Orange Blossom': 'نظيف ومشرق وحلو برقّة؛ التوهّج في قلب التركيبة.',
      Amber: 'دافئ وراتنجي وذهبي؛ التوهّج الذي يبقى على البشرة.',
      Sandalwood: 'أخشاب ناعمة كريمية لها تاريخ طويل في العطارة الهندية.',
      'White Musk': 'لمسة نظيفة كالبشرة تجعل العطر شخصياً.',
      Vanilla: 'حلاوة ناعمة مستديرة تضع كل شيء في مكانه.',
    },
  },
  zafreon: {
    tagline: 'عطر جريء · حكاية أسمى',
    family: 'شرقي خشبي بالعود',
    description: 'داكن وأنيق ولا يُخطئه أحد. صُمّم ZAFREON لمن يريد أن يصبح العطر جزءاً من حضوره، شيئاً يُحَسّ قبل أن يُفهم تماماً.',
    story: 'هويته السوداء والذهبية هي التعبير الأكثر درامية عن دار البركة. خشب العود والزعفران والبخور والمعدن المصقول والمخمل العنّابي هي مفردات عالمه. ZAFREON دراسةٌ في التباين: الظلام والنور، والأصالة والحداثة، والعمق والرقيّ. إنه توقيعٌ للأمسيات والمناسبات، وللحظات التي تستحق فيها فرادتك أن تُذكر.',
    occasions: ['الأمسيات', 'حفلات الأعراس والاستقبال', 'ليالي العيد', 'الشتاء', 'المناسبات الخاصة'],
    wear: [
      { time: 'الافتتاحية', label: 'متوهّج', text: 'يبدأ الزعفران والهيل والفلفل أولاً، كعود ثقاب يُشعَل في غرفة مظلمة.' },
      { time: 'القلب', label: 'دافئ', text: 'يتصاعد البخور والورد الداكن ثم يستقرّان مع دفء العطر.' },
      { time: 'الأثر', label: 'لا يُنسى', text: 'يترك العود والعنبر والأخشاب المدخّنة الانطباع الذي يتذكّره الناس.' },
    ],
    howToWear: 'ZAFREON عطر غنيّ، فابدأ برشّتين: واحدة عند أسفل الرقبة وأخرى على الصدر أو باطن المعصم. في الحرّ، رشّه مرة واحدة على الملابس بعيداً عن البشرة. وعلى الطريقة الخليجية، يتألّق عند وضعه فوق دهن عود خفيف.',
    howToStore: 'احفظه قائماً في علبته بعيداً عن أشعة الشمس والحرارة والرطوبة. التركيبات الغنية مثل ZAFREON تنضج بجمال عند حفظها جيداً.',
    includes: ['أو دو بارفان 100 مل', 'علبة تقديم بالأسود والذهبي'],
    faq: [
      { q: 'هل ZAFREON للمساء فقط؟', a: 'صُمّم توقيعاً للأمسيات والمناسبات، لكن رشّة واحدة تناسب الأيام الباردة أيضاً.' },
      { q: 'هل ZAFREON عطر رجالي؟', a: 'لا. ZAFREON لكل من ينجذب إلى طابع داكن خشبي بالزعفران والعود.' },
      { q: 'ما حجم القارورة؟', a: 'يأتي ZAFREON بحجم 100 مل (3.4 أونصة سائلة) أو دو بارفان.' },
    ],
    notes: {
      Saffron: 'زعفران، كيسر: عميق وجلديّ وذهبي. توقيع الدار.',
      Cardamom: 'توابل خضراء منعشة، رائحة القهوة العربية والشاي الهندي بالتوابل.',
      'Black Pepper': 'شرارة جافة تزيد الافتتاحية حدّة.',
      Frankincense: 'اللبان. دخان راتنجي يستحضر البخور المتصاعد في المجلس.',
      'Damask Rose': 'وردة مخملية أدكن تمنح القلب عمقه.',
      Leather: 'ليّن ومصقول؛ الثقة في قلب التركيبة.',
      Oud: 'خشب العود: داكن ونفيس، روح العطارة العربية.',
      Patchouli: 'ترابيّ وداكن، يمنح القاعدة ثقلها.',
      Amber: 'دفء راتنجي يلفّ الأخشاب بالذهب.',
      'Smoked Woods': 'أخشاب جافة مصقولة تبقى طويلاً بعد مغادرتك المكان.',
    },
  },
  'signature-duo': {
    tagline: 'توقيعان · فلسفة واحدة',
    family: 'طقم هدايا',
    description: 'الداران في هدية واحدة: ELARISSE للأيام المضيئة وZAFREON للأمسيات التي لا تُنسى. ثنائي مختار بعناية للأعراس والعيد وديوالي، أو لمن يستحق الاثنين معاً.',
    story: 'يستكشف ELARISSE الأناقة المضيئة: العاج والذهب والكريستال والدفء. ويسلك ZAFREON طريقاً أعمق: الأسود والذهبي وملامس مستوحاة من العود والبخور. معاً يعبّران عن فلسفة الدار كاملة. ارتدِ الأول نهاراً والآخر ليلاً، أو امزجهما لتصنع شيئاً خاصاً بك.',
    occasions: ['الأعراس', 'العيد', 'ديوالي', 'الذكرى السنوية', 'هدايا الشركات'],
    wear: [
      { time: 'نهاراً', label: 'ELARISSE', text: 'زعفران وياسمين وعنبر مضيء للنهار والاحتفالات.' },
      { time: 'ليلاً', label: 'ZAFREON', text: 'زعفران وبخور وعود لأمسيات تستحق أن تُذكر.' },
      { time: 'ممزوجاً', label: 'على طريقتك', text: 'ZAFREON على المعصمين فوق ELARISSE على الرقبة: دافئ وعميق وشخصي.' },
    ],
    howToWear: 'ارتدِ ELARISSE نهاراً وZAFREON ليلاً، أو امزجهما: ZAFREON على المعصمين فوق ELARISSE على الرقبة.',
    howToStore: 'احفظ القارورتين في علبتيهما بعيداً عن أشعة الشمس والحرارة والرطوبة.',
    includes: ['ELARISSE أو دو بارفان 100 مل', 'ZAFREON أو دو بارفان 100 مل', 'بطاقة إهداء اختيارية'],
    faq: [{ q: 'هل يمكنني إضافة بطاقة إهداء؟', a: 'نعم. عند إتمام الطلب يمكنك إضافة بطاقة إهداء تحمل اسم المُهدى إليه والمناسبة وسطراً شخصياً، تُطبع وتوضع داخل العلبة.' }],
  },
};

const NOTE_AR = {
  Saffron: 'زعفران', Bergamot: 'برغموت', 'Pink Pepper': 'فلفل وردي', 'Jasmine Sambac': 'ياسمين سامباك',
  'Taif Rose': 'ورد طائفي', 'Orange Blossom': 'زهر البرتقال', Amber: 'عنبر', Sandalwood: 'خشب الصندل',
  'White Musk': 'مسك أبيض', Vanilla: 'فانيليا', Cardamom: 'هيل', 'Black Pepper': 'فلفل أسود',
  Frankincense: 'لبان', 'Damask Rose': 'ورد دمشقي', Leather: 'جلد', Oud: 'عود', Patchouli: 'باتشولي',
  'Smoked Woods': 'أخشاب مدخّنة',
};

export const INGREDIENT_AR = {
  Saffron: { label: 'الزعفران', names: 'كيسر · زعفران', story: 'خيوط تُقطف باليد، ثمينة في مطابخ كشمير وأسواق الجزيرة العربية على السواء. يفتتح الزعفران عطرينا بدفء ذهبي جلديّ.' },
  'Jasmine Sambac': { label: 'الياسمين', names: 'موغرا · ياسمين', story: 'الزهرة البيضاء في أكاليل الأعراس الهندية وأفنية البيوت العربية. كريميّ ومضيء، وهو قلب ELARISSE.' },
  Amber: { label: 'العنبر', names: 'عنبر', story: 'دافئ وراتنجي وذهبي مثل السائل في القارورة. العنبر هو التوهّج الذي يبقى على البشرة طويلاً بعد الرشّة الأولى.' },
  Frankincense: { label: 'اللبان', names: 'لوبان · لبان', story: 'راتنج المبخرة وقنديل المعبد. يتصاعد دخانه في قلب ZAFREON.' },
  Oud: { label: 'العود', names: 'أغار · عود', story: 'خشب العود الداكن الذي سافر لقرون من غابات آسام إلى الجزيرة العربية. يمنح العود ZAFREON عمقه وأثره.' },
};

const warned = new Set();

// t('Only {n} left', { n: 3 }). Values may be React nodes; the result is then
// an array of keyed fragments instead of a string.
export function translate(lang, key, vars) {
  let s = key;
  if (lang === 'ar') {
    if (key in AR) s = AR[key];
    else if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] no Arabic for "${key}"`);
    }
  }
  if (!vars) return s;
  const parts = s.split(/(\{\w+\})/);
  const rich = Object.values(vars).some((v) => v !== null && typeof v === 'object');
  const filled = parts.map((p) => {
    const m = p.match(/^\{(\w+)\}$/);
    return m && m[1] in vars ? vars[m[1]] : p;
  });
  return rich ? filled.map((p, i) => createElement(Fragment, { key: i }, p)) : filled.join('');
}

// Merges the Arabic copy over a product: the product's own Arabic fields
// (entered in the admin) first, then the built-in copy, then English. Note
// names stay in English (they key icons and ingredient links) and gain an
// Arabic `label`.
export function localizeProduct(p, lang) {
  if (lang !== 'ar' || !p) return p;
  const { notes: noteText = {}, ...builtIn } = PRODUCT_AR[p.slug] || {};
  const own = Object.fromEntries(
    Object.entries(p.ar || {}).filter(([, v]) => (Array.isArray(v) ? v.length : typeof v === 'string' && v.trim()))
  );
  const copy = { ...builtIn, ...own };
  const notes = p.notes && Object.fromEntries(
    Object.entries(p.notes).map(([tier, list]) => [
      tier,
      Array.isArray(list) ? list.map((n) => ({ ...n, label: NOTE_AR[n.name] || n.name, description: noteText[n.name] || n.description })) : list,
    ])
  );
  return { ...p, ...copy, subtitle: p.subtitle === 'Eau de Parfum' ? AR['Eau de Parfum'] : p.subtitle, notes };
}

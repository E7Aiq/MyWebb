# تقرير تقني لهيكل واجهة المستخدم — alzobaidi.me

> توثيق حرفي للحالة البصرية الحالية، مستخرَج من ملفات الواجهة الأمامية فقط. لا يتضمّن أي منطق خلفي أو مسارات API. القيم منقولة كما هي في المصدر.

نطاق التحليل: خمس صفحات HTML (`index.html`، `articles.html`، `article.html`، `projects.html`، `project-details.html`) وستّة ملفات CSS وملفات JavaScript للتفاعل والعرض.

---

## ١. التقنيات المستخدمة (Tech Stack)

| الطبقة | التقنية |
|---|---|
| البنية | HTML5 ثابت (Static)، بلا مولّد مواقع ولا قوالب خادمية |
| الأنماط | **CSS مخصّص بالكامل (Custom CSS)** — لا Tailwind، لا Bootstrap، ولا أي إطار CSS |
| المتغيرات | CSS Custom Properties (متغيّرات `:root`) كطبقة تصميم موحّدة |
| فضاء الألوان | **OKLCH** (لا HSL/RGB في طبقة المصدر) |
| JavaScript | **Vanilla JS** خالص، بلا React/Vue/jQuery أو أي مكتبة |
| البناء | لا Bundler ولا خطوة بناء (No build step) — الملفات تُخدم كما هي |
| الخطوط | خطوط محلّية (`@font-face`) بصيغة `woff2`، بلا CDN خارجي |
| الاتجاه | RTL افتراضي (`<html lang="ar" dir="rtl">`) مع طبقة تبديل لغة عربي/إنجليزي |

**ملفات CSS:** `style.css` (الأساس)، `article.css`، `project.css`، `responsive.css`، `animations.css`.
**ملفات JS:** `main.js`، `animations.js`، `effects.js`، `projects.js`، `js/i18n.js`، `js/article.js`، `js/articles-list.js`، `js/project.js`.

---

## ٢. الألوان (Color Palette)

النظام مبنيّ على سلّمين من ١٢ درجة (رمادي دافئ + لازورد) في OKLCH، فوقهما طبقة أسماء دلالية. أدناه القيم كما هي في المصدر؛ الأكواد Hex مذكورة حيث تعطيها التعليقات كمراسٍ للسلّم.

### الوضع الفاتح (Light — الافتراضي)

**السلّم الرمادي (Neutrals):**

| الرمز | OKLCH | Hex (مرساة) | الدور |
|---|---|---|---|
| `--n-1` | `oklch(97.7% 0.003 90)` | `#F9F8F6` | أرضية الصفحة (الورق) |
| `--n-2` | `oklch(96.2% 0.004 90)` | — | سطح مرفوع |
| `--n-3` | `oklch(93.8% 0.005 95)` | — | خلفية عنصر (ساكن) |
| `--n-4` | `oklch(91.0% 0.006 110)` | — | خلفية عنصر (تحويم) |
| `--n-5` | `oklch(88.0% 0.007 140)` | — | خلفية عنصر (مضغوط) |
| `--n-6` | `oklch(84.5% 0.008 200)` | — | حدّ خفيف |
| `--n-7` | `oklch(78.0% 0.010 235)` | — | حدّ تفاعلي |
| `--n-8` | `oklch(68.0% 0.012 248)` | — | حدّ قوي + حلقة التركيز |
| `--n-9` | `oklch(56.0% 0.013 252)` | — | نص باهت |
| `--n-10` | `oklch(50.5% 0.014 253)` | — | — |
| `--n-11` | `oklch(45.2% 0.014 254)` | `#5B6169` | نص خافت (muted) |
| `--n-12` | `oklch(21.2% 0.007 264)` | `#16181C` | نص أساسي |

**سلّم اللكنة (لازورد Azure) — اللون التمييزي الوحيد:**

| الرمز | OKLCH | Hex (مرساة) | الدور |
|---|---|---|---|
| `--a-3` | `oklch(95.4% 0.020 266)` | — | لكنة هادئة (خلفية) |
| `--a-6` | `oklch(85.0% 0.060 266)` | — | خطّ اللكنة |
| `--a-9` | `oklch(39.5% 0.132 266)` | `#2A4A9B` | التعبئة الصلبة (الزر الأساسي) |
| `--a-10` | `oklch(33.5% 0.128 266)` | — | تعبئة التحويم |
| `--a-11` | `oklch(44.0% 0.140 266)` | — | نص اللكنة |

**ألوان الحالة:**

| الرمز | OKLCH |
|---|---|
| `--red-9` | `oklch(52.0% 0.180 27)` |
| `--red-11` | `oklch(48.0% 0.170 27)` |
| `--green-9` | `oklch(52.0% 0.110 155)` |
| `--green-11` | `oklch(45.0% 0.100 155)` |

### الوضع الداكن (Dark — عبر `[data-theme="dark"]`)

| الرمز | OKLCH | Hex (مرساة) | الدور |
|---|---|---|---|
| `--n-1` | `oklch(17.8% 0.007 265)` | `#101216` | أرضية الليل |
| `--n-12` | `oklch(94.5% 0.004 95)` | — | نص أساسي |
| `--a-9` | `oklch(72.7% 0.104 274)` | `#93A9F2` | التعبئة الصلبة |

باقي درجات الوضع الداكن معرّفة بين هذين الطرفين بنفس المنطق.

### الأسماء الدلالية (ما تقرأه المكوّنات فعلياً)

```
--bg-canvas         = --n-1      (خلفية الصفحة)
--bg-surface        = --n-2
--bg-element        = --n-3      (خلفية الأزرار الثانوية/الحقول)
--bg-element-hover  = --n-4
--bg-element-active = --n-5
--bg-glass          = color-mix(in oklab, --n-1 70%, transparent)  (شريط التنقل الزجاجي)

--border-subtle      = --n-6
--border-interactive = --n-7
--border-strong      = --n-8

--text          = --n-12   (نص أساسي)
--text-muted    = --n-11   (نص ثانوي)
--text-faint    = --n-9    (نص باهت/placeholder)
--text-on-solid = --n-1    (نص فوق الأزرار الملوّنة)

--solid       = --a-9      (لون الزر الأساسي)
--solid-hover = --a-10
--accent-text = --a-11     (الروابط والعناصر النشطة)
--focus       = --a-8      (حلقة التركيز)
```

### الظلال (Shadows) — ثلاث طبقات مصبوغة نحو الحبر (Hue 264)

```
--shadow-1:
  0 0 0 1px  (l=21% c=0.012 h=264 / .06),
  0 1px 2px -1px  (... / .10),
  0 6px 12px -8px (... / .18);

--shadow-2:
  0 0 0 1px  (... / .07),
  0 2px 4px -2px  (... / .12),
  0 18px 32px -18px (... / .26);
```
(في الوضع الداكن الظلّ أسود غير مصبوغ بعتامات ‎.40/.50/.60‎.)

---

## ٣. الخطوط (Typography)

### عائلات الخطوط

خط **ثمانية (Thmanyah)** بثلاث نسخ، لكلٍّ دور واحد:

| المتغيّر | العائلة | الدور | البديل |
|---|---|---|---|
| `--font-display` | `Thmanyah Display` (Serif Display) | العناوين ≥ 28px | `Georgia, serif` |
| `--font-text` | `Thmanyah Text` (Serif Text) | نصوص القراءة والمتن | `Georgia, serif` |
| `--font-sans` | `Thmanyah Sans` | الواجهة (أزرار، تنقل، ميتا) | `system-ui, sans-serif` |
| `--font-mono` | — | الشيفرة | `ui-monospace, 'SF Mono', Menlo, Consolas` |

**الأوزان المحمَّلة (`@font-face`):** 300 (Light)، 400 (Regular)، 500 (Medium)، 700 (Bold)، 900 (Black) — لكل عائلة، كل وزن بملفه المستقل. صيغة `woff2`، `font-display: swap`، مع بدائل معدَّلة المقاييس (`size-adjust` / `ascent-override` / `descent-override`) لمنع قفزة التخطيط.

### سلّم الأحجام (Type Scale)

| المتغيّر | القيمة | بالبكسل (تقريب) | الاستخدام |
|---|---|---|---|
| `--t-mega` | `clamp(3.25rem, 9.5vw, 6.5rem)` | 52 → 104 | افتتاحية الصفحة (`.page-title`) |
| `--t-hero` | `clamp(2.75rem, 8vw, 5.5rem)` | 44 → 88 | الاسم في الرئيسية (`.name-ar`) |
| `--t-title` | `clamp(2.25rem, 5vw, 3.25rem)` | 36 → 52 | عنوان قسم |
| `--t-lead` | `clamp(1.75rem, 3.6vw, 2.5rem)` | 28 → 40 | عنوان عنصر في الفهرس |
| `--t-h2` | `1.75rem` | 28 | عنوان مستوى ثانٍ (العتبة) |
| `--t-h3` | `1.375rem` | 22 | عنوان مستوى ثالث |
| `--t-lede` | `1.3125rem` | 21 | المقدمة/العنوان الفرعي |
| `--t-card` | `1.25rem` | 20 | عنوان البطاقة |
| `--t-body` | `1.125rem` | 18 | المتن |
| `--t-ui` | `0.9375rem` | 15 | نص الواجهة |
| `--t-meta` | `0.8125rem` | 13 | الميتا/الوسوم |

### ربط العناوين بالأحجام والأوزان

| العنصر | العائلة | الحجم | الوزن | ارتفاع السطر |
|---|---|---|---|---|
| `.page-title` (H1 افتتاحي) | Display | `--t-mega` | 700 | `--lh-mega` = 1.1 |
| `.name-ar` (اسم الهيرو) | Display | `--t-hero` | 700 | 1.15 |
| عنوان القسم / `.article-title` | Display | `--t-title` | 700 | `--lh-head` = 1.28 |
| `h1, h2` (عام) | Display | حسب السياق | 700 | 1.28 |
| `h2` المتن | Display | `--t-h2` (28px) | 700 | 1.28 |
| `h3, h4, h5, h6` | **Text** | `--t-h3` فأصغر | — | — |
| `.project-card-title` | Text | `--t-lede` | 700 | 1.45 |

### النصوص العادية

| العنصر | العائلة | الحجم | ارتفاع السطر |
|---|---|---|---|
| `p, li, blockquote, dd` | Text | `--t-body` (18px) | `--lh-body` = **2.0** |
| المقدمة `.lede` / `.page-subtitle` | Text | `--t-lede` (21px) | `--lh-lede` = 1.95 |
| متن المقال `article p` | Text | `1.3125rem` (≈21px، عبر تجاوز في `article.css`) | 2.0 |
| نص الواجهة (أزرار/روابط) | Sans | `--t-ui` (15px) | `--lh-ui` = 1.5 |
| الميتا/التواريخ | Sans / Text | `--t-meta` (13px) | — |

قيم ارتفاع السطر للاتينية (`:root:lang(en)`) أقصر: body = 1.65، lede = 1.55، head = 1.15.

### خصائص OpenType

- `salt` (الأحرف المرسلة): مطبَّقة عبر `.swash` في موضع واحد فقط (كلمة «محمد» في اسم الهيرو).
- لا `-webkit-font-smoothing`، لا `font-style: italic`، لا `text-transform`.
- `letter-spacing` سالب للاتينية فقط (`:lang(en)`)، والعربية بلا تتبّع.

---

## ٤. نظام التخطيط (Layout System)

**هجين Grid + Flexbox:** الشبكة (Grid) للتخطيطات الكبرى وشبكات البطاقات؛ Flexbox للمكوّنات الداخلية والصفوف.

### الشبكات الرئيسية (CSS Grid)

| السياق | `grid-template-columns` |
|---|---|
| عمود قراءة المقال/الصفحة | شبكة مسمّاة المسارات: `[content-start] min(var(--measure), 100% − gutter×2) [content-end]` مع مساري `bleed` و`rail` جانبيين |
| شبكة المشاريع `.projects-grid` | `repeat(auto-fit, minmax(min(22rem, 100%), 1fr))` |
| شبكة داخلية (مقال) | `repeat(auto-fit, minmax(min(16rem, 100%), 1fr))` |
| قسم بعمود جانبي (`≥76rem`) | `15rem minmax(0, 1fr)` |
| قسم مزدوج | `1.6fr 1fr` |
| شبكة رباعية | `repeat(4, 1fr)` |

### Flexbox

يُستخدم في: شريط التنقل (`.nav-container`, `.nav-links`, `.nav-actions`)، الأزرار (`.btn`)، محتوى البطاقة (`.project-card`, `.project-card-content`)، صفوف الميتا والتصنيفات والإجراءات.

### الاستجابة (Responsive)

الموقع **متجاوب بالكامل**، بمنهج mobile-first ووحدات نسبية (`rem`, `vw`, `clamp`, `%`). نقاط الكسر المستخدمة (بوحدة `rem`):

| نقطة الكسر | ≈ بكسل | الاستخدام |
|---|---|---|
| `max-width: 30rem` | 480 | جوال صغير |
| `max-width: 36rem` | 576 | جوال |
| `max-width: 48rem` | 768 | لوحي/جوال كبير |
| `min-width: 48.0625rem` | 769 | مكتب فما فوق |
| `min-width: 60rem` | 960 | تفعيل النزيف الجانبي وإيقاع أوسع |
| `max-width: 75.99rem` / `min-width: 76rem` | 1216 | تفعيل العمود الجانبي (الهامش) |

كما تُستخدم استعلامات القدرات: `(hover: hover) and (pointer: fine)`، `(pointer: coarse)`، `(hover: none)`، و`prefers-reduced-motion`.

**عرض عمود القراءة (`--measure`):** الأساس `28.2rem` على `:root`؛ ويُجاوَز إلى `75rem` في صفحات المقال/المشروع (`article.css`)، `58rem` في تفاصيل المشروع، `46rem` في فهرس المقالات (`.publication`).

---

## ٥. نظام المسافات (Spacing)

سلّم موحّد أساسه **4px**، بمتغيّرات `--s-*`:

| المتغيّر | rem | px |
|---|---|---|
| `--s-1` | 0.25 | 4 |
| `--s-2` | 0.5 | 8 |
| `--s-3` | 0.75 | 12 |
| `--s-4` | 1 | 16 |
| `--s-6` | 1.5 | 24 |
| `--s-8` | 2 | 32 |
| `--s-12` | 3 | 48 |
| `--s-16` | 4 | 64 |
| `--s-24` | 6 | 96 |
| `--s-32` | 8 | 128 |

**قيم مشتقّة:**
- `--gutter: clamp(1.25rem, 4vw, 2.5rem)` — الحاشية الأفقية للصفحة (20 → 40px).
- `--rhythm: --s-16` (64px جوال) ويصير `--s-24` (96px) عند `≥60rem` — إيقاع الفراغ بين الأقسام.
- الفجوات في الشبكات: مثال `.projects-grid` → `gap: var(--s-16) var(--s-8)` (64px رأسي / 32px أفقي).

### أنصاف الأقطار (Border Radius)

| المتغيّر | القيمة | الاستخدام |
|---|---|---|
| `--r-control` | `8px` | الحقول، القوائم، الأزرار الصغيرة |
| `--r-card` | `16px` | البطاقات وأغلفة الصور |
| `--r-pill` | `9999px` | الأزرار الرئيسية (شكل الحبّة) |

### رموز الحركة (Motion)

```
--dur-fast: 140ms    --dur-mid: 220ms    --dur-slow: 380ms
--ease-out:    cubic-bezier(.2, 0, 0, 1)
--ease-in:     cubic-bezier(.4, 0, 1, 1)
--ease-spring: cubic-bezier(.34, 1.25, .64, 1)
```

---

## ٦. المكوّنات (UI Components)

### شريط التنقل (Navbar)

- `.navbar`: شريط علوي بارتفاع `--nav-h` = `4rem` (64px)، خلفية زجاجية (`--bg-glass` + `backdrop-filter: blur`)، مع بديل صلب عند غياب دعم `backdrop-filter`. يكتسب `--shadow-1` عند التمرير (`.is-scrolled`).
- `.nav-container`: Flex، `justify-content: space-between`، `align-items: center`.
- `.logo`: Sans، 18px، وزن 700، بمنطقة لمس `min-block-size: 2.75rem` (44px).
- `.nav-link`: Sans، وزن 500، لون `--text-muted`، مع خطّ سفلي متحرّك (`::after`, `scaleX`, `transform-origin` يتبع اتجاه اللغة). الحالة النشطة `.active` بلون `--accent-text`.
- `.mobile-toggle`: زر ثلاثة خطوط (Hamburger) يظهر على الجوال، كل خط `22px × 1.5px`.

### الأزرار (Buttons)

قاعدة `.btn`: Flex متمركز، ارتفاع أدنى `2.75rem` (44px)، حشو `0.6875rem` رأسي و`--s-6` (24px) أفقي، `--r-pill`، Sans وزن 500، `white-space: nowrap`. عند الضغط `transform: scale(0.97)`.

| النوع | الخلفية | النص | الحدّ/الظلّ |
|---|---|---|---|
| `.btn-primary` | `--solid` | `--text-on-solid` | `--shadow-1` → `--shadow-2` عند التحويم |
| `.btn-secondary` | `--bg-element` | `--text` | خلفية أغمق عند التحويم/الضغط |
| `.btn-outline` | شفّاف | `--accent-text` | `inset 0 0 0 1.5px --border-interactive` |

زر بطاقة أصغر `.project-card-btn`: ارتفاع أدنى `2.5rem` (40px)، حجم `--t-meta`، `--r-pill`.

### البطاقات (Cards)

بطاقة المشروع `.project-card`:
- حاوية Flex عمودية، `--r-card` (16px)، خلفية شفّافة، رابط ممدود (stretched link) يغطّي البطاقة.
- `.project-card-image-wrapper`: `aspect-ratio: 16 / 10`، `overflow: hidden`، `--r-card`، `--shadow-1`، والصورة `object-fit: cover`.
- عند التحويم (على الأجهزة المؤشِّرة): الصورة `translateY(-2px)` + `--shadow-2`، والعنوان يتحوّل إلى `--accent-text`.
- `.project-card-title`: Text، `--t-lede`، وزن 700، `text-wrap: balance`.
- `.project-card-summary`: Text، `--t-ui`، مقصوص إلى 3 أسطر (`-webkit-line-clamp: 3`).
- صفّ الميتا/التصنيفات: Flex ملتفّ، `--t-meta`، مع فاصل نقطة `·` بين العناصر غير الفارغة.

الحاوية `.projects-grid`: Grid، `repeat(auto-fit, minmax(min(22rem, 100%), 1fr))`، وتنهار إلى عمود واحد عند `max-width: 48rem`.

### الحقول والنماذج (Forms)

`textarea, input[type="text"], input[type="email"]`:
- عرض 100%، حشو `--s-3 --s-4` (12/16px)، خلفية `--bg-surface`.
- بلا `border` تقليدي؛ الحدّ عبر `box-shadow: inset 0 0 0 1px --border-interactive`، ويصير `--border-strong` عند التحويم.
- `--r-control` (8px)، Sans، حجم `max(1rem, --t-ui)` (16px حدّ أدنى)، `resize: vertical`.
- `::placeholder` بلون `--text-faint`.

### حلقة التركيز (Focus Ring)

`:where(:focus-visible)`: `outline: 2px solid var(--focus)` بإزاحة `outline-offset: 2px` — موحّدة على كل العناصر التفاعلية.

### مكوّنات إضافية

- **شريط الشعارات اللانهائي (Marquee):** حاوية موحّدة 72px مكتب / 56px جوال، `--r-card` (radius 22%)، `object-fit: contain`، حركة أفقية مستمرّة.
- **مبدّل اللغة (`.lang-toggle`)** ومبدّل الوضع (فاتح/داكن): أزرار Sans مع `transform: scale(0.94)` عند الضغط.
- **رابط التخطّي (`.skip-link`)**: يظهر عند التركيز لتيسير الوصول.

---

*انتهى التقرير — توثيق حرفي للحالة الحالية دون تقييم أو توصيات.*

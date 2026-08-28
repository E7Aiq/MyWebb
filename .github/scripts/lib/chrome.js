/**
 * chrome.js — الترميز المشترك للصفحات المولّدة.
 *
 * النافبار والتذييل والرأس منقولة حرفياً عن الصفحات المكتوبة يدوياً، بنفس
 * الفئات وبنفس سمات data-en. أي افتراق هنا يعني صفحةً تبدو مختلفة عن أختها،
 * ولذلك لا يوجد في هذا الملف قرار تصميميّ واحد — هو نقلٌ لا تأليف.
 *
 * فرقٌ واحد مقصود عن الصفحات اليدوية: المسارات مطلقة من الجذر (/css/…)
 * لأن الصفحات المولّدة تسكن في أدلّة فرعية (/articles/<slug>/).
 */

'use strict';

const { escapeAttr, escapeHtml, jsonLd, encodePath } = require('./seo');

/* ── الأصول ─────────────────────────────────────────────────────────────── */
const asset = (p, v) => `/${String(p).replace(/^\/+/, '')}${v ? `?v=${v}` : ''}`;

/**
 * رأس المستند. كل ما فيه يأتي من data/ — لا نصّ وصفيّ مكتوب هنا.
 *
 * @param {object} o
 * @param {string}   o.title            <title> — فريد لكل صفحة
 * @param {string}   o.description      وصف مشتقّ من محتوى حقيقي
 * @param {string}   o.canonical        رابط مطلق، صيغة مضيف واحدة
 * @param {string}   o.ogType           website | article
 * @param {object}   o.og               {image, imageWidth, imageHeight, title, description}
 * @param {string[]} o.css              أسماء ملفات الأنماط بالترتيب
 * @param {string[]} o.js               أسماء السكربتات بالترتيب
 * @param {object[]} o.jsonLd           كتل البيانات المنظّمة
 * @param {string}   o.cacheBuster
 */
function head(o) {
    const v = o.cacheBuster;
    const lines = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="ar" dir="rtl">');
    lines.push('<head>');
    lines.push('    <meta charset="UTF-8">');
    lines.push('    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
    lines.push('    <meta name="color-scheme" content="light">');
    lines.push(`    <meta name="description" content="${escapeAttr(o.description)}">`);
    lines.push(`    <title>${escapeHtml(o.title)}</title>`);
    lines.push('');
    lines.push('    <!-- بوابة الكشف + اللغة: يعملان قبل الرسم فلا وميض ولا قفزة اتجاه.');
    lines.push('         بدون بوابة .js لا يُخفى أي محتوى إطلاقاً (انظر animations.css). -->');
    lines.push("    <script>(function(){var d=document.documentElement;d.classList.add('js');");
    lines.push("    try{if(localStorage.getItem('alzobaidi:lang')==='en'){d.lang='en';d.dir='ltr';}}catch(e){}})();</script>");
    lines.push('');
    lines.push('    <!-- مورف الصورة بين القائمة والتفاصيل — يُسجَّل مبكّراً كي يُلتقط pagereveal -->');
    lines.push(`    <script src="${asset('js/view-transitions.js', v)}"></script>`);
    lines.push('');
    lines.push('    <!-- تحميل مسبق لما يظهر فوق حدّ الشاشة فقط -->');
    lines.push('    <link rel="preload" href="/assets/fonts/thmanyahserifdisplay-Bold.woff2" as="font" type="font/woff2" crossorigin>');
    lines.push('    <link rel="preload" href="/assets/fonts/thmanyahseriftext-Regular.woff2" as="font" type="font/woff2" crossorigin>');
    lines.push('    <link rel="preload" href="/assets/fonts/thmanyahsans-Regular.woff2" as="font" type="font/woff2" crossorigin>');
    lines.push('');
    lines.push('    <!-- Styles -->');
    o.css.forEach((f) => lines.push(`    <link rel="stylesheet" href="${asset('css/' + f, v)}">`));
    lines.push('');
    lines.push('    <!-- Speculation Rules: يهيّئ روابط الموقع نفسها مسبقاً عند التلويح (moderate)');
    lines.push('         فيبدو التنقّل فورياً. تحسين تدريجي — المتصفّحات غير الداعمة تتجاهله. -->');
    lines.push('    <script type="speculationrules">');
    lines.push('    {');
    lines.push('      "prerender": [');
    lines.push('        { "source": "document", "eagerness": "moderate", "where": { "href_matches": "/*" } }');
    lines.push('      ]');
    lines.push('    }');
    lines.push('    </script>');
    lines.push('');
    lines.push('    <link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    lines.push('    <link rel="apple-touch-icon" href="/favicon.svg">');
    lines.push(`    <link rel="canonical" href="${escapeAttr(o.canonical)}">`);
    lines.push('    <link rel="alternate" type="application/atom+xml" title="بان — مقالات محمد الزبيدي" href="/feed.xml">');
    lines.push('');
    lines.push(seoMeta(o));
    o.jsonLd.filter(Boolean).forEach((block) => {
        lines.push('    <script type="application/ld+json">');
        lines.push(jsonLd(block));
        lines.push('    </script>');
    });
    lines.push('</head>');

    return lines.join('\n');
}

/** كتلة Open Graph / Twitter — واحدة، لا تتكرّر ولا تتناثر */
function seoMeta(o) {
    const og = o.og || {};
    const L = [];
    L.push(`    <meta property="og:type" content="${escapeAttr(o.ogType || 'website')}">`);
    L.push('    <meta property="og:locale" content="ar_SA">');
    L.push('    <meta property="og:site_name" content="محمد الزبيدي">');
    L.push(`    <meta property="og:url" content="${escapeAttr(o.canonical)}">`);
    L.push(`    <meta property="og:title" content="${escapeAttr(og.title || o.title)}">`);
    L.push(`    <meta property="og:description" content="${escapeAttr(og.description || o.description)}">`);
    L.push(`    <meta property="og:image" content="${escapeAttr(og.image)}">`);
    L.push(`    <meta property="og:image:width" content="${escapeAttr(og.imageWidth)}">`);
    L.push(`    <meta property="og:image:height" content="${escapeAttr(og.imageHeight)}">`);
    if (og.imageAlt) L.push(`    <meta property="og:image:alt" content="${escapeAttr(og.imageAlt)}">`);
    if (o.publishedTime) L.push(`    <meta property="article:published_time" content="${escapeAttr(o.publishedTime)}">`);
    if (o.modifiedTime) L.push(`    <meta property="article:modified_time" content="${escapeAttr(o.modifiedTime)}">`);
    (o.articleTags || []).forEach((t) => L.push(`    <meta property="article:tag" content="${escapeAttr(t)}">`));
    L.push('    <meta name="twitter:card" content="summary_large_image">');
    L.push(`    <meta name="twitter:title" content="${escapeAttr(og.title || o.title)}">`);
    L.push(`    <meta name="twitter:description" content="${escapeAttr(og.description || o.description)}">`);
    L.push(`    <meta name="twitter:image" content="${escapeAttr(og.image)}">`);
    return L.join('\n');
}

/* ── النافبار ───────────────────────────────────────────────────────────── */
const NAV_ITEMS = {
    home: '<li><a href="/" class="nav-link" data-en="Home">الرئيسية</a></li>',
    projects: '<li><a href="/projects/" class="nav-link brand-dhura{active}" aria-label="ذُرى — المشاريع" data-en-label="Dhura — Projects"><span class="swash">ذُرى</span> <span class="nav-gloss" data-en="Projects">المشاريع</span></a></li>',
    articles: '<li><a href="/articles/" class="nav-link brand-ban{active}" aria-label="بان — المقالات" data-en-label="Ban — Writing"><span class="swash">بان</span> <span class="nav-gloss" data-en="Writing">المقالات</span></a></li>',
    contact: '<li><a href="/#contact" class="nav-link" data-en="Contact">تواصل</a></li>'
};

/**
 * @param {'articles'|'projects'|null} section  القسم النشط
 * @param {{href:string, src:string, alt:string, w:number, h:number}} emblem
 */
function navbar(section, emblem) {
    const item = (k) => NAV_ITEMS[k].replace('{active}', section === k ? ' active' : '');
    return `    <nav class="navbar" id="navbar">
        <div class="container nav-container">
            <a href="${escapeAttr(emblem.href)}" class="logo logo-emblem">
                <img src="${escapeAttr(emblem.src)}" alt="${escapeAttr(emblem.alt)}" width="${emblem.w}" height="${emblem.h}" decoding="async">
            </a>
            <div class="nav-actions">
                <ul class="nav-links" id="navLinks">
                    ${item('home')}
                    ${item('projects')}
                    ${item('articles')}
                    ${item('contact')}
                </ul>

                <!-- يعرض اللغة التي سينتقل إليها، لا التي هو فيها -->
                <button class="lang-toggle" type="button" data-lang-toggle
                        lang="en" aria-label="Switch to English" title="Switch to English">EN</button>

                <button class="mobile-toggle" id="mobileToggle" aria-label="قائمة التنقل" data-en-label="Navigation menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </div>
    </nav>`;
}

/* ── التذييل ────────────────────────────────────────────────────────────── */
const FOOTER = `    <!-- التذييل آخر ما يراه من قطع الصفحة كاملة — أي من أبدى أكبر اهتمام.
         كان سطر حقوق وحده، فيُترك بلا وجهة. -->
    <footer class="footer">
        <div class="container footer-grid">
            <nav class="footer-nav" aria-label="روابط التذييل" data-en-label="Footer links">
                <a href="/" data-en="Home">الرئيسية</a>
                <a href="/projects/" data-en="Projects">ذُرى — المشاريع</a>
                <a href="/articles/" data-en="Writing">بان — المقالات</a>
                <a href="/#contact" data-en="Contact">تواصل</a>
            </nav>
            <p data-en="© 2026 Mohammed Alzobaidi. All rights reserved.">&copy; ٢٠٢٦ محمد الزبيدي. جميع الحقوق محفوظة.</p>
        </div>
    </footer>`;

/* ── فتات الخبز ─────────────────────────────────────────────────────────────
   العنصر الوحيد الذي يضيفه هذا العمل إلى الصفحة المرئية، وهو مطلوب صراحةً
   ليطابق BreadcrumbList في البيانات المنظّمة. يقرأ رموز الموقع القائمة
   (‎--font-sans / --t-meta / --text-faint) ولا يُدخل رمزاً ولا لوناً جديداً.
   @param {{name:string, url:string|null}[]} trail */
function breadcrumb(trail) {
    const items = trail.map((c, i) => {
        const last = i === trail.length - 1;
        const label = escapeHtml(c.name);
        // عناوين المحتوى بلا data-en: مصدرها data/ ولا نسخة إنجليزية لها.
        const en = c.en ? ` data-en="${escapeAttr(c.en)}"` : '';
        const inner = last || !c.url
            ? `<span aria-current="page"${en}>${label}</span>`
            : `<a href="${escapeAttr(c.url)}"${en}>${label}</a>`;
        return `            <li class="breadcrumb-item">${inner}</li>`;
    }).join('\n');

    return `        <nav class="breadcrumb breakout" aria-label="مسار التنقّل" data-en-label="Breadcrumb">
            <ol class="breadcrumb-list">
${items}
            </ol>
        </nav>`;
}

/* ── السكربتات ──────────────────────────────────────────────────────────── */
const scripts = (files, v) =>
    '    <!-- Scripts -->\n' +
    files.map((f) => `    <script src="${asset(f, v)}"></script>`).join('\n');

/* ── روابط داخلية ───────────────────────────────────────────────────────── */
const articleUrl = (slug) => `/articles/${encodePath(slug)}/`;
const projectUrl = (slug) => `/projects/${encodePath(slug)}/`;
const topicUrl = (slug) => `/topics/${encodePath(slug)}/`;

module.exports = { head, navbar, breadcrumb, scripts, FOOTER, asset, articleUrl, projectUrl, topicUrl };

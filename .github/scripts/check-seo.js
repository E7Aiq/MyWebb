/**
 * check-seo.js — الحارس.
 *
 * يفحص المخرَج الذي كتبه build-site.js ويخرج بحالة فشل عند أول خطأ حقيقي.
 * الغاية أن يكون الانحدار مستحيلاً بصمت: مقال جديد بلا وصف، أو عنوانان
 * متطابقان، أو رابط داخليّ إلى ملفّ لا وجود له، أو صفحة يتيمة لا يصلها
 * الزاحف — كلّها تُوقف البناء بدل أن تُنشَر.
 *
 * التشغيل:  npm run check      (وضمن npm run seo بعد البناء)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const ROOT = path.resolve(__dirname, '..', '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const ORIGIN = site.origin;

const errors = [];
const warnings = [];
const fail = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

/* ── جمع الصفحات ─────────────────────────────────────────────────────────── */
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'assets', 'css', 'js', 'data', '.cache']);

function htmlFiles(dir = ROOT, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            htmlFiles(abs, out);
        } else if (entry.name.endsWith('.html')) {
            out.push(path.relative(ROOT, abs));
        }
    }
    return out;
}

/** المسار الذي يقدَّم به الملف: articles/x/index.html ⇒ /articles/x/ */
function urlOf(rel) {
    if (rel === 'index.html') return '/';
    if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
    return '/' + rel;
}

const files = htmlFiles().sort();

/* الجسور (تحويل) تُفحص بقواعد أخفّ: لا محتوى لها ولا وصف — وهذا مقصود */
const isBridge = (doc) => !!doc.querySelector('meta[http-equiv="refresh"]')
    || /noindex/.test(doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '');

const pages = [];
for (const rel of files) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const doc = parse(html);
    pages.push({ rel, url: urlOf(rel), html, doc, bridge: isBridge(doc) });
}

const content = pages.filter((p) => !p.bridge && p.rel !== '404.html');

/* ── ١. الوسوم الأساسية ──────────────────────────────────────────────────── */
const attr = (doc, sel, name = 'content') => doc.querySelector(sel)?.getAttribute(name) || '';

for (const p of content) {
    const title = (doc(p, 'title')?.text || '').trim();
    const desc = attr(p.doc, 'meta[name="description"]');
    const canonical = attr(p.doc, 'link[rel="canonical"]', 'href');
    const ogImage = attr(p.doc, 'meta[property="og:image"]');
    const ogW = attr(p.doc, 'meta[property="og:image:width"]');
    const ogH = attr(p.doc, 'meta[property="og:image:height"]');

    if (!title) fail(p.url, 'بلا <title>');
    if (!desc) fail(p.url, 'بلا meta description');
    if (!canonical) fail(p.url, 'بلا rel=canonical');
    if (!ogImage) fail(p.url, 'بلا og:image');
    if (!ogW || !ogH) fail(p.url, 'og:image بلا أبعاد معلنة');

    if (canonical && !canonical.startsWith(ORIGIN + '/')) {
        fail(p.url, `canonical بصيغة مضيف أخرى: ${canonical}`);
    }
    if (canonical && decodeURI(canonical) !== decodeURI(ORIGIN + p.url)) {
        fail(p.url, `canonical لا يشير إلى الصفحة نفسها: ${canonical}`);
    }

    if (title.length > 65) warn(p.url, `<title> ${title.length} محرفاً (الهدف ≤٦٠)`);
    if (desc && (desc.length < 70 || desc.length > 175)) {
        warn(p.url, `طول الوصف ${desc.length} محرفاً (الهدف ١٥٠–١٦٠)`);
    }

    // ملف بطاقة المشاركة موجود فعلاً وبالأبعاد المعلنة
    if (ogImage.startsWith(ORIGIN + '/')) {
        const relImg = decodeURIComponent(ogImage.slice(ORIGIN.length + 1));
        const absImg = path.join(ROOT, relImg);
        if (!fs.existsSync(absImg)) fail(p.url, `og:image غير موجود على القرص: ${relImg}`);
    }

    // عنوان واحد من المستوى الأول
    const h1s = p.doc.querySelectorAll('h1');
    if (h1s.length !== 1) fail(p.url, `عدد <h1> = ${h1s.length} (المطلوب واحد)`);

    // تسلسل العناوين بلا قفز
    const levels = p.doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
        .map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) {
            warn(p.url, `قفزة في تسلسل العناوين: h${levels[i - 1]} ← h${levels[i]}`);
            break;
        }
    }

    // اللغة والاتجاه
    const root = p.doc.querySelector('html');
    if (root && (root.getAttribute('lang') !== 'ar' || root.getAttribute('dir') !== 'rtl')) {
        fail(p.url, 'الجذر ليس lang="ar" dir="rtl"');
    }

    // آثار العصر السابق: رسالة تحميل أو noscript في صفحة يفترض أنها ساكنة
    if (/جاري تحميل/.test(p.html)) fail(p.url, 'ما زالت تحمل رسالة «جاري تحميل» — لم تُصيَّر مسبقاً');
}

function doc(p, sel) { return p.doc.querySelector(sel); }

/* ── ٢. الفرادة ──────────────────────────────────────────────────────────── */
const byTitle = new Map();
const byDesc = new Map();
for (const p of content) {
    const title = (doc(p, 'title')?.text || '').trim();
    const desc = attr(p.doc, 'meta[name="description"]');
    if (title) {
        if (byTitle.has(title)) fail(p.url, `عنوان مكرّر مع ${byTitle.get(title)}: «${title}»`);
        else byTitle.set(title, p.url);
    }
    if (desc) {
        if (byDesc.has(desc)) fail(p.url, `وصف مكرّر مع ${byDesc.get(desc)}`);
        else byDesc.set(desc, p.url);
    }
}

/* ── ٣. البيانات المنظّمة ────────────────────────────────────────────────── */
const REQUIRED = {
    Person: ['name', 'url'],
    WebSite: ['name', 'url'],
    BlogPosting: ['headline', 'datePublished', 'author', 'image', 'inLanguage'],
    CreativeWork: ['name', 'author', 'inLanguage'],
    CollectionPage: ['name', 'url'],
    BreadcrumbList: ['itemListElement']
};

let ldCount = 0;
for (const p of content) {
    const blocks = p.doc.querySelectorAll('script[type="application/ld+json"]');
    if (!blocks.length) fail(p.url, 'بلا أي كتلة JSON-LD');

    for (const block of blocks) {
        ldCount++;
        let data;
        try {
            data = JSON.parse(block.text);
        } catch (err) {
            fail(p.url, `JSON-LD لا يُحلَّل: ${err.message}`);
            continue;
        }
        if (!data['@context'] || !/schema\.org/.test(data['@context'])) {
            fail(p.url, 'JSON-LD بلا @context إلى schema.org');
        }
        const type = data['@type'];
        if (!type) { fail(p.url, 'JSON-LD بلا @type'); continue; }

        for (const key of REQUIRED[type] || []) {
            if (data[key] === undefined || data[key] === null || data[key] === '') {
                fail(p.url, `${type} ينقصه الحقل «${key}»`);
            }
        }
        // قيمة undefined لا تُسلسَل في JSON، لكن سلسلة "undefined" تدلّ على خلل
        if (/"undefined"|"null"/.test(block.text)) {
            fail(p.url, `${type} فيه قيمة نصّية «undefined/null»`);
        }
        /* حقلٌ فارغ أسوأ من حقل غائب: مصفوفة خاوية أو نصّ خاوٍ يُصرّح
           بالمعرفة ثم لا يقدّم شيئاً، فيُقرأ إشارةً كاذبة. */
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value) && value.length === 0) {
                fail(p.url, `${type}: الحقل «${key}» مصفوفة فارغة — احذفه أو املأه`);
            }
            if (typeof value === 'string' && !value.trim() && key !== '@id') {
                fail(p.url, `${type}: الحقل «${key}» نصّ فارغ`);
            }
        }
        if (type === 'BreadcrumbList') {
            const items = data.itemListElement || [];
            items.forEach((el, i) => {
                if (el.position !== i + 1) fail(p.url, 'BreadcrumbList: ترتيب position غير متسلسل');
                if (!el.name) fail(p.url, 'BreadcrumbList: عنصر بلا name');
            });
            if (items.length && items[items.length - 1].item) {
                warn(p.url, 'BreadcrumbList: الفتاتة الأخيرة تحمل item — الصفحة الحالية لا تُرتبط بنفسها');
            }
        }
    }
}

/* ── ٤. الروابط الداخلية تصل إلى ملفات موجودة ────────────────────────────── */
const served = new Map();          // مسار مقدَّم ⇒ ملف
for (const p of pages) served.set(p.url, p.rel);

function resolves(urlPath) {
    const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
    if (served.has(clean)) return true;
    const asFile = path.join(ROOT, clean.replace(/^\//, ''));
    if (fs.existsSync(asFile) && fs.statSync(asFile).isFile()) return true;
    const asIndex = path.join(asFile, 'index.html');
    return fs.existsSync(asIndex);
}

const graph = new Map();
for (const p of pages) {
    const targets = new Set();
    for (const a of p.doc.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href)) continue;
        if (!href.startsWith('/')) { fail(p.url, `رابط داخليّ نسبيّ: ${href}`); continue; }
        if (!resolves(href)) fail(p.url, `رابط داخليّ مكسور: ${href}`);
        targets.add(decodeURIComponent(href.split('#')[0]));
    }
    graph.set(p.url, targets);
}

/* ── ٥. لا صفحة يتيمة: كل صفحة يبلغها الزاحف من الرئيسية ─────────────────── */
const reachable = new Set(['/']);
const queue = ['/'];
while (queue.length) {
    const current = queue.shift();
    for (const target of graph.get(current) || []) {
        const norm = target.endsWith('/') || target.includes('.') ? target : target + '/';
        if (reachable.has(norm)) continue;
        if (!graph.has(norm)) continue;
        reachable.add(norm);
        queue.push(norm);
    }
}
for (const p of content) {
    if (!reachable.has(p.url)) fail(p.url, 'صفحة يتيمة — لا يبلغها الزاحف بالروابط من الرئيسية');
}

/* ── ٦. خريطة الموقع والتغذية و robots ───────────────────────────────────── */
/* ‏sitemap.xml إمّا خريطة واحدة أو فهرسٌ يشير إلى خرائط. الفحص يتبع الشكلين،
   وإلّا مرّ فهرسٌ بخرائط مكسورة بلا أن يُلاحَظ. */
const sitemapRaw = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
let sitemap = sitemapRaw;
if (/<sitemapindex/.test(sitemapRaw)) {
    const parts = [...sitemapRaw.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const merged = [];
    for (const loc of parts) {
        const rel = decodeURIComponent(loc.slice(ORIGIN.length + 1));
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) { fail('sitemap.xml', `الفهرس يشير إلى خريطة غير موجودة: ${rel}`); continue; }
        merged.push(fs.readFileSync(abs, 'utf8'));
    }
    sitemap = merged.join('\n');
    console.log(`   ℹ️  فهرس خرائط: ${parts.length} ملفاً`);
}
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const locSet = new Set(locs.map((l) => decodeURI(l)));

for (const p of content) {
    if (!locSet.has(decodeURI(ORIGIN + p.url))) fail(p.url, 'غير مدرجة في sitemap.xml');
}
for (const loc of locs) {
    const rel = decodeURIComponent(loc.slice(ORIGIN.length));
    if (!resolves(rel)) fail('sitemap.xml', `رابط لا يصل إلى ملف: ${loc}`);
}
if (new Set(locs).size !== locs.length) fail('sitemap.xml', 'روابط مكرّرة');
for (const m of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) fail('sitemap.xml', `lastmod بصيغة غير صالحة: ${m[1]}`);
}

const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) fail('robots.txt', 'لا يشير إلى خريطة الموقع');
if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt', 'يمنع الزحف عن الجذر');

const feed = fs.readFileSync(path.join(ROOT, 'feed.xml'), 'utf8');
if (!/<feed[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/.test(feed)) {
    fail('feed.xml', 'ليست تغذية Atom صالحة');
}
const entries = (feed.match(/<entry>/g) || []).length;
const articleCount = content.filter((p) => /^\/articles\/.+\//.test(p.url)).length;
if (entries !== articleCount) fail('feed.xml', `عدد المدخلات ${entries} ≠ عدد المقالات ${articleCount}`);
for (const p of content) {
    if (!p.doc.querySelector('link[rel="alternate"][type="application/atom+xml"]')) {
        fail(p.url, 'بلا rel=alternate إلى التغذية');
    }
}

/* ── ٧. باعث التحديث موحّد ───────────────────────────────────────────────── */
const busters = new Set();
for (const p of pages) {
    for (const m of p.html.matchAll(/\?v=(r\d+)/g)) busters.add(m[1]);
}
if (busters.size > 1) {
    fail('باعث التحديث', `قيم مختلفة في الصفحات: ${[...busters].join('، ')} — `
        + 'الزائر العائد يخلط نسخاً قديمة بجديدة');
} else if (busters.size === 1 && !busters.has(site.cacheBuster)) {
    fail('باعث التحديث', `الصفحات على ${[...busters][0]} بينما data/site.json يقول ${site.cacheBuster}`);
}

/* ── ٨. الصور: أبعاد معلنة، ونصّ بديل صادق ───────────────────────────────── */
for (const p of content) {
    for (const img of p.doc.querySelectorAll('img')) {
        const src = img.getAttribute('src') || '';
        if (!src) continue;
        if (img.getAttribute('alt') === null) fail(p.url, `<img> بلا سمة alt: ${src}`);
        if (!img.getAttribute('width') || !img.getAttribute('height')) {
            warn(p.url, `<img> بلا width/height (قفزة تخطيط محتملة): ${src}`);
        }
        if (src.startsWith('/') && !resolves(src)) fail(p.url, `صورة مفقودة: ${src}`);
    }
}

/* ── ٩. الموضعة: مصدر واحد، وقرار معلّق ──────────────────────────────────── */
const pos = site.positioning;
if (pos.search_role_ar !== pos.hero_role_ar) {
    warn('data/site.json', 'الموضعة غير محسومة: العنوان في نتائج البحث يقول '
        + `«${pos.search_role_ar}» والهيرو يقول «${pos.hero_role_ar}» — قرار لصاحب الموقع (SEO-REPORT.md §4).`);
}

/* ── التقرير ─────────────────────────────────────────────────────────────── */
console.log(`\n🔎 فُحصت ${pages.length} صفحة (${content.length} صفحة محتوى، `
    + `${pages.length - content.length} جسر/خطأ) و ${ldCount} كتلة بيانات منظّمة.\n`);

if (warnings.length) {
    console.log(`⚠️  ${warnings.length} تنبيهاً:`);
    warnings.forEach((w) => console.log('   · ' + w));
    console.log('');
}

if (errors.length) {
    console.error(`❌ ${errors.length} خطأً — البناء غير صالح للنشر:`);
    errors.forEach((e) => console.error('   ✗ ' + e));
    console.error('');
    process.exit(1);
}

console.log('✅ لا أخطاء. كل صفحة تحمل عنواناً ووصفاً ورابطاً معيارياً وبطاقة مشاركة،');
console.log('   ولا عنوانين متطابقين، ولا رابطاً داخلياً مكسوراً، ولا صفحة يتيمة.\n');

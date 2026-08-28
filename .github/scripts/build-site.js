/**
 * build-site.js — التصيير المسبق.
 *
 * يقرأ data/*.json (ما أنتجه جالبا Notion، ولا يمسّهما) ويكتب صفحات HTML
 * حقيقية: المقال كاملاً في الترميز، والمشروع كاملاً، والفهرسان، وصفحة لكل
 * موضوع، وخريطة الموقع، والتغذية، وبطاقات المشاركة.
 *
 * لماذا: صفحتا الفهرس اليوم لا تُخرجان شيئاً بلا جافاسكربت — كل زاحف لا
 * ينفّذ جافاسكربت (واتساب، لينكدإن، إكس، تلغرام، بينغ، وزواحف نماذج اللغة)
 * يرى «جاري تحميل المقالات...» ولا يرى مقالاً واحداً.
 *
 * العقد:
 *   · لا يخترع نصّاً. كل عنوان ووصف مشتقّ من محتوى حقيقي في data/.
 *   · لا يغيّر تصميماً. الترميز المولَّد هو نفسه الذي تبنيه سكربتات العرض،
 *     بنفس الفئات وبنفس الترتيب.
 *   · حتميّ وقابل للإعادة: نفس المدخل ⇒ نفس المخرج بايتاً ببايت.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const S = require('./lib/seo');
const C = require('./lib/chrome');
const OG = require('./lib/og');

const { ROOT } = S;

/* ── تقرير البناء ───────────────────────────────────────────────────────── */
const report = { written: [], warnings: [], notes: [], counts: {} };
const warn = (m) => { report.warnings.push(m); console.warn('   ⚠️  ' + m); };
const note = (m) => { report.notes.push(m); console.log('   · ' + m); };

function write(rel, content) {
    const changed = S.writeFileIfChanged(rel, content);
    report.written.push(rel);
    if (changed) console.log(`   ✍️  ${rel}`);
    return changed;
}

/* ============================================================================
   ١. تطبيع البيانات
   ============================================================================ */

const PLACEHOLDER = 'assets/images/cover-placeholder.svg';

/** ترتيب المقالات — نفس قاعدة js/articles-list.js حرفياً */
const orderArticles = (a) => [...a].sort((x, y) => {
    const byFeatured = (y.featured === true) - (x.featured === true);
    if (byFeatured) return byFeatured;
    const tx = x.date ? new Date(x.date).getTime() : -Infinity;
    const ty = y.date ? new Date(y.date).getTime() : -Infinity;
    return ty - tx;
});

/** ترتيب المشاريع — نفس قاعدة projects.js حرفياً */
const orderProjects = (p) => [...p].sort((x, y) => {
    const tx = x.date ? new Date(x.date).getTime() : -Infinity;
    const ty = y.date ? new Date(y.date).getTime() : -Infinity;
    return ty - tx;
});

/**
 * المعرّف يتبع خطّ العنوان (عربي/لاتيني) ويُثبَّت في سجلّ data/slugs.json.
 * السجلّ ليس ترفاً: تغيير العنوان في Notion يغيّر المعرّف، فينكسر رابط قد
 * يكون شورك. السجلّ يحفظ المعرّف الأول، ويسجّل القديم في aliases فيُكتب له
 * جسر تحويل تلقائياً.
 */
function assignSlug(item, ledger, used, desiredSlug) {
    const key = item.id;
    const desired = desiredSlug || S.slugify(item.title) || key.slice(0, 12);

    const record = ledger[key] || { slug: null, aliases: [] };
    let slug = record.slug || desired;

    // تصادم مع عنصر آخر ⇒ لاحقة من المعرّف، لا كسر صامت
    let candidate = slug;
    let n = 2;
    while (used.has(candidate)) candidate = `${slug}-${n++}`;
    slug = candidate;
    used.add(slug);

    const aliases = new Set(record.aliases || []);
    if (record.slug && record.slug !== slug) aliases.add(record.slug);
    if (desired !== slug) aliases.add(desired);
    aliases.delete(slug);

    ledger[key] = { slug, aliases: [...aliases], title: item.title, kind: item.kind };
    return { slug, aliases: [...aliases] };
}

function normalise(site) {
    const articlesData = S.readJson('data/articles.json');
    const projectsData = S.readJson('data/projects.json');

    const ledgerPath = path.join(ROOT, 'data', 'slugs.json');
    const ledger = fs.existsSync(ledgerPath)
        ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
        : {};

    const used = { article: new Set(), project: new Set() };

    const articles = orderArticles(articlesData.articles || []).map((a) => {
        const item = {
            kind: 'article',
            id: a.id,
            title: (a.title || '').trim(),
            titleEn: (a.title_en || '').trim(),
            rawDescription: (a.description || '').trim(),
            date: a.date || null,
            lastEdited: a.last_edited || a.date || null,
            readTime: a.read_time || null,
            featured: a.featured === true,
            category: (a.category || '').trim(),
            cover: a.cover && a.cover !== PLACEHOLDER ? a.cover : null,
            contentHtml: a.content_html || '',
            topics: dedupe([...(a.tags || []), a.category].filter(Boolean)),
            notionUrl: a.url || ''
        };
        Object.assign(item, assignSlug(item, ledger, used.article));
        item.url = C.articleUrl(item.slug);
        return item;
    });

    const projects = orderProjects(projectsData.projects || []).map((p) => {
        const item = {
            kind: 'project',
            id: p.id,
            title: (p.title || '').trim(),
            titleEn: '',
            rawDescription: (p.summary || '').trim(),
            date: p.date || null,
            lastEdited: p.last_edited || p.date || null,
            readTime: p.read_time || null,
            featured: false,
            cover: p.cover && p.cover !== PLACEHOLDER ? p.cover : null,
            contentHtml: p.content_html || '',
            topics: dedupe(p.categories || []),
            previewLink: p.preview_link || '',
            notionUrl: p.url || ''
        };
        Object.assign(item, assignSlug(item, ledger, used.project));
        item.url = C.projectUrl(item.slug);
        return item;
    });

    return { articles, projects, ledger, lastUpdated: articlesData.last_updated, site };
}

const dedupe = (arr) => [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];

/* ============================================================================
   ٢. الوصف والعنوان — مشتقّان، لا مخترعان
   ============================================================================ */

function deriveMeta(ctx) {
    const all = [...ctx.articles, ...ctx.projects];

    for (const item of all) {
        item.description = item.rawDescription || S.deriveDescription(item.contentHtml);
        if (!item.description) {
            warn(`لا وصف ولا متن يُشتقّ منه: ${item.kind} «${item.title}» — الصفحة ستُبنى بلا meta description.`);
        } else if (!item.rawDescription) {
            item.descriptionDerived = true;
        }

        const suffix = item.kind === 'article'
            ? ctx.site.sections.articles.brand_ar
            : ctx.site.sections.projects.brand_ar;
        item.pageTitle = S.buildTitle(item.title, suffix);
    }

    // فرادة العنوان والوصف — تُفحص هنا وتُعاد فحصاً في check-seo.js
    const seenTitle = new Map();
    const seenDesc = new Map();
    for (const item of all) {
        if (seenTitle.has(item.pageTitle)) {
            warn(`عنوانان متطابقان: «${item.pageTitle}» في ${item.url} و ${seenTitle.get(item.pageTitle)}`);
        }
        seenTitle.set(item.pageTitle, item.url);
        if (item.description) {
            if (seenDesc.has(item.description)) {
                warn(`وصفان متطابقان: ${item.url} و ${seenDesc.get(item.description)}`);
            }
            seenDesc.set(item.description, item.url);
        }
    }
}

/* ============================================================================
   ٣. الموضوعات والمحتوى المرتبط
   ============================================================================ */

function buildTopics(ctx) {
    const all = [...ctx.articles, ...ctx.projects];

    /* التجميع بمفتاح المطابقة العربي لا بالنصّ الخام: وسمان يختلفان بحرف
       («الذكاء الاصطناعي» و«الذكاء الاصطناعى») كانا يُنتجان صفحتَي موضوع
       تتقاسمان المحتوى وتتنافسان على النتيجة نفسها. راجع arabicKey في
       lib/seo.js و docs/SEO.md §6. */
    const groups = new Map();   // مفتاح → { variants, items }

    for (const item of all) {
        const counted = new Set();
        for (const name of item.topics) {
            const key = S.arabicKey(name);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, { key, variants: new Map(), items: [] });
            const g = groups.get(key);
            g.variants.set(name, (g.variants.get(name) || 0) + 1);
            // العنصر يُعدّ مرّة واحدة في الموضوع ولو حمل صيغتين منه
            if (!counted.has(key)) { g.items.push(item); counted.add(key); }
        }
    }

    /* الاسم المعروض: أشيع صيغة كُتب بها الوسم، ثم الأسبق أبجدياً عند
       التعادل. حتميّ، ويحترم ما كتبه صاحب المحتوى — لا يُعرض المفتاح
       المُطبَّع أبداً. */
    for (const g of groups.values()) {
        g.name = [...g.variants.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))[0][0];
        g.variantList = [...g.variants.keys()].sort();
    }

    /* المعرّف يمرّ بالسجلّ كما يمرّ معرّف المقال: أوّل معرّف أُعطي للموضوع
       يثبت، فلا يتغيّر رابط مفهرَس لأن صيغة الكتابة الأشيع تبدّلت. */
    const usedTopicSlugs = new Set();

    /* المحاور تسكن فضاء /topics/ نفسه، فتُحجز معرّفاتها قبل الوسوم كي لا
       يسبق وسمٌ محوراً إلى اسمه. المحور بنية يعلنها صاحب الموقع في
       site.json، والوسم يأتي من Notion — والأوّل أثبت. */
    ctx.pillars = (ctx.site.pillars || []).map((def) => {
        const record = { id: `pillar:${def.id}`, title: def.name_ar, kind: 'pillar' };
        const assigned = assignSlug(record, ctx.ledger, usedTopicSlugs, S.topicSlug(def.name_ar));
        return Object.assign({
            id: def.id,
            name: def.name_ar,
            nameEn: def.name_en,
            keys: new Set((def.tags || []).map(S.arabicKey).filter(Boolean)),
            topics: [],
            items: [],
            isPillar: true
        }, assigned, { url: C.topicUrl(assigned.slug) });
    });

    const ordered = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
    for (const g of ordered) {
        const record = { id: `topic:${g.key}`, title: g.name, kind: 'topic' };
        Object.assign(g, assignSlug(record, ctx.ledger, usedTopicSlugs, S.topicSlug(g.name)));
        g.url = C.topicUrl(g.slug);
    }

    const byKey = new Map(ordered.map((g) => [g.key, g]));

    // ترتيب العرض: الأكثر عناصر أولاً، ثم أبجدياً — حتميّ عبر البناءات
    ctx.topics = [...groups.values()].sort((a, b) =>
        b.items.length - a.items.length || a.name.localeCompare(b.name, 'ar'));

    /* ربط كل وسم بمحوره، وجمع أعضاء المحور: موضوعاته وعناصره بلا تكرار */
    for (const topic of ctx.topics) {
        topic.pillar = ctx.pillars.find((pl) => pl.keys.has(topic.key)) || null;
        if (topic.pillar) topic.pillar.topics.push(topic);
    }
    for (const pillar of ctx.pillars) {
        const seenItems = new Set();
        pillar.items = pillar.topics
            .flatMap((t) => t.items)
            .filter((i) => !seenItems.has(i.id) && seenItems.add(i.id));
    }

    const empty = ctx.pillars.filter((pl) => !pl.items.length);
    if (empty.length) {
        warn(`${empty.length} محاور بلا محتوى: `
            + empty.map((pl) => `«${pl.name}»`).join('، ')
            + ' — لا تُولَّد لها صفحات (صفحة محور فارغة تضرّ ولا تنفع). '
            + 'راجع docs/CONTENT-PLAN.md لما يملؤها.');
    }

    const unmapped = ctx.topics.filter((t) => !t.pillar);
    if (unmapped.length) {
        note(`وسوم بلا محور: ${unmapped.map((t) => `«${t.name}»`).join('، ')} — `
            + 'أضفها إلى pillars[].tags في data/site.json.');
    }

    const merged = ctx.topics.filter((g) => g.variantList.length > 1);
    if (merged.length) {
        merged.forEach((g) => note(`صيغ موحَّدة في موضوع «${g.name}»: ${g.variantList.join(' · ')}`));
    }

    for (const item of all) {
        const seen = new Set();
        item.topicLinks = item.topics
            .map((n) => byKey.get(S.arabicKey(n)))
            .filter((g) => g && !seen.has(g.key) && seen.add(g.key));
    }

    // المرتبط: أكثر الموضوعات اشتراكاً، عبر النوعين، بلا تكرار النفس
    for (const item of all) {
        const mine = new Set(item.topics.map(S.arabicKey).filter(Boolean));
        if (!mine.size) { item.related = []; continue; }
        item.related = all
            .filter((o) => o.id !== item.id)
            .map((o) => ({
                item: o,
                shared: [...new Set(o.topics.map(S.arabicKey))].filter((t) => mine.has(t)).length
            }))
            .filter((r) => r.shared > 0)
            .sort((a, b) => b.shared - a.shared
                || new Date(b.item.date || 0) - new Date(a.item.date || 0))
            .slice(0, 4)
            .map((r) => r.item);
    }

    if (!ctx.topics.length) {
        warn('لا موضوعات في البيانات إطلاقاً — لن تُبنى صفحات موضوعات ولا روابط مرتبطة.');
    }
    const untagged = all.filter((i) => !i.topics.length);
    if (untagged.length) {
        warn(`${untagged.length} عنصراً بلا وسوم: `
            + untagged.map((i) => `«${i.title}»`).join('، ')
            + ' — لا يظهر في أي صفحة موضوع (املأ Tags/Categories في Notion).');
    }
}

/* ============================================================================
   ٤. بطاقات المشاركة
   ============================================================================ */

async function buildOgImages(ctx) {
    const dir = 'assets/og';
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });

    if (!OG.available()) {
        throw new Error(
            'تعذّر تحميل أدوات توليد بطاقات المشاركة (' + OG.missingReason() + ').\n'
            + '   ثبّتها بـ: npm install\n'
            + '   البناء يتوقّف هنا عمداً — صفحة بلا og:image تُشارَك ببطاقة عمياء.'
        );
    }

    const kicker = {
        article: `${ctx.site.sections.articles.brand_ar} — مدوّنة ${ctx.site.name_ar}`,
        project: `${ctx.site.sections.projects.brand_ar} — مشاريع ${ctx.site.name_ar}`
    };
    const emblem = {
        article: ctx.site.sections.articles.emblem,
        project: ctx.site.sections.projects.emblem
    };

    let fromCover = 0;
    let drawn = 0;

    for (const item of [...ctx.articles, ...ctx.projects]) {
        /* المعرّف كاملاً لا مقطوعاً: معرّفا مشروعَي Notion يشتركان في أوّل
           اثني عشر محرفاً («30c59148905a…»)، فكان القطع يجعل الاثنين اسم
           ملفٍّ واحد — تُكتب بطاقة أحدهما فوق بطاقة الآخر بصمت. */
        const rel = `${dir}/${item.kind}-${item.id}.jpg`;
        const abs = path.join(ROOT, rel);

        let size = null;
        if (item.cover) size = await OG.renderCoverCard(item.cover, abs);
        if (size) fromCover++;

        if (!size) {
            size = await OG.renderTitleCard({
                title: item.title,
                kicker: kicker[item.kind],
                emblem: emblem[item.kind],
                outAbs: abs
            });
            drawn++;
        }

        report.written.push(rel);
        item.og = {
            url: `${ctx.site.origin}/${rel}`,
            width: size.width,
            height: size.height,
            path: rel
        };
    }

    // بطاقات الصفحات الثابتة
    const fixed = [
        { key: 'home', title: ctx.site.name_ar, kicker: ctx.site.positioning.hero_role_ar, emblem: null },
        { key: 'articles', title: `مدوّنة ${ctx.site.sections.articles.brand_ar}`, kicker: kicker.article, emblem: emblem.article },
        { key: 'projects', title: ctx.site.sections.projects.brand_ar, kicker: kicker.project, emblem: emblem.project },
        { key: 'topics', title: ctx.site.sections.topics.label_ar, kicker: `${ctx.site.name_ar} — فهرس الموضوعات`, emblem: null }
    ];

    ctx.ogFixed = {};
    for (const f of fixed) {
        const rel = `${dir}/${f.key}.jpg`;

        /* بطاقة الرئيسية قرارٌ لصاحب الموقع: الصورة الشخصية 640×857 عمودية،
           وقصّها إلى 1200×630 يقطع الرأس — فالمرسومة أسلم افتراضاً. ومتى
           وفّر صورة اجتماعية بالمقاس الصحيح (‎home.og_image في site.json)
           استُعملت كما هي. القاعدة الأخرى لا تتغيّر: لا صورة شخصية لمقال. */
        const supplied = f.key === 'home' ? (ctx.site.home.og_image || null) : null;
        let size = null;
        if (supplied) {
            size = await OG.renderCoverCard(supplied, path.join(ROOT, rel));
            if (size) note(`بطاقة الرئيسية من صورة موفَّرة: ${supplied}`);
            else warn(`‎home.og_image يشير إلى ملف غير موجود: ${supplied} — رُسمت البطاقة من العنوان.`);
        }
        if (!size) size = await OG.renderTitleCard({
            title: f.title, kicker: f.kicker, emblem: f.emblem,
            outAbs: path.join(ROOT, rel)
        });
        report.written.push(rel);
        ctx.ogFixed[f.key] = { url: `${ctx.site.origin}/${rel}`, width: size.width, height: size.height, path: rel };
        drawn++;
    }

    // بطاقة لكل موضوع، ولكل محور له محتوى
    for (const topic of [...ctx.pillars.filter((pl) => pl.items.length), ...ctx.topics]) {
        const rel = `${dir}/topic-${topic.slug}.jpg`;
        const size = await OG.renderTitleCard({
            title: topic.name,
            kicker: `${ctx.site.name_ar} — ${topic.isPillar ? 'محور' : 'موضوع'}`,
            emblem: null,
            outAbs: path.join(ROOT, rel)
        });
        report.written.push(rel);
        topic.og = { url: `${ctx.site.origin}/${rel}`, width: size.width, height: size.height, path: rel };
        drawn++;
    }

    note(`بطاقات المشاركة: ${fromCover} من غلاف حقيقي، ${drawn} مرسومة من العنوان.`);
    report.counts.ogFromCover = fromCover;
    report.counts.ogDrawn = drawn;
}

/* ============================================================================
   ٥. تحويل متن Notion — نفس ما يفعله js/article.js وقت التشغيل
   ============================================================================ */

const looksLikeFilename = (alt) =>
    /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(alt) ||
    /^image[\s_-]*\d*$/i.test(alt) ||
    (!/\s/.test(alt) && /[_-]/.test(alt));

const normaliseTitle = (s) => (s || '')
    .replace(/[\s\u200f\u200e]+/g, ' ')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim();

const imageSizeCache = new Map();
function imageSize(relSrc) {
    if (imageSizeCache.has(relSrc)) return imageSizeCache.get(relSrc);
    let size = null;
    try {
        const sharp = require('sharp');
        const abs = path.join(ROOT, relSrc.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
            // metadata() غير متزامن؛ الأبعاد تُقرأ من الترويسة مباشرةً
            const meta = require('sharp')(abs);
            size = meta;
        }
        void sharp;
    } catch { /* لا شيء */ }
    imageSizeCache.set(relSrc, size);
    return size;
}

/** أبعاد الصور تُقرأ مسبقاً (غير متزامن) ثم تُستهلك تزامنياً أثناء التحويل */
async function preloadImageSizes(ctx) {
    const sharp = require('sharp');
    const paths = new Set();
    for (const item of [...ctx.articles, ...ctx.projects]) {
        const re = /<img[^>]+src="([^"]+)"/gi;
        let m;
        while ((m = re.exec(item.contentHtml)) !== null) paths.add(m[1]);
        if (item.cover) paths.add(item.cover);
    }
    ctx.imageSizes = new Map();
    for (const p of paths) {
        if (/^https?:/i.test(p)) continue;
        const abs = path.join(ROOT, p.replace(/^\//, ''));
        if (!fs.existsSync(abs)) { warn(`صورة مفقودة يشير إليها المحتوى: ${p}`); continue; }
        try {
            const meta = await sharp(abs).metadata();
            ctx.imageSizes.set(p, { w: meta.width, h: meta.height });
        } catch (err) { warn(`تعذّرت قراءة أبعاد ${p}: ${err.message}`); }
    }
}

/**
 * ينتج متن الصفحة الساكن. يطابق enhanceProse() + sanitizeHtml() في
 * js/article.js و js/project.js، ويزيد عليها ما لا يستطيعه المتصفّح وقت
 * التشغيل: أبعاد الصور الحقيقية (تُلغي قفزة التخطيط) وتنزيل العناوين.
 */
function renderProse(item, ctx) {
    const root = parse(item.contentHtml, { blockTextElements: { script: false, style: false, pre: true } });

    // ── تعقيم ────────────────────────────────────────────────────────────
    root.querySelectorAll('script, object, embed').forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((el) => {
        for (const name of Object.keys(el.attributes || {})) {
            const lower = name.toLowerCase();
            const value = String(el.getAttribute(name) || '').trim().toLowerCase();
            if (lower.startsWith('on')) el.removeAttribute(name);
            else if ((lower === 'href' || lower === 'src' || lower === 'xlink:href')
                && /^(javascript|data:text\/html|vbscript):/i.test(value)) {
                el.removeAttribute(name);
            }
        }
    });

    // ── الصور: مسار مطلق، تحميل كسول، أبعاد حقيقية، نصّ بديل صادق ────────
    const decorative = [];
    root.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        if (src && !/^(https?:)?\/\//i.test(src) && !src.startsWith('/')) {
            img.setAttribute('src', '/' + src.replace(/^\.?\//, ''));
        }
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');

        const size = ctx.imageSizes.get(src);
        if (size) { img.setAttribute('width', String(size.w)); img.setAttribute('height', String(size.h)); }

        const alt = (img.getAttribute('alt') || '').trim();
        // Notion يضع اسم الملف نصّاً بديلاً حين لا تعليق. اسم ملف يُقرأ حرفاً
        // حرفاً في قارئ الشاشة أسوأ من لا شيء — والصادق أن تُعلَن زخرفية
        // ويُطلب من صاحب المحتوى تعليقٌ حقيقي.
        if (!alt || looksLikeFilename(alt)) {
            img.setAttribute('alt', '');
            decorative.push(src);
        }
    });

    root.querySelectorAll('iframe').forEach((frame) => {
        frame.setAttribute('loading', 'lazy');
        if (!frame.getAttribute('title')) frame.setAttribute('title', 'تضمين تفاعلي');
    });

    root.querySelectorAll('pre').forEach((pre) => {
        pre.setAttribute('tabindex', '0');
        pre.setAttribute('role', 'region');
        pre.setAttribute('aria-label', 'كود');
    });

    // ── مرور على المستوى الأعلى — نفس ما تفعله enhanceProse ──────────────
    const out = [];
    let firstHeadingSeen = false;

    for (const node of root.childNodes) {
        const tag = (node.tagName || '').toLowerCase();

        if (!tag) {                                   // نصّ عارٍ بين الكتل
            if (String(node.text || '').trim()) out.push(node.toString());
            continue;
        }

        if (tag === 'h1') {
            // عنوان صفحة ثانٍ لا يجوز. النصّ والمقياس لا يتغيّران:
            // ‎.article-body h1 و h2 لهما نفس العائلة والحجم والوزن تماماً.
            const isDuplicate = !firstHeadingSeen
                && normaliseTitle(node.text) === normaliseTitle(item.title);
            firstHeadingSeen = true;
            const cls = isDuplicate ? ' class="is-duplicate-title"' : '';
            out.push(`<h2${cls}>${node.innerHTML}</h2>`);
            continue;
        }

        if (tag === 'table') {
            out.push('<div class="prose-scroll" tabindex="0" role="region" aria-label="جدول">'
                + node.toString() + '</div>');
            continue;
        }

        if (tag === 'img') {
            out.push(figure(node));
            continue;
        }

        if (tag === 'p') {
            const imgs = node.querySelectorAll('img');
            if (imgs.length === 1 && !node.text.trim() && node.childNodes.filter(
                (c) => (c.tagName || '').toLowerCase() === 'img').length === 1) {
                out.push(figure(imgs[0]));
                continue;
            }
        }

        out.push(node.toString());
    }

    if (decorative.length) {
        ctx.decorativeImages.push({ item: item.title, url: item.url, images: decorative });
    }

    return out.join('\n');
}

/** صورة على مسار wide، وتعليق إن كان النصّ البديل جملةً لا اسم ملف */
function figure(img) {
    const alt = (img.getAttribute('alt') || '').trim();
    const caption = alt && alt.length > 3 && !looksLikeFilename(alt)
        ? `<figcaption>${S.escapeHtml(alt)}</figcaption>`
        : '';
    return `<figure>${img.toString()}${caption}</figure>`;
}

/* ============================================================================
   ٦. البطاقات — الترميز نفسه الذي تبنيه سكربتات العرض
   ============================================================================ */

const dateCell = (item) => item.date
    ? `<time datetime="${S.escapeAttr(item.date)}">${S.escapeHtml(S.formatDate(item.date))}</time>`
    : '';

function articleMetaRow(item) {
    return `            <div class="article-card-meta">
                <span class="article-card-date">${dateCell(item)}</span>
                <span class="article-card-category">${S.escapeHtml(item.category || '')}</span>
                <span class="article-read-time">${item.readTime ? S.escapeHtml(S.readTime(item.readTime)) : ''}</span>
            </div>`;
}

function articleLeadHtml(item) {
    const cover = item.cover
        ? `            <img class="article-lead-cover" src="/${S.escapeAttr(item.cover)}" alt=""
                 loading="eager" fetchpriority="high" decoding="async"${dims(item.coverSize)}>`
        : '';
    return `        <a class="article-lead rv" data-id="${S.escapeAttr(item.id)}" href="${S.escapeAttr(item.url)}">
${cover}
            <h2 class="article-lead-title">${S.escapeHtml(item.title)}</h2>
${articleMetaRow(item)}
        </a>`;
}

function articleCardHtml(item) {
    const cover = item.cover
        ? `            <div class="article-card-image-wrapper">
                <img class="article-card-image" src="/${S.escapeAttr(item.cover)}" alt=""
                     loading="lazy" decoding="async"${dims(item.coverSize)}>
            </div>`
        : '';
    const tags = item.topics.slice(0, 3)
        .map((t) => `<span class="article-tag">${S.escapeHtml(t)}</span>`).join('');

    return `        <a class="article-card rv" data-id="${S.escapeAttr(item.id)}" href="${S.escapeAttr(item.url)}">
${cover}
            <div class="article-card-content">
                <h3 class="article-card-title">${S.escapeHtml(item.title)}</h3>
                <p class="article-card-title-en">${S.escapeHtml(item.titleEn)}</p>
                <p class="article-card-description">${S.escapeHtml(item.rawDescription)}</p>
${articleMetaRow(item)}
                <div class="article-card-footer">
                    <div class="article-card-tags">${tags}</div>
                </div>
            </div>
        </a>`;
}

function projectCardHtml(item) {
    const cover = item.cover
        ? `            <div class="project-card-image-wrapper">
                <img class="project-card-image" src="/${S.escapeAttr(item.cover)}" alt=""
                     loading="lazy" decoding="async"${dims(item.coverSize)}>
            </div>`
        : '';
    const categories = item.topics.slice(0, 4)
        .map((c) => `<span class="category-tag">${S.escapeHtml(c)}</span>`).join('');
    const preview = item.previewLink
        ? `\n                    <a class="project-card-btn project-card-btn-preview"
                       href="${S.escapeAttr(item.previewLink)}" target="_blank" rel="noopener" data-en="Live preview">معاينة المشروع</a>`
        : '';
    // <bdi> يعزل اتجاه العنوان اللاتيني داخل السطر فقط — نفس قرار projects.js
    const title = S.isLatin(item.title)
        ? `<bdi dir="ltr">${S.escapeHtml(item.title)}</bdi>`
        : S.escapeHtml(item.title);

    return `        <article class="project-card rv" data-id="${S.escapeAttr(item.id)}" data-categories="${S.escapeAttr(JSON.stringify(item.topics))}">
${cover}
            <div class="project-card-content">
                <h3 class="project-card-title">${title}</h3>
                <p class="project-card-summary">${S.escapeHtml(item.rawDescription)}</p>
                <div class="project-card-meta">
                    <span class="project-card-date">${dateCell(item)}</span>
                    <span class="project-card-read">${item.readTime ? S.escapeHtml(S.readTime(item.readTime)) : ''}</span>
                </div>
                <div class="project-card-categories">${categories}</div>
                <div class="project-card-actions">
                    <a class="project-card-btn project-card-btn-details project-card-link"
                       href="${S.escapeAttr(item.url)}" data-en="Read more">اقرأ المزيد</a>${preview}
                </div>
            </div>
        </article>`;
}

const dims = (size) => (size ? ` width="${size.w}" height="${size.h}"` : '');

/* ============================================================================
   ٧. الصفحات
   ============================================================================ */

const SHARE_ICONS = require('./lib/share-icons');

function shareBlock(kind, absoluteUrl, title) {
    const url = encodeURIComponent(absoluteUrl);
    const text = encodeURIComponent(title);
    const label = kind === 'article' ? 'شارك المقال' : 'شارك المشروع';
    const labelEn = kind === 'article' ? 'Share this article' : 'Share this project';
    const aria = (ar, en) => `aria-label="${S.escapeAttr(ar)}" data-en-label="${S.escapeAttr(en)}"`;

    if (kind === 'article') {
        return `<div class="article-share">
                <span class="article-share-label" data-en="${S.escapeAttr(labelEn)}">${label}</span>
                <button class="share-btn" type="button" data-copy-link ${aria('نسخ الرابط', 'Copy link')}>${SHARE_ICONS.link}</button>
                <a class="share-btn" href="https://twitter.com/intent/tweet?text=${text}&amp;url=${url}" target="_blank" rel="noopener" ${aria('مشاركة على X', 'Share on X')}>${SHARE_ICONS.x}</a>
                <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener" ${aria('مشاركة على LinkedIn', 'Share on LinkedIn')}>${SHARE_ICONS.linkedin}</a>
                <a class="share-btn" href="https://wa.me/?text=${text}%20${url}" target="_blank" rel="noopener" ${aria('مشاركة على WhatsApp', 'Share on WhatsApp')}>${SHARE_ICONS.whatsapp}</a>
            </div>`;
    }
    return `<div class="share-buttons-container">
                <span class="share-buttons-label" data-en="${S.escapeAttr(labelEn)}">${label}</span>
                <div class="share-buttons-row">
                    <button class="share-icon-btn" type="button" data-copy-link ${aria('نسخ الرابط', 'Copy link')}>${SHARE_ICONS.link}</button>
                    <a class="share-icon-btn" href="https://twitter.com/intent/tweet?text=${text}&amp;url=${url}" target="_blank" rel="noopener" ${aria('مشاركة على X', 'Share on X')}>${SHARE_ICONS.x}</a>
                    <a class="share-icon-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener" ${aria('مشاركة على LinkedIn', 'Share on LinkedIn')}>${SHARE_ICONS.linkedin}</a>
                    <a class="share-icon-btn" href="https://wa.me/?text=${text}%20${url}" target="_blank" rel="noopener" ${aria('مشاركة على WhatsApp', 'Share on WhatsApp')}>${SHARE_ICONS.whatsapp}</a>
                </div>
            </div>`;
}

/** تذييل النشر: السابق/التالي، ثم المرتبط، ثم الموضوعات، ثم العودة */
function detailFooter(item, ordered, index, ctx) {
    const isArticle = item.kind === 'article';
    const prev = ordered[index - 1];
    const next = ordered[index + 1];
    const L = isArticle
        ? { prev: ['المقال السابق', 'Previous article'], next: ['المقال التالي', 'Next article'],
            more: ['مقالات أخرى', 'More writing'], back: ['كل المقالات', 'All writing'], backHref: '/articles/' }
        : { prev: ['المشروع السابق', 'Previous project'], next: ['المشروع التالي', 'Next project'],
            more: ['مشاريع أخرى', 'More projects'], back: ['كل المشاريع', 'All projects'], backHref: '/projects/' };
    const label = (pair) => `data-en="${S.escapeAttr(pair[1])}">${S.escapeHtml(pair[0])}`;

    let html = '';
    if (prev || next) {
        html += '            <div class="article-nav">\n';
        if (prev) {
            html += `                <a class="article-nav-item prev" href="${S.escapeAttr(prev.url)}">
                    <span class="article-nav-label" ${label(L.prev)}</span>
                    <span class="article-nav-title">${S.escapeHtml(prev.title)}</span></a>\n`;
        }
        if (next) {
            html += `                <a class="article-nav-item next" href="${S.escapeAttr(next.url)}">
                    <span class="article-nav-label" ${label(L.next)}</span>
                    <span class="article-nav-title">${S.escapeHtml(next.title)}</span></a>\n`;
        }
        html += '            </div>\n';
    }

    // مرتبط بالموضوع — الجسر بين المقالات والمشاريع في الاتجاهين
    if (item.related && item.related.length) {
        html += `            <div><h2 class="article-footer-heading" data-en="Related">محتوى ذو صلة</h2><div class="article-footer-more">\n`
            + item.related.map((r) => `                <a href="${S.escapeAttr(r.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(r.title)}</span>
                    <span data-en="${r.kind === 'article' ? 'Article' : 'Project'}">${r.kind === 'article' ? 'مقال' : 'مشروع'}</span></a>`).join('\n')
            + '\n            </div></div>\n';
    }

    // بقيّة القسم — يبقى كما كان: قائمة قصيرة بما لم يظهر أعلاه
    const shown = new Set([prev && prev.id, next && next.id, item.id,
        ...(item.related || []).map((r) => r.id)]);
    const others = ordered.filter((o) => !shown.has(o.id)).slice(0, 3);
    if (others.length) {
        html += `            <div><h2 class="article-footer-heading" ${label(L.more)}</h2><div class="article-footer-more">\n`
            + others.map((o) => `                <a href="${S.escapeAttr(o.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(o.title)}</span>
                    <span>${o.readTime ? S.escapeHtml(S.readTime(o.readTime, false)) : ''}</span></a>`).join('\n')
            + '\n            </div></div>\n';
    }

    // الموضوعات — المدخل الوحيد إلى أرشيف المواضيع من داخل المحتوى
    if (item.topicLinks && item.topicLinks.length) {
        html += `            <div><h2 class="article-footer-heading" data-en="Topics">الموضوعات</h2><div class="article-footer-more">\n`
            + item.topicLinks.map((t) => `                <a href="${S.escapeAttr(t.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(t.name)}</span>
                    <span>${S.toArabicDigits(t.items.length)}</span></a>`).join('\n')
            + '\n            </div></div>\n';
    }

    html += `            <a class="btn btn-secondary article-footer-back" href="${L.backHref}" ${label(L.back)}</a>`;
    return html;
}

/** البيانات التي يحتاجها js/article.js لإعادة الصياغة عند تبديل اللغة */
function pageData(item, ctx) {
    return {
        kind: item.kind,
        id: item.id,
        title: item.title,
        date: item.date,
        readTime: item.readTime,
        url: `${ctx.site.origin}${item.url}`
    };
}

function detailPage(item, ordered, index, ctx) {
    const site = ctx.site;
    const isArticle = item.kind === 'article';
    const section = isArticle ? site.sections.articles : site.sections.projects;
    const canonical = `${site.origin}${item.url}`;

    const bodyClass = isArticle ? 'article-body' : 'article-body project-detail-body';
    const bodyId = isArticle ? 'article-body' : 'project-body';

    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: `${section.brand_ar} — ${section.label_ar}`, en: `${section.brand_en} — ${section.label_en}`, url: `/${section.slug}/` },
        { name: item.title, url: null }
    ];

    const cover = item.cover
        ? `                <img id="${isArticle ? 'article' : 'project'}-cover" class="${isArticle ? 'article-cover' : 'project-detail-cover'}" src="/${S.escapeAttr(item.cover)}" alt=""${dims(item.coverSize)}>`
        : `                <img id="${isArticle ? 'article' : 'project'}-cover" class="${isArticle ? 'article-cover' : 'project-detail-cover'}" src="" alt="" hidden>`;

    const title = (!isArticle && S.isLatin(item.title))
        ? `<bdi dir="ltr">${S.escapeHtml(item.title)}</bdi>`
        : S.escapeHtml(item.title);

    const metaRow = isArticle
        ? `                <span id="article-date" class="article-date">${dateCell(item)}</span>
                <span id="article-category" class="article-category">${S.escapeHtml(item.category || '')}</span>
                <span id="article-read-time" class="article-read-time">${item.readTime ? S.escapeHtml(S.readTime(item.readTime)) : ''}</span>`
        : `                <span id="project-date" class="project-detail-date">${dateCell(item)}</span>
                <span id="project-read-time" class="project-detail-read-time">${item.readTime ? S.escapeHtml(S.readTime(item.readTime)) : ''}</span>
                <span id="project-categories" class="project-detail-categories">${item.topics.map((c) => `<span class="category-tag">${S.escapeHtml(c)}</span>`).join('')}</span>`;

    const previewBlock = (!isArticle && item.previewLink)
        ? `
            <div id="project-preview-wrapper" class="project-detail-preview-wrapper">
                <a id="project-preview-link" href="${S.escapeAttr(item.previewLink)}" class="btn btn-primary project-preview-btn"
                   target="_blank" rel="noopener">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    <span data-en="Live preview">معاينة المشروع</span>
                </a>
            </div>`
        : '';

    const head = C.head({
        title: item.pageTitle,
        description: item.description,
        canonical,
        ogType: 'article',
        og: {
            image: item.og.url, imageWidth: item.og.width, imageHeight: item.og.height,
            imageAlt: item.title, title: item.title, description: item.description
        },
        publishedTime: S.isoDate(item.date),
        modifiedTime: S.isoDate(item.lastEdited || item.date),
        articleTags: item.topics,
        css: isArticle
            ? ['style.css', 'animations.css', 'article.css', 'responsive.css']
            : ['style.css', 'animations.css', 'article.css', 'project.css', 'responsive.css'],
        js: [],
        jsonLd: [schemaForItem(item, ctx), schemaBreadcrumb(trail, ctx)],
        cacheBuster: site.cacheBuster
    });

    const emblem = isArticle
        ? { href: '/articles/', src: '/assets/logos/ban.webp', alt: 'بان', w: 406, h: 440 }
        : { href: '/projects/', src: '/assets/logos/dhura.webp', alt: 'ذُرى', w: 360, h: 440 };

    return `${head}
<body>
    <a class="skip-link" data-en="Skip to ${isArticle ? 'article' : 'project'}" href="#${bodyId}">تخطَّ إلى ${isArticle ? 'المقال' : 'المشروع'}</a>

${C.navbar(isArticle ? 'articles' : 'projects', emblem)}

    <!-- Main Content -->
    <main id="${isArticle ? 'articleContainer' : 'projectContainer'}">

${C.breadcrumb(trail)}

        <!-- المحتوى مصيَّر مسبقاً: لا جلب، ولا دوّارة، ولا رسالة noscript.
             dir="rtl" مثبَّت في الترميز ولا يمسّه مبدّل اللغة — المصدر عربيّ
             كما كتبه صاحبه. -->
        <article class="article breakout" dir="rtl" lang="ar" id="${isArticle ? 'articleShell' : 'projectShell'}" data-id="${S.escapeAttr(item.id)}" data-static="1">

            <div class="article-cover-wrapper u-wide">
${cover}
            </div>

            <header class="article-header">
                <h1 id="${isArticle ? 'article' : 'project'}-title" class="article-title">${title}</h1>
            </header>

            <div class="article-rule" aria-hidden="true"></div>

            <div class="article-meta">
${metaRow}
            </div>
${previewBlock}
            <div id="${bodyId}" class="${bodyClass}">
${renderProse(item, ctx)}
            ${shareBlock(item.kind, canonical, item.title)}
            </div>

        </article>

        <nav class="article-footer breakout" id="${isArticle ? 'articleFooter' : 'projectFooter'}" aria-label="تصفّح ${isArticle ? 'المقالات' : 'المشاريع'}" data-en-label="Browse ${isArticle ? 'articles' : 'projects'}">
${detailFooter(item, ordered, index, ctx)}
        </nav>

    </main>

${C.FOOTER}

    <script type="application/json" id="pageData">${JSON.stringify(pageData(item, ctx)).replace(/</g, '\\u003c')}</script>

${C.scripts(['js/i18n.js', 'js/covers.js', 'main.js', 'animations.js',
        isArticle ? 'js/article.js' : 'js/project.js', 'effects.js'], site.cacheBuster)}
</body>
</html>
`;
}

/* ── الفهارس ─────────────────────────────────────────────────────────────── */

/**
 * وصف صفحة الفهرس. النصّ الثابت من data/site.json، ثم عناوين حقيقية من
 * البيانات حتى الحدّ — فيبقى الوصف مشتقّاً لا مؤلَّفاً، ويتجدّد وحده.
 */
function indexDescription(base, items, connector) {
    if (!items.length) return base;
    const titles = items.map((i) => `«${i.title}»`).join('، ');
    return S.clampText(`${base}. ${connector}: ${titles}.`, { min: 110, max: 160 });
}

function articlesIndexPage(ctx) {
    const site = ctx.site;
    const s = site.sections.articles;
    const canonical = `${site.origin}/articles/`;
    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: `${s.brand_ar} — ${s.label_ar}`, en: `${s.brand_en} — ${s.label_en}`, url: null }
    ];

    const [lead, ...rest] = ctx.articles;
    const grid = ctx.articles.length
        ? [articleLeadHtml(lead), ...rest.map(articleCardHtml)].join('\n')
        : `        <div class="no-articles">
            <h2 class="error-title">لا توجد مقالات بعد</h2>
            <p class="error-message">ستُضاف مقالات قريباً.</p>
        </div>`;

    const head = C.head({
        title: S.buildTitle(`مدوّنة ${s.brand_ar}`, site.name_ar),
        description: indexDescription(s.description_ar, ctx.articles, 'أحدث المنشور'),
        canonical,
        ogType: 'website',
        og: {
            image: ctx.ogFixed.articles.url,
            imageWidth: ctx.ogFixed.articles.width,
            imageHeight: ctx.ogFixed.articles.height,
            title: s.title_ar, description: s.og_description_ar
        },
        css: ['style.css', 'animations.css', 'article.css', 'responsive.css'],
        jsonLd: [schemaCollection({
            name: `مدوّنة ${s.brand_ar}`, description: s.description_ar,
            url: canonical, items: ctx.articles
        }, ctx), schemaBreadcrumb(trail, ctx)],
        cacheBuster: site.cacheBuster
    });

    return `${head}
<body>
    <a class="skip-link" data-en="Skip to articles" href="#articles-grid">تخطَّ إلى المقالات</a>

${C.navbar('articles', { href: '/', src: '/assets/logos/ban.webp', alt: 'بان', w: 406, h: 440 })}

    <!-- Main Content -->
    <main class="publication">
${C.breadcrumb(trail)}

        <!-- رأس الصفحة: ماستهيد مدوّنة «بان» — الشعار، الاسم، تعريفه، ثم المقدّمة -->
        <header class="page-header breakout ban-masthead">
            <h1 class="page-title ban-title rv" data-en="Ban Blog">مدوّنة <span class="swash">بان</span></h1>
            <figure class="ban-emblem rv">
                <img src="/assets/logos/ban.webp"
                     alt="ريشة زرقاء على ورقة — شعار مدوّنة بان"
                     width="406" height="440" fetchpriority="high" decoding="async">
            </figure>
            <p class="ban-kicker rv" data-en="Reflections &amp; essays">خاطرة ومقال</p>
            <p class="ban-definition rv" data-en="Bān, in Arabic: to appear and become clear.">
                <span class="ban-def-label">بان في اللغة:</span> ظهر واتّضح.
            </p>
            <div class="ban-intro rv">
                <p data-en="Here I write about what stirs my curiosity and is worth pausing over — in technology and work, in reading and experience, and in ideas that knock on the mind and do not leave quickly.">أكتب هنا عمّا يثير فضولي ويستحق التوقّف عنده؛ في التقنية والعمل، وفي القراءة والتجارب، وفي الأفكار التي تطرق الذهن ولا تغادره سريعًا.</p>
                <p data-en="A space for what I learn, what I see from a different angle, and what deserves to be understood deeply — to be written and published with care.">مساحة لما أتعلمه، وما أراه من زاوية مختلفة، وما يستحق أن يُفهم بعمق، ليُكتب ويُنشر بإحسان.</p>
            </div>
        </header>

        <!-- الفهرس: مقال الصدارة ثم القائمة — مصيَّر مسبقاً، وجافاسكربت
             تعيد بناءه عند تبديل اللغة وحده. -->
        <section class="articles-section breakout" aria-label="فهرس المقالات" data-en-label="Article index">
            <p class="visually-hidden" id="gridStatus" role="status" aria-live="polite"></p>
            <div id="articles-grid" class="articles-grid" data-prerendered="1">
${grid}
            </div>
        </section>
    </main>

${C.FOOTER}

${C.scripts(['js/i18n.js', 'js/covers.js', 'main.js', 'animations.js', 'js/articles-list.js'], site.cacheBuster)}
</body>
</html>
`;
}

function projectsIndexPage(ctx) {
    const site = ctx.site;
    const s = site.sections.projects;
    const canonical = `${site.origin}/projects/`;
    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: `${s.brand_ar} — ${s.label_ar}`, en: `${s.brand_en} — ${s.label_en}`, url: null }
    ];

    const categories = dedupe(ctx.projects.flatMap((p) => p.topics)).sort();
    const filters = ['            <button class="filter-btn active" type="button" data-filter="all" aria-pressed="true" data-en="All">الكل</button>']
        .concat(categories.map((c) =>
            `            <button class="filter-btn" type="button" data-filter="${S.escapeAttr(c)}" aria-pressed="false">${S.escapeHtml(c)}</button>`))
        .join('\n');

    const grid = ctx.projects.length
        ? ctx.projects.map(projectCardHtml).join('\n')
        : `        <div class="no-projects">
            <h2 class="error-title">لا توجد مشاريع بعد</h2>
            <p class="error-message">ستُضاف مشاريع قريباً.</p>
        </div>`;

    const head = C.head({
        title: S.buildTitle(`${s.brand_ar} — ${s.label_ar}`, site.name_ar),
        description: indexDescription(s.description_ar, ctx.projects, 'منها'),
        canonical,
        ogType: 'website',
        og: {
            image: ctx.ogFixed.projects.url,
            imageWidth: ctx.ogFixed.projects.width,
            imageHeight: ctx.ogFixed.projects.height,
            title: s.title_ar, description: s.og_description_ar
        },
        css: ['style.css', 'animations.css', 'project.css', 'responsive.css'],
        jsonLd: [schemaCollection({
            name: `${s.brand_ar} — ${s.label_ar}`, description: s.description_ar,
            url: canonical, items: ctx.projects
        }, ctx), schemaBreadcrumb(trail, ctx)],
        cacheBuster: site.cacheBuster
    });

    return `${head}
<body>
    <a class="skip-link" data-en="Skip to projects" href="#projectsGrid">تخطَّ إلى المشاريع</a>

${C.navbar('projects', { href: '/', src: '/assets/logos/dhura.webp', alt: 'ذُرى', w: 360, h: 440 })}

    <!-- Main Content -->
    <main class="publication dhura">
${C.breadcrumb(trail)}

        <!-- ماستهيد «ذُرى» — العنوان، الشعار المفرّغ، الوصف، التعريف، ثم المقدّمة -->
        <header class="page-header breakout page-masthead">
            <h1 class="page-title masthead-title rv" data-en="Dhura"><span class="swash">ذُرى</span></h1>
            <figure class="masthead-emblem rv">
                <img src="/assets/logos/dhura.webp"
                     alt="قمم برتقالية متدرّجة — شعار مشاريع ذُرى"
                     width="360" height="440" fetchpriority="high" decoding="async">
            </figure>
            <p class="masthead-kicker rv" data-en="Projects in data &amp; AI">مشاريع في البيانات والذكاء الاصطناعي</p>
            <p class="masthead-lead rv" data-en="Dhura is the plural of ‘dhurwa’ — a summit. It is where I document the best of what I have reached in data and AI projects and experiments.">
                <span class="masthead-lead-label">ذُرى جمع ذروة؛</span> وهي المساحة التي أوثّق فيها أفضل ما وصلت إليه من مشاريع وتجارب في البيانات والذكاء الاصطناعي.
            </p>
            <div class="masthead-intro rv">
                <p data-en="Every project here is an independent summit; it began with a question worth exploring, and took shape through research, experimentation, decisions, and overcoming challenges — until it reached a clear, usable solution.">كل مشروع هنا هو <strong>ذروة مستقلة</strong>؛ بدأ بسؤال يستحق الاستكشاف، وتشكّل عبر البحث والتجربة واتخاذ القرارات وتجاوز التحديات، حتى وصل إلى حلّ واضح وقابل للاستخدام.</p>
                <p data-en="I don’t show only the final result, but what led to it: the problem, the approach, the decisions, and what I learned along the way.">لا أعرض النتيجة النهائية فحسب، بل ما قاد إليها: <strong>المشكلة، والمنهج، والقرارات، وما تعلّمته على الطريق.</strong></p>
            </div>
        </header>

        <section class="projects-section breakout" aria-label="فهرس المشاريع" data-en-label="Project index">
            <!-- الفلاتر مصيَّرة مسبقاً من categories[] في البيانات -->
            <div class="filters" id="projectFilters" role="group" aria-label="تصفية المشاريع حسب التصنيف" data-en-label="Filter projects by category" data-prerendered="1">
${filters}
            </div>

            <h2 class="visually-hidden" data-en="Projects">المشاريع</h2>
            <p class="visually-hidden" id="gridStatus" role="status" aria-live="polite"></p>
            <div class="projects-grid" id="projectsGrid" data-prerendered="1">
${grid}
            </div>

            <div class="error-state" id="errorState" hidden>
                <h2 class="error-title" data-en="Could not load projects">تعذّر تحميل المشاريع</h2>
                <p class="error-message" data-en="Something went wrong loading the projects. Please try again later.">حدث خطأ في تحميل المشاريع. يرجى المحاولة لاحقاً.</p>
                <button class="btn btn-secondary" type="button" onclick="location.reload()" data-en="Try again">إعادة المحاولة</button>
            </div>
        </section>
    </main>

${C.FOOTER}

${C.scripts(['js/i18n.js', 'js/covers.js', 'main.js', 'animations.js', 'projects.js'], site.cacheBuster)}
</body>
</html>
`;
}

/* ── الموضوعات ──────────────────────────────────────────────────────────── */

/**
 * العربية تميّز أربع حالات عدديّة — نفس القاعدة المعمول بها في I18N.readTime:
 *   ١ ⇒ مفرد · ٢ ⇒ مثنّى · ٣–١٠ ⇒ جمع قلّة · ١١+ ⇒ تمييز مفرد منصوب
 */
function countLabel(n, [one, two, few, many]) {
    if (!n) return '';
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return `${S.toArabicDigits(n)} ${few}`;
    return `${S.toArabicDigits(n)} ${many}`;
}

function topicPage(topic, ctx) {
    const site = ctx.site;
    const canonical = `${site.origin}${topic.url}`;
    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: site.sections.topics.label_ar, en: site.sections.topics.label_en, url: '/topics/' },
        // الوسم يجلس تحت محوره، فيقرأ الزاحف البنية لا القائمة المسطّحة
        ...(topic.pillar ? [{ name: topic.pillar.name, url: topic.pillar.url }] : []),
        { name: topic.name, url: null }
    ];

    const articles = topic.items.filter((i) => i.kind === 'article');
    const projects = topic.items.filter((i) => i.kind === 'project');

    const counts = [
        countLabel(articles.length, ['مقال واحد', 'مقالان', 'مقالات', 'مقالاً']),
        countLabel(projects.length, ['مشروع واحد', 'مشروعان', 'مشاريع', 'مشروعاً'])
    ].filter(Boolean).join(' و');

    const description = S.clampText(
        `كل ما كُتب وما بُني في «${topic.name}» على موقع ${site.name_ar}: ${counts}. `
        + (topic.isPillar && topic.topics.length
            ? topic.topics.map((t) => t.name).join('، ')
            : topic.items.map((i) => i.title).join('، ')),
        { min: 100, max: 160 }
    );

    const list = (items) => `            <div class="article-footer-more">
${items.map((i) => `                <a href="${S.escapeAttr(i.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(i.title)}</span>
                    <span${i.readTime ? '' : ` data-en="${i.kind === 'article' ? 'Article' : 'Project'}"`}>${i.readTime ? S.escapeHtml(S.readTime(i.readTime, false)) : (i.kind === 'article' ? 'مقال' : 'مشروع')}</span></a>`).join('\n')}
            </div>`;

    const head = C.head({
        title: S.buildTitle(topic.name, site.name_ar),
        description,
        canonical,
        ogType: 'website',
        og: {
            image: topic.og.url, imageWidth: topic.og.width, imageHeight: topic.og.height,
            title: topic.name, description
        },
        css: ['style.css', 'animations.css', 'article.css', 'responsive.css'],
        jsonLd: [schemaCollection({
            name: topic.name, description, url: canonical, items: topic.items
        }, ctx), schemaBreadcrumb(trail, ctx)],
        cacheBuster: site.cacheBuster
    });

    return `${head}
<body>
    <a class="skip-link" data-en="Skip to content" href="#topic-items">تخطَّ إلى المحتوى</a>

${C.navbar(null, { href: '/', src: '/assets/logos/ban.webp', alt: 'بان', w: 406, h: 440 })}

    <main class="publication">
${C.breadcrumb(trail)}

        <header class="page-header breakout">
            <h1 class="page-title rv">${S.escapeHtml(topic.name)}</h1>
            <p class="section-label rv">${S.escapeHtml(counts)} في هذا الموضوع</p>
        </header>

        <section class="articles-section breakout" id="topic-items" aria-label="محتوى الموضوع">
            <div class="articles-grid">
${topic.isPillar && topic.topics.length ? `                <div><h2 class="article-footer-heading" data-en="Topics in this pillar">موضوعات هذا المحور</h2>
            <div class="article-footer-more">
${topic.topics.map((t) => `                <a href="${S.escapeAttr(t.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(t.name)}</span>
                    <span>${S.toArabicDigits(t.items.length)}</span></a>`).join('\n')}
            </div></div>` : ''}
${articles.length ? `                <div><h2 class="article-footer-heading" data-en="From the Ban blog">من مدوّنة بان</h2>\n${list(articles)}</div>` : ''}
${projects.length ? `                <div><h2 class="article-footer-heading" data-en="From the Dhura projects">من مشاريع ذُرى</h2>\n${list(projects)}</div>` : ''}
${topic.pillar ? `                <div><h2 class="article-footer-heading" data-en="Part of">ضمن محور</h2>
            <div class="article-footer-more">
                <a href="${S.escapeAttr(topic.pillar.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(topic.pillar.name)}</span>
                    <span>${S.toArabicDigits(topic.pillar.items.length)}</span></a>
            </div></div>` : ''}
                <a class="btn btn-secondary article-footer-back" href="/topics/" data-en="All topics">كل الموضوعات</a>
            </div>
        </section>
    </main>

${C.FOOTER}

${C.scripts(['js/i18n.js', 'main.js', 'animations.js'], site.cacheBuster)}
</body>
</html>
`;
}

function topicsHubPage(ctx) {
    const site = ctx.site;
    const t = site.sections.topics;
    const canonical = `${site.origin}/topics/`;
    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: t.label_ar, en: t.label_en, url: null }
    ];

    const rows = (topics) => `            <div class="article-footer-more">
${topics.map((topic) => `                <a href="${S.escapeAttr(topic.url)}">
                    <span class="article-footer-more-title">${S.escapeHtml(topic.name)}</span>
                    <span>${S.toArabicDigits(topic.items.length)}</span></a>`).join('\n')}
            </div>`;

    /* مجمَّعة بالمحاور لا قائمةً مسطّحة: البنية إشارة للزاحف كما هي دلالة
       للقارئ. والمحاور الخالية لا تظهر — لا صفحة لها أصلاً. */
    const live = ctx.pillars.filter((pl) => pl.items.length);
    const loose = ctx.topics.filter((t) => !t.pillar);

    const list = ctx.topics.length
        ? [
            ...live.map((pl) => `                <div><h2 class="article-footer-heading">${S.escapeHtml(pl.name)}</h2>
${rows([pl, ...pl.topics])}</div>`),
            ...(loose.length ? [`                <div><h2 class="article-footer-heading" data-en="Other topics">موضوعات أخرى</h2>\n${rows(loose)}</div>`] : [])
        ].join('\n')
        : `            <p class="error-message">لا موضوعات بعد.</p>`;

    const head = C.head({
        title: S.buildTitle(t.label_ar, site.name_ar),
        description: t.description_ar,
        canonical,
        ogType: 'website',
        og: {
            image: ctx.ogFixed.topics.url,
            imageWidth: ctx.ogFixed.topics.width,
            imageHeight: ctx.ogFixed.topics.height,
            title: t.title_ar, description: t.description_ar
        },
        css: ['style.css', 'animations.css', 'article.css', 'responsive.css'],
        jsonLd: [{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: t.label_ar,
            description: t.description_ar,
            url: canonical,
            inLanguage: 'ar',
            isPartOf: { '@type': 'WebSite', '@id': `${site.origin}/#website` },
            hasPart: ctx.topics.map((topic) => ({
                '@type': 'CollectionPage',
                name: topic.name,
                url: `${site.origin}${topic.url}`
            }))
        }, schemaBreadcrumb(trail, ctx)],
        cacheBuster: site.cacheBuster
    });

    return `${head}
<body>
    <a class="skip-link" data-en="Skip to content" href="#topics-list">تخطَّ إلى المحتوى</a>

${C.navbar(null, { href: '/', src: '/assets/logos/ban.webp', alt: 'بان', w: 406, h: 440 })}

    <main class="publication">
${C.breadcrumb(trail)}

        <header class="page-header breakout">
            <h1 class="page-title rv">${S.escapeHtml(t.label_ar)}</h1>
            <p class="section-label rv">${S.escapeHtml(t.description_ar)}</p>
        </header>

        <section class="articles-section breakout" id="topics-list" aria-label="فهرس الموضوعات">
            <div class="articles-grid">
${list}
            </div>
        </section>
    </main>

${C.FOOTER}

${C.scripts(['js/i18n.js', 'main.js', 'animations.js'], site.cacheBuster)}
</body>
</html>
`;
}

/* ============================================================================
   ٨. البيانات المنظّمة
   ============================================================================ */

/**
 * الكيان «محمد الزبيدي». محرّكات البحث وأسطح الإجابة تحتاج أن تفهم **من**
 * هو، لا ما تقوله صفحة بعينها — فهذا الكيان هو ما يُقتبس ويُنسب إليه.
 *
 * قاعدة صارمة: **لا حقل بلا مصدر على الموقع.** ‏alumniOf مثلاً غائب لأن
 * الموقع لا يذكر جامعةً ولا شهادة في أي موضع؛ التصريح به ادّعاء لا بيان.
 */
function schemaPerson(ctx) {
    const site = ctx.site;
    const p = site.person;

    // المحاور الأربعة بلسانين: هي ما يريد أن يُعرَف به، والزاحف لا يستنتجه
    const pillars = (site.pillars || []).flatMap((pl) => [pl.name_ar, pl.name_en]);
    const knowsAbout = [...new Set([...pillars, ...p.knowsAbout_ar])];

    const country = (c) => ({ '@type': 'Country', name: c.name_ar, alternateName: c.name_en });

    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${site.origin}/#person`,
        name: site.name_ar,
        alternateName: site.name_en,
        url: `${site.origin}/`,
        image: `${site.origin}/${p.image}`,
        jobTitle: site.positioning.search_role_ar,
        description: site.home.og_description_ar,
        email: `mailto:${p.email}`,
        telephone: p.telephone,
        address: { '@type': 'PostalAddress', addressCountry: p.addressCountry },
        // مسنود بمفتاح الهاتف +966 وبـaddressCountry المعلن أصلاً
        homeLocation: country((p.areaServed || []).find((c) => c.code === p.addressCountry)
            || { name_ar: 'المملكة العربية السعودية', name_en: 'Saudi Arabia' }),
        areaServed: (p.areaServed || []).map(country),
        knowsAbout,
        sameAs: p.sameAs
    };
}

function schemaWebsite(ctx) {
    const site = ctx.site;
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${site.origin}/#website`,
        url: `${site.origin}/`,
        name: site.name_ar,
        alternateName: site.name_en,
        inLanguage: 'ar',
        publisher: { '@id': `${site.origin}/#person` }
        // لا SearchAction: لا بحث داخل الموقع. التصريح به بلا مسار حقيقي
        // إعلانُ ميزةٍ غير موجودة، وهو خطأ في أداة الاختبار وكذبٌ للزاحف.
    };
}

function schemaForItem(item, ctx) {
    const site = ctx.site;
    const base = {
        '@context': 'https://schema.org',
        headline: S.clampText(item.title, { min: 20, max: 110 }),
        name: item.title,
        description: item.description || undefined,
        image: [item.og.url],
        url: `${site.origin}${item.url}`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${site.origin}${item.url}` },
        inLanguage: 'ar',
        author: { '@id': `${site.origin}/#person` },
        publisher: { '@id': `${site.origin}/#person` },
        isPartOf: { '@type': 'WebSite', '@id': `${site.origin}/#website` }
    };

    if (item.date) base.datePublished = S.isoDate(item.date);
    if (item.lastEdited) base.dateModified = S.isoDate(item.lastEdited);
    if (item.topics.length) base.keywords = item.topics.join(', ');

    /* ‏about = موضوع النصّ الأعمّ (محوره)، و mentions = ما يذكره بعينه
       (وسومه). كلاهما مشتقّ من قيم حقيقية في البيانات؛ وبلا وسوم لا
       يُصدَر أيّهما — حقلٌ فارغ أسوأ من حقل غائب. */
    const pillars = [...new Set((item.topicLinks || [])
        .map((t) => t.pillar).filter(Boolean))];
    if (pillars.length) {
        base.about = pillars.map((pl) => ({
            '@type': 'Thing', name: pl.name, url: `${site.origin}${pl.url}`
        }));
    }
    if (item.topicLinks && item.topicLinks.length) {
        base.mentions = item.topicLinks.map((t) => ({
            '@type': 'Thing', name: t.name, url: `${site.origin}${t.url}`
        }));
    }

    if (item.kind === 'article') {
        return Object.assign({ '@type': 'BlogPosting' }, base, {
            wordCount: S.htmlToText(item.contentHtml).split(/\s+/).filter(Boolean).length,
            timeRequired: item.readTime ? `PT${item.readTime}M` : undefined
        });
    }

    return Object.assign({ '@type': 'CreativeWork' }, base, {
        creator: { '@id': `${site.origin}/#person` },
        genre: item.topics,
        ...(item.previewLink ? { workExample: { '@type': 'WebPage', url: item.previewLink } } : {})
    });
}

function schemaCollection(o, ctx) {
    const site = ctx.site;
    return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: o.name,
        description: o.description,
        url: o.url,
        inLanguage: 'ar',
        isPartOf: { '@type': 'WebSite', '@id': `${site.origin}/#website` },
        about: { '@id': `${site.origin}/#person` },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: o.items.length,
            itemListElement: o.items.map((item, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${site.origin}${item.url}`,
                name: item.title
            }))
        }
    };
}

function schemaBreadcrumb(trail, ctx) {
    const site = ctx.site;
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((c, i) => {
            const el = { '@type': 'ListItem', position: i + 1, name: c.name };
            if (c.url) el.item = `${site.origin}${c.url}`;
            return el;
        })
    };
}

/* ============================================================================
   ٩. جسور التحويل — لا رابط منشور ينكسر
   ============================================================================ */

/**
 * جسر ساكن: canonical + meta refresh. هذا أقصى ما تسمح به GitHub Pages —
 * لا إعادة توجيه من جهة الخادم إطلاقاً.
 */
function redirectStub(o) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${S.escapeHtml(o.title)}</title>
    <link rel="canonical" href="${S.escapeAttr(o.canonical)}">
    <meta http-equiv="refresh" content="0; url=${S.escapeAttr(o.target)}">
    <meta name="robots" content="${o.robots || 'noindex, follow'}">
${o.og ? `    <meta property="og:type" content="article">
    <meta property="og:locale" content="ar_SA">
    <meta property="og:site_name" content="محمد الزبيدي">
    <meta property="og:url" content="${S.escapeAttr(o.canonical)}">
    <meta property="og:title" content="${S.escapeAttr(o.og.title)}">
    <meta property="og:description" content="${S.escapeAttr(o.og.description)}">
    <meta property="og:image" content="${S.escapeAttr(o.og.image)}">
    <meta property="og:image:width" content="${o.og.width}">
    <meta property="og:image:height" content="${o.og.height}">
    <meta name="twitter:card" content="summary_large_image">
` : ''}    <script>location.replace(${JSON.stringify(o.target)});</script>
</head>
<body>
    <p>انتقل هذا المحتوى إلى <a href="${S.escapeAttr(o.target)}">${S.escapeHtml(o.targetLabel || o.target)}</a>.</p>
</body>
</html>
`;
}

/**
 * ‏article.html?id=… و project-details.html?id=… ملفّ واحد لمئة معرّف، فلا
 * يمكن أن يحمل meta refresh لكلٍّ منها. الخريطة تُحقن في الترميز فيتحوّل
 * الرابط القديم بلا طلب شبكة، والقائمة تحت <noscript> ممرّ زحف حقيقي لا
 * طريق مسدود.
 */
function idRedirectStub(items, o) {
    const map = {};
    for (const item of items) map[item.id] = item.url;

    const links = items.map((i) =>
        `        <li><a href="${S.escapeAttr(i.url)}">${S.escapeHtml(i.title)}</a></li>`).join('\n');

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${S.escapeHtml(o.title)}</title>
    <link rel="canonical" href="${S.escapeAttr(o.indexUrl)}">
    <meta name="robots" content="noindex, follow">
    <script>
    /* الروابط المنشورة قبل الانتقال إلى المسارات النظيفة تصل هنا. الخريطة
       مولَّدة في البناء، فلا طلب شبكة ولا انتظار. */
    (function () {
        var MAP = ${JSON.stringify(map)};
        var id = new URLSearchParams(location.search).get('id');
        var to = (id && MAP[id]) || ${JSON.stringify(o.indexPath)};
        location.replace(to + location.hash);
    })();
    </script>
    <meta http-equiv="refresh" content="1; url=${S.escapeAttr(o.indexPath)}">
</head>
<body>
    <h1>${S.escapeHtml(o.heading)}</h1>
    <p>انتقل هذا القسم إلى مسارات جديدة. اختر من القائمة:</p>
    <ul>
${links}
    </ul>
    <p><a href="${S.escapeAttr(o.indexPath)}">${S.escapeHtml(o.indexLabel)}</a></p>
</body>
</html>
`;
}

/* ============================================================================
   ١٠. خريطة الموقع، التغذية، robots
   ============================================================================ */

/* حدّ البروتوكول ٥٠ ألف رابط لكل ملف؛ والخمسة آلاف حدٌّ معقول يُبقي الملف
   خفيفاً ويُسهّل على المفهرس التقاط ما تغيّر. يُتجاوَز في الاختبار عبر
   SITEMAP_MAX كي لا يبقى فرعُ الانقسام شفرةً لم تُشغَّل قطّ. */
const SITEMAP_MAX = Number(process.env.SITEMAP_MAX) || 5000;

const sitemapDoc = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<!-- مولَّدة في كل بناء بـ .github/scripts/build-site.js — لا تُحرَّر يدوياً -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

/**
 * يعيد ملفاً واحداً، أو — إن تجاوز العدد الحدّ — عدّة ملفات وفهرساً يجمعها.
 * ‏robots.txt يشير إلى /sitemap.xml في الحالتين، فهو الملف أو الفهرس.
 */
function buildSitemapFiles(ctx) {
    const urls = collectUrls(ctx);
    report.counts.sitemapUrls = urls.length;

    const entry = (u) => `  <url>
    <loc>${S.escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;

    if (urls.length <= SITEMAP_MAX) {
        return [{ rel: 'sitemap.xml', content: sitemapDoc(urls.map(entry).join('\n')) }];
    }

    const files = [];
    const chunks = [];
    for (let i = 0; i < urls.length; i += SITEMAP_MAX) chunks.push(urls.slice(i, i + SITEMAP_MAX));

    chunks.forEach((chunk, i) => {
        files.push({ rel: `sitemap-${i + 1}.xml`, content: sitemapDoc(chunk.map(entry).join('\n')) });
    });

    const newestOf = (chunk) => chunk.map((u) => u.lastmod).sort().pop();
    files.push({
        rel: 'sitemap.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<!-- فهرس خرائط — مولَّد في كل بناء. لا تُحرَّر يدوياً -->
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunks.map((chunk, i) => `  <sitemap>
    <loc>${ctx.site.origin}/sitemap-${i + 1}.xml</loc>
    <lastmod>${newestOf(chunk)}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>
`
    });

    note(`خريطة الموقع انقسمت إلى ${chunks.length} ملفاً وفهرسٍ يجمعها (${urls.length} رابطاً > ${SITEMAP_MAX}).`);
    return files;
}

function collectUrls(ctx) {
    const site = ctx.site;
    const today = (ctx.lastUpdated || new Date().toISOString()).slice(0, 10);
    const lastmodOf = (item) => (S.isoDate(item.lastEdited || item.date) || '').slice(0, 10) || today;

    const urls = [
        { loc: `${site.origin}/`, lastmod: today, changefreq: 'weekly', priority: '1.0' },
        ...(ctx.servicesPage
            ? [{ loc: ctx.servicesPage.canonical, lastmod: today, changefreq: 'monthly', priority: '0.9' }]
            : []),
        { loc: `${site.origin}/projects/`, lastmod: newest(ctx.projects, today), changefreq: 'weekly', priority: '0.9' },
        { loc: `${site.origin}/articles/`, lastmod: newest(ctx.articles, today), changefreq: 'weekly', priority: '0.9' },
        { loc: `${site.origin}/topics/`, lastmod: today, changefreq: 'weekly', priority: '0.6' }
    ];

    for (const item of [...ctx.articles, ...ctx.projects]) {
        urls.push({
            loc: `${site.origin}${item.url}`,
            lastmod: lastmodOf(item),
            changefreq: 'monthly',
            priority: '0.8'
        });
    }
    for (const topic of [...ctx.pillars.filter((pl) => pl.items.length), ...ctx.topics]) {
        urls.push({
            loc: `${site.origin}${topic.url}`,
            lastmod: newest(topic.items, today),
            changefreq: 'monthly',
            priority: topic.isPillar ? '0.7' : '0.6'
        });
    }

    return urls;
}

const newest = (items, fallback) => {
    const dates = items.map((i) => S.isoDate(i.lastEdited || i.date)).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1].slice(0, 10) : fallback;
};

function buildFeed(ctx) {
    const site = ctx.site;
    const s = site.sections.articles;
    const updated = ctx.articles.length
        ? (S.isoDate(ctx.articles[0].lastEdited || ctx.articles[0].date) || new Date(0).toISOString())
        : new Date(0).toISOString();

    const entries = ctx.articles.map((a) => `  <entry>
    <title type="text">${S.escapeXml(a.title)}</title>
    <link rel="alternate" type="text/html" href="${S.escapeXml(site.origin + a.url)}"/>
    <id>${S.escapeXml(`${site.origin}/articles/${a.id}`)}</id>
    <published>${S.isoDate(a.date) || updated}</published>
    <updated>${S.isoDate(a.lastEdited || a.date) || updated}</updated>
    <author><name>${S.escapeXml(site.name_ar)}</name></author>
${a.topics.map((t) => `    <category term="${S.escapeXml(t)}"/>`).join('\n')}
    <summary type="text">${S.escapeXml(a.description)}</summary>
    <content type="html">${S.escapeXml(a.contentHtml)}</content>
  </entry>`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- مولَّدة في كل بناء — لا تُحرَّر يدوياً -->
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ar">
  <title type="text">${S.escapeXml(`${s.brand_ar} — مقالات ${site.name_ar}`)}</title>
  <subtitle type="text">${S.escapeXml(s.og_description_ar)}</subtitle>
  <link rel="alternate" type="text/html" href="${site.origin}/articles/"/>
  <link rel="self" type="application/atom+xml" href="${site.origin}/feed.xml"/>
  <id>${site.origin}/</id>
  <updated>${updated}</updated>
  <author><name>${S.escapeXml(site.name_ar)}</name><uri>${site.origin}/</uri></author>
  <rights>© ${new Date(updated).getUTCFullYear()} ${S.escapeXml(site.name_ar)}</rights>
${entries}
</feed>
`;
}

function buildRobots(ctx) {
    return `# alzobaidi.me — الزحف مفتوح.
# صاحب هذا الموقع يستفيد من أن يُقتبس، لا من أن يُحجب: زواحف نماذج اللغة
# مسموح لها صراحةً كما يُسمح لزواحف البحث.

User-agent: *
Allow: /

# ── زواحف البحث ─────────────────────────────────────────────────────────
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Applebot
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: YandexBot
Allow: /

# ── زواحف نماذج اللغة والإجابات ─────────────────────────────────────────
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: meta-externalagent
Allow: /

# ── عارضات المعاينة (بطاقات المشاركة) ───────────────────────────────────
User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: WhatsApp
Allow: /

User-agent: TelegramBot
Allow: /

Sitemap: ${ctx.site.origin}/sitemap.xml
`;
}

/* ============================================================================
   ١١. المناطق المُدارة في الصفحات المكتوبة يدوياً
   ============================================================================ */

/**
 * الصفحة الرئيسية و404 مكتوبتان بيد صاحبهما ويجب أن تبقيا كذلك. البناء لا
 * يعيد كتابتهما — يستبدل ما بين علامتين فقط، فيبقى كل ما عداهما بيده وحده.
 *
 * علامة مفقودة توقف البناء برسالة صريحة: الكتابة في موضع مُخمَّن أسوأ من
 * التوقّف. وكذلك علامة مكرّرة أو معكوسة الترتيب — كلاهما منطقة تالفة.
 */
function patchRegions(rel, regions) {
    const abs = path.join(ROOT, rel);
    let html = fs.readFileSync(abs, 'utf8');

    for (const [name, content] of Object.entries(regions)) {
        const begin = `<!-- seo:${name}:begin -->`;
        const end = `<!-- seo:${name}:end -->`;
        const i = html.indexOf(begin);
        const j = html.indexOf(end);
        if (i === -1 || j === -1) {
            throw new Error(`علامة المنطقة المُدارة «${name}» مفقودة في ${rel}. `
                + `أضف ${begin} … ${end} أو أعد الملف من git.`);
        }
        if (j < i) {
            throw new Error(`علامتا المنطقة «${name}» معكوستان في ${rel}: end قبل begin.`);
        }
        if (html.indexOf(begin, i + 1) !== -1 || html.indexOf(end, j + 1) !== -1) {
            throw new Error(`المنطقة المُدارة «${name}» مكرّرة في ${rel} — لا يُعرف أيّها يُكتب.`);
        }

        // إزاحة علامة الإغلاق تتبع إزاحة علامة الفتح، فيبقى الترميز مرتّباً
        const indent = html.slice(html.lastIndexOf('\n', i) + 1, i);
        html = html.slice(0, i + begin.length) + '\n' + content + '\n' + indent + html.slice(j);
    }

    write(rel, html);
}

/* ── الأصول المُدارة ──────────────────────────────────────────────────────
   باعث التحديث كان يُرفع بيد صاحب الموقع في ثلاثة مواضع: data/site.json ثم
   index.html ثم 404.html. ونسيان واحدٍ منها كان يُفشل البناء — وهو سلوك
   صحيح، لكن الخطوة اليدوية نفسها هي العلّة. القوائم هنا، والباعث من
   site.json، فيُرفع في مكان واحد. */
const PRELOAD_FONTS = [
    'thmanyahserifdisplay-Bold.woff2',
    'thmanyahseriftext-Regular.woff2',
    'thmanyahsans-Regular.woff2'
];

const MANAGED_ASSETS = {
    'index.html': {
        css: [
            { file: 'style.css' },
            { file: 'animations.css' },
            { file: 'project.css', note: 'بطاقات المختارات: المشروع في project.css والمقال في article.css' },
            { file: 'article.css' },
            { file: 'responsive.css' }
        ],
        js: ['js/i18n.js', 'js/covers.js', 'main.js', 'animations.js', 'projects.js', 'js/articles-list.js']
    },
    '404.html': {
        css: [
            { file: 'style.css' },
            { file: 'animations.css' },
            { file: 'article.css' },
            { file: 'responsive.css' }
        ],
        js: ['js/i18n.js', 'main.js', 'animations.js']
    }
};

function assetsRegion(cfg, v) {
    const L = [];
    L.push('    <!-- مورف الصورة بين القائمة والتفاصيل — يُسجَّل مبكّراً كي يُلتقط pagereveal -->');
    L.push(`    <script src="${C.asset('js/view-transitions.js', v)}"></script>`);
    L.push('');
    L.push('    <!-- تحميل مسبق لما يظهر فوق حدّ الشاشة فقط -->');
    PRELOAD_FONTS.forEach((f) =>
        L.push(`    <link rel="preload" href="/assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`));
    L.push('');
    L.push('    <!-- Styles -->');
    cfg.css.forEach((entry) => {
        if (entry.note) L.push(`    <!-- ${entry.note} -->`);
        L.push(`    <link rel="stylesheet" href="${C.asset('css/' + entry.file, v)}">`);
    });
    return L.join('\n');
}

/** المناطق المُدارة المشتركة بين الصفحتين اليدويتين */
const assetRegions = (rel, v) => ({
    assets: assetsRegion(MANAGED_ASSETS[rel], v),
    scripts: C.scripts(MANAGED_ASSETS[rel].js, v)
});

function homeRegions(ctx) {
    const site = ctx.site;
    const p = site.positioning;

    if (p.search_role_ar !== p.hero_role_ar) {
        warn('موضعة الصفحة الرئيسية غير محسومة: العنوان والوصف يقولان '
            + `«${p.search_role_ar}» بينما الهيرو وبطاقة المشاركة يقولان «${p.hero_role_ar}». `
            + 'البناء يُبقي كلاًّ في مكانه كما هو اليوم. لتوحيدهما: وحِّد القيمتين في data/site.json.');
    }

    const canonical = `${site.origin}/`;
    const title = `${site.name_ar} | ${p.search_role_ar}`;
    const titleEn = `${site.name_en} | ${p.search_role_en}`;

    const head = [
        `    <meta name="description" content="${S.escapeAttr(site.home.description_ar)}" data-en-content="${S.escapeAttr(site.home.description_en)}">`,
        `    <title data-en="${S.escapeAttr(titleEn)}">${S.escapeHtml(title)}</title>`,
        `    <link rel="canonical" href="${canonical}">`,
        '    <link rel="alternate" type="application/atom+xml" title="بان — مقالات محمد الزبيدي" href="/feed.xml">',
        '    <meta property="og:type" content="website">',
        '    <meta property="og:locale" content="ar_SA">',
        `    <meta property="og:site_name" content="${S.escapeAttr(site.name_ar)}">`,
        `    <meta property="og:url" content="${canonical}">`,
        `    <meta property="og:title" content="${S.escapeAttr(title)}" data-en-content="${S.escapeAttr(titleEn)}">`,
        `    <meta property="og:description" content="${S.escapeAttr(site.home.og_description_ar)}" data-en-content="${S.escapeAttr(site.home.og_description_en)}">`,
        `    <meta property="og:image" content="${ctx.ogFixed.home.url}">`,
        `    <meta property="og:image:width" content="${ctx.ogFixed.home.width}">`,
        `    <meta property="og:image:height" content="${ctx.ogFixed.home.height}">`,
        `    <meta property="og:image:alt" content="${S.escapeAttr(`${site.name_ar} — ${p.hero_role_ar}`)}">`,
        '    <meta name="twitter:card" content="summary_large_image">',
        `    <meta name="twitter:title" content="${S.escapeAttr(title)}">`,
        `    <meta name="twitter:description" content="${S.escapeAttr(site.home.og_description_ar)}">`,
        `    <meta name="twitter:image" content="${ctx.ogFixed.home.url}">`,
        '    <script type="application/ld+json">',
        S.jsonLd(schemaPerson(ctx)),
        '    </script>',
        '    <script type="application/ld+json">',
        S.jsonLd(schemaWebsite(ctx)),
        '    </script>'
    ].join('\n');

    return Object.assign(assetRegions('index.html', site.cacheBuster), {
        head,
        'featured-projects': ctx.projects.length ? projectCardHtml(ctx.projects[0]) : '',
        'featured-articles': ctx.articles.length ? articleCardHtml(ctx.articles[0]) : ''
    });
}

/* ============================================================================
   ١١·٢. صفحة الخدمات — مهيّأة ومعطَّلة
   ============================================================================ */

/**
 * الصفحة الوحيدة التي تخاطب العميل، وهي محذوفة اليوم بقرار صاحب الموقع.
 * هذا المسار مهيّأ بالكامل ولا يعمل حتى يُرفع enabled — وحين يُرفع يشترط
 * ثلاثة شروط قبل أن يكتب شيئاً، وكلٌّ منها يوقف البناء برسالة تقول ما
 * ينقص بالضبط. لا يُخترع وصف، ولا تُستعاد صفحة، ولا يُفهرَس شيء ضمناً.
 *
 * @returns {object|null} وصف الصفحة إن كانت مفعّلة وصالحة، وإلا null
 */
function servicesPage(ctx) {
    const cfg = ctx.site.services;
    if (!cfg || !cfg.enabled) return null;

    const abs = path.join(ROOT, cfg.path);
    if (!fs.existsSync(abs)) {
        throw new Error(
            `services.enabled = true لكن الصفحة غير موجودة: ${cfg.path}\n`
            + '   استعدها أولاً:  git checkout 4d514fc^ -- work-with-me/\n'
            + '   ثم أضف علامتَي seo:head فيها. راجع data/site.json ← services._how_to_enable'
        );
    }
    if (!cfg.description_ar || !cfg.title_ar) {
        throw new Error(
            'services.enabled = true لكن title_ar أو description_ar فارغ في data/site.json.\n'
            + '   البناء لا يكتب وصفاً نيابةً عن صاحب الموقع — اكتبه بنفسك (١٥٠–١٦٠ محرفاً).'
        );
    }

    const canonical = `${ctx.site.origin}${cfg.url}`;
    const og = ctx.ogFixed.services || ctx.ogFixed.home;

    const trail = [
        { name: 'الرئيسية', en: 'Home', url: '/' },
        { name: cfg.title_ar, url: null }
    ];

    const head = [
        `    <meta name="description" content="${S.escapeAttr(cfg.description_ar)}">`,
        `    <title>${S.escapeHtml(S.buildTitle(cfg.title_ar, ctx.site.name_ar))}</title>`,
        `    <link rel="canonical" href="${canonical}">`,
        '    <link rel="alternate" type="application/atom+xml" title="بان — مقالات محمد الزبيدي" href="/feed.xml">',
        '    <meta property="og:type" content="website">',
        '    <meta property="og:locale" content="ar_SA">',
        `    <meta property="og:site_name" content="${S.escapeAttr(ctx.site.name_ar)}">`,
        `    <meta property="og:url" content="${canonical}">`,
        `    <meta property="og:title" content="${S.escapeAttr(cfg.title_ar)}">`,
        `    <meta property="og:description" content="${S.escapeAttr(cfg.description_ar)}">`,
        `    <meta property="og:image" content="${og.url}">`,
        `    <meta property="og:image:width" content="${og.width}">`,
        `    <meta property="og:image:height" content="${og.height}">`,
        '    <meta name="twitter:card" content="summary_large_image">',
        `    <meta name="twitter:title" content="${S.escapeAttr(cfg.title_ar)}">`,
        `    <meta name="twitter:description" content="${S.escapeAttr(cfg.description_ar)}">`,
        `    <meta name="twitter:image" content="${og.url}">`,
        '    <script type="application/ld+json">',
        S.jsonLd(schemaService(cfg, ctx)),
        '    </script>',
        '    <script type="application/ld+json">',
        S.jsonLd(schemaBreadcrumb(trail, ctx)),
        '    </script>'
    ].join('\n');

    patchRegions(cfg.path, { head });
    note(`صفحة الخدمات مفعّلة ومفهرَسة: ${cfg.url}`);
    return { url: cfg.url, canonical };
}

/** ProfessionalService — يُصدَر فقط مع صفحة خدمات مفهرَسة تسنده */
function schemaService(cfg, ctx) {
    const site = ctx.site;
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        '@id': `${site.origin}${cfg.url}#service`,
        name: cfg.title_ar,
        description: cfg.description_ar,
        url: `${site.origin}${cfg.url}`,
        inLanguage: 'ar',
        provider: { '@id': `${site.origin}/#person` },
        areaServed: (site.person.areaServed || []).map((c) => ({
            '@type': 'Country', name: c.name_ar, alternateName: c.name_en
        })),
        ...(cfg.serviceTypes_ar && cfg.serviceTypes_ar.length
            ? { serviceType: cfg.serviceTypes_ar } : {})
    };
}

/* ============================================================================
   ١١·٥. سجلّ المعرّفات — يُدمَج ولا يُستبدَل
   ============================================================================ */

/**
 * مساران في GitHub Actions يكتبان هذا الملف نفسه. الفارق الزمني بينهما
 * (‏٠٣:٠٠ و٠٣:٣٠) هو خطّ الدفاع الأول، و`git pull --rebase` الثاني — لكن
 * أياً منهما لا يحمي من كتابةٍ فوق كتابة داخل العملية نفسها: لو بدأ هذا
 * البناء قبل أن يُودِع الآخر مقالاً جديداً، لكان `ctx.ledger` جاهلاً به
 * ولمحاه الاستبدال.
 *
 * لذلك يُعاد قراءة الملف لحظة الكتابة لا لحظة البدء، ويُدمَج:
 *   · مدخل موجود على القرص وغائب هنا ⇒ **يبقى**. لا يُحذف مدخل أبداً كأثر
 *     جانبي — حذفه يكسر رابطاً منشوراً.
 *   · مدخل في الجهتين ⇒ معرّف هذه التشغيلة يفوز، والأسماء المهجورة
 *     تُجمع من الجهتين فلا يسقط جسر تحويل كتبه الآخر.
 *
 * والترتيب بالمفتاح لا بترتيب العرض: ترتيب العرض يتبدّل مع كل تغيير تاريخ،
 * فيُنتج فرقاً وهمياً في git ويضاعف احتمال التعارض بين المسارين.
 */
function writeLedger(ledger) {
    const rel = 'data/slugs.json';
    const abs = path.join(ROOT, rel);

    let onDisk = {};
    if (fs.existsSync(abs)) {
        try {
            onDisk = JSON.parse(fs.readFileSync(abs, 'utf8'));
        } catch (err) {
            warn(`data/slugs.json تالف (${err.message}) — يُعاد بناؤه من هذه التشغيلة وحدها.`);
        }
    }

    const merged = {};
    const ids = [...new Set([...Object.keys(onDisk), ...Object.keys(ledger)])].sort();
    let carried = 0;

    for (const id of ids) {
        const a = onDisk[id];
        const b = ledger[id];

        if (!b) { merged[id] = a; carried++; continue; }
        if (!a) { merged[id] = b; continue; }

        const aliases = new Set([...(a.aliases || []), ...(b.aliases || [])]);
        if (a.slug && a.slug !== b.slug) aliases.add(a.slug);
        aliases.delete(b.slug);

        merged[id] = { slug: b.slug, aliases: [...aliases].sort(), title: b.title, kind: b.kind };
    }

    if (carried) {
        note(`سجلّ المعرّفات: ${carried} مدخلاً محفوظاً من القرص لا مصدر له في هذه التشغيلة `
            + '(محتوى غير منشور، أو تشغيلة أخرى كتبت قبل هذه) — أُبقيت كما هي.');
    }

    // تصادم بين معرّف محمول ومعرّف من هذه التشغيلة: لا يكسر مساراً مقدَّماً
    // (الصفحات تُولَّد لعناصر هذه التشغيلة وحدها، وassignSlug يفضّ التصادم
    // بلاحقة) لكنه يستحقّ أن يُقال بدل أن يُكتشَف لاحقاً.
    const bySlug = new Map();
    for (const [id, rec] of Object.entries(merged)) {
        const key = `${rec.kind}:${rec.slug}`;
        if (bySlug.has(key)) {
            warn(`معرّفان متطابقان في السجلّ: «${rec.slug}» لـ ${bySlug.get(key)} و ${id}.`);
        } else bySlug.set(key, id);
    }

    write(rel, JSON.stringify(merged, null, 2) + '\n');
}

/* ============================================================================
   ١٢. الكنس — ما لم يعد له مصدر لا يبقى منشوراً
   ============================================================================ */

/**
 * إلغاء نشر مقال في Notion كان يترك صفحته على القرص إلى الأبد: تختفي من
 * خريطة الموقع ومن كل رابط، وتبقى مقدَّمةً لمن يملك رابطها ولمن يجدها في
 * فهرس محرّك البحث. البناء يمسح ما لم يكتبه في هذه الجولة، ضمن الأدلّة
 * المولَّدة وحدها — لا يمسّ شيئاً كتبه صاحب الموقع بيده.
 */
function sweep(writtenPaths) {
    const GENERATED_ROOTS = ['articles', 'projects', 'topics', 'a', 'p'];
    const kept = new Set(writtenPaths);
    const removed = [];

    for (const root of GENERATED_ROOTS) {
        const absRoot = path.join(ROOT, root);
        if (!fs.existsSync(absRoot)) continue;

        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs = path.join(dir, entry.name);
                if (entry.isDirectory()) { walk(abs); continue; }
                const rel = path.relative(ROOT, abs);
                if (entry.name === 'index.html' && !kept.has(rel)) {
                    fs.unlinkSync(abs);
                    removed.push(rel);
                }
            }
            // الدليل الفارغ بعد الحذف لا يُترك هيكلاً بلا محتوى
            if (dir !== absRoot && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
        };
        walk(absRoot);
        if (fs.readdirSync(absRoot).length === 0) fs.rmdirSync(absRoot);
    }

    // بطاقات مشاركة لمحتوى لم يعد موجوداً
    const ogDir = path.join(ROOT, 'assets', 'og');
    if (fs.existsSync(ogDir)) {
        for (const name of fs.readdirSync(ogDir)) {
            const rel = path.join('assets', 'og', name);
            if (!kept.has(rel)) { fs.unlinkSync(path.join(ROOT, rel)); removed.push(rel); }
        }
    }

    if (removed.length) {
        console.log(`   🧹 كُنس ${removed.length} ملفاً لم يعد له مصدر في data/:`);
        removed.forEach((r) => console.log('      − ' + r));
    }
    report.counts.swept = removed.length;
}

/* ============================================================================
   ١٣. التشغيل
   ============================================================================ */

async function main() {
    console.log('\n🏗️  بناء الصفحات الساكنة\n');

    const site = S.readJson('data/site.json');
    const ctx = normalise(site);
    ctx.decorativeImages = [];

    deriveMeta(ctx);
    buildTopics(ctx);
    await preloadImageSizes(ctx);

    for (const item of [...ctx.articles, ...ctx.projects]) {
        item.coverSize = item.cover ? ctx.imageSizes.get(item.cover) || null : null;
    }

    await buildOgImages(ctx);

    // ── صفحات التفاصيل ───────────────────────────────────────────────────
    ctx.articles.forEach((item, i) =>
        write(`articles/${item.slug}/index.html`, detailPage(item, ctx.articles, i, ctx)));
    ctx.projects.forEach((item, i) =>
        write(`projects/${item.slug}/index.html`, detailPage(item, ctx.projects, i, ctx)));

    // ── الفهارس ──────────────────────────────────────────────────────────
    write('articles/index.html', articlesIndexPage(ctx));
    write('projects/index.html', projectsIndexPage(ctx));

    // ── الموضوعات ────────────────────────────────────────────────────────
    write('topics/index.html', topicsHubPage(ctx));
    ctx.topics.forEach((topic) => write(`topics/${topic.slug}/index.html`, topicPage(topic, ctx)));
    ctx.pillars.filter((pl) => pl.items.length)
        .forEach((pl) => write(`topics/${pl.slug}/index.html`, topicPage(pl, ctx)));

    // ── جسور: المسارات القديمة والأسماء المهجورة والروابط القصيرة ────────
    write('articles.html', redirectStub({
        title: 'بان — المقالات | محمد الزبيدي',
        canonical: `${site.origin}/articles/`, target: '/articles/', targetLabel: 'مدوّنة بان'
    }));
    write('projects.html', redirectStub({
        title: 'ذُرى — المشاريع | محمد الزبيدي',
        canonical: `${site.origin}/projects/`, target: '/projects/', targetLabel: 'مشاريع ذُرى'
    }));
    write('article.html', idRedirectStub(ctx.articles, {
        title: 'المقال | محمد الزبيدي', heading: 'مدوّنة بان',
        indexUrl: `${site.origin}/articles/`, indexPath: '/articles/', indexLabel: 'كل المقالات'
    }));
    write('project-details.html', idRedirectStub(ctx.projects, {
        title: 'المشروع | محمد الزبيدي', heading: 'مشاريع ذُرى',
        indexUrl: `${site.origin}/projects/`, indexPath: '/projects/', indexLabel: 'كل المشاريع'
    }));

    let bridges = 4;
    const shortIds = new Set();
    for (const item of [...ctx.articles, ...ctx.projects]) {
        const dir = item.kind === 'article' ? 'articles' : 'projects';

        // أسماء مهجورة بعد تغيير عنوان في Notion
        for (const alias of item.aliases) {
            write(`${dir}/${alias}/index.html`, redirectStub({
                title: item.pageTitle,
                canonical: `${site.origin}${item.url}`,
                target: item.url, targetLabel: item.title
            }));
            bridges++;
        }

        /* رابط قصير لاتيني: مخرج مضمون لأي سطح لا يحتمل مساراً عربياً
           مرمَّزاً. الطول يمتدّ حتى يتفرّد — معرّفا مشروعَي Notion يشتركان
           في أوّل ثمانية محارف، فالقطع الثابت كان يكتب أحدهما فوق الآخر. */
        let stem = item.id.slice(0, 8);
        for (let n = 10; shortIds.has(stem) && n <= item.id.length; n += 2) stem = item.id.slice(0, n);
        shortIds.add(stem);
        const short = `${item.kind === 'article' ? 'a' : 'p'}/${stem}`;
        item.shortUrl = `/${short}/`;
        write(`${short}/index.html`, redirectStub({
            title: item.pageTitle,
            canonical: `${site.origin}${item.url}`,
            target: item.url, targetLabel: item.title,
            og: {
                title: item.title, description: item.description,
                image: item.og.url, width: item.og.width, height: item.og.height
            }
        }));
        bridges++;
    }
    for (const topic of ctx.topics) {
        for (const alias of topic.aliases || []) {
            write(`topics/${alias}/index.html`, redirectStub({
                title: S.buildTitle(topic.name, site.name_ar),
                canonical: `${site.origin}${topic.url}`,
                target: topic.url, targetLabel: topic.name
            }));
            bridges++;
        }
    }
    report.counts.bridges = bridges;

    // ── الصفحات اليدوية: المناطق المُدارة وحدها ──────────────────────────
    patchRegions('index.html', homeRegions(ctx));
    patchRegions('404.html', assetRegions('404.html', site.cacheBuster));
    ctx.servicesPage = servicesPage(ctx);

    // ── بنية الزحف ───────────────────────────────────────────────────────
    const sitemaps = buildSitemapFiles(ctx);
    sitemaps.forEach((f) => write(f.rel, f.content));
    // ملفات انقسام سابقة لم تعد لازمة (تقلّص المحتوى أو عاد إلى ملف واحد)
    const keep = new Set(sitemaps.map((f) => f.rel));
    for (const name of fs.readdirSync(ROOT)) {
        if (/^sitemap-\d+\.xml$/.test(name) && !keep.has(name)) {
            fs.unlinkSync(path.join(ROOT, name));
            console.log('   🧹 ' + name);
        }
    }
    write('feed.xml', buildFeed(ctx));
    write('robots.txt', buildRobots(ctx));
    write('.nojekyll', '');

    // ── الكنس ────────────────────────────────────────────────────────────
    sweep(report.written);

    // ── السجلّ ───────────────────────────────────────────────────────────
    writeLedger(ctx.ledger);

    // ── الخلاصة ──────────────────────────────────────────────────────────
    report.counts.articles = ctx.articles.length;
    report.counts.projects = ctx.projects.length;
    report.counts.topics = ctx.topics.length;

    if (ctx.decorativeImages.length) {
        const n = ctx.decorativeImages.reduce((a, d) => a + d.images.length, 0);
        warn(`${n} صورة في المتن بلا نصّ بديل حقيقي (اسم ملف أو «image») — `
            + 'أُعلنت زخرفية alt="" لأن اسم ملف يُنطَق حرفاً حرفاً أسوأ من الصمت. '
            + 'أضف تعليقاً في Notion تحت كل صورة ليصير نصّاً بديلاً.');
    }

    console.log('\n📄 صفحات:',
        `${ctx.articles.length} مقال · ${ctx.projects.length} مشروع · `
        + `${ctx.topics.length} موضوع · ${bridges} جسر تحويل`);
    console.log('🗺️  خريطة الموقع:', report.counts.sitemapUrls, 'رابطاً');
    console.log(report.warnings.length
        ? `\n⚠️  ${report.warnings.length} تنبيهاً — راجعها أعلاه.`
        : '\n✅ بلا تنبيهات.');

    fs.writeFileSync(path.join(ROOT, '.cache', 'build-report.json'),
        JSON.stringify(report, null, 2), 'utf8');
}

/* يُصدَّر للاختبار: writeLedger هو الموضع الوحيد الذي يتنافس عليه المساران،
   ودمجه يستحقّ فحصاً مباشراً لا استنتاجاً. */
module.exports = { writeLedger };

if (require.main === module) {
    main().catch((err) => {
        console.error('\n❌ فشل البناء:', err.message);
        console.error(err.stack);
        process.exit(1);
    });
}

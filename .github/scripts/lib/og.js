/**
 * og.js — بطاقة المشاركة لكل صفحة.
 *
 * قاعدتان:
 *   ١. إن كان للمحتوى غلافٌ حقيقي فهو البطاقة — يُقصّ إلى 1200×630 ويُحفظ
 *      JPEG. (المصدر WebP، وعارضات المعاينة في واتساب ولينكدإن لا تُعوَّل
 *      على دعمها له، فالتحويل شرط لا تحسين.)
 *   ٢. وإلا تُرسَم بطاقة من العنوان نفسه بخطّ الموقع ورموزه — ولا تقع
 *      الصورة الشخصية بطاقةً لمقال أبداً.
 *
 * الرسم يمرّ بـ resvg (تشكيل عربي حقيقي عبر rustybuzz)، وخطوط الموقع woff2
 * تُفكّ إلى TTF في ذاكرة مؤقّتة لأن محرّك الخطوط لا يقرأ woff2.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./seo');

const W = 1200;
const H = 630;

/* رموز الموقع كما هي في css/style.css — لا لون خارج هذه القائمة */
const PAPER = '#F9F8F6';   // --n-1
const INK = '#16181C';     // --n-12
const MUTED = '#5B6169';   // --n-11
const ACCENT = '#2A4A9B';  // --a-9

const FONT_CACHE = path.join(ROOT, '.cache', 'og-fonts');

let deps = null;
function load() {
    if (deps) return deps;
    try {
        deps = {
            sharp: require('sharp'),
            Resvg: require('@resvg/resvg-js').Resvg,
            wawoff: require('wawoff2')
        };
    } catch (err) {
        deps = { error: err.message };
    }
    return deps;
}

const available = () => !load().error;
const missingReason = () => load().error;

/** woff2 → TTF مرّة واحدة لكل بناء، في ذاكرة مؤقّتة خارج المستودع */
async function ensureFonts() {
    const { wawoff } = load();
    fs.mkdirSync(FONT_CACHE, { recursive: true });

    const wanted = [
        'thmanyahserifdisplay-Bold',
        'thmanyahsans-Medium',
        'thmanyahsans-Regular'
    ];

    const out = [];
    for (const name of wanted) {
        const ttf = path.join(FONT_CACHE, `${name}.ttf`);
        if (!fs.existsSync(ttf)) {
            const woff2 = path.join(ROOT, 'assets', 'fonts', `${name}.woff2`);
            const buf = Buffer.from(await wawoff.decompress(fs.readFileSync(woff2)));
            fs.writeFileSync(ttf, buf);
        }
        out.push(ttf);
    }
    return out;
}

const escapeXml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** عرض سطر بالخطّ الحقيقي — لا تقدير: resvg يشكّل النصّ ثم يقيس صندوقه */
function measure(text, size, family, weight, fontFiles) {
    const { Resvg } = load();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="400">`
        + `<text x="20" y="200" font-family="${family}" font-weight="${weight}" `
        + `font-size="${size}" direction="rtl">${escapeXml(text)}</text></svg>`;
    const box = new Resvg(svg, {
        font: { fontFiles, loadSystemFonts: false, defaultFontFamily: family }
    }).innerBBox();
    return box ? box.width : 0;
}

/** لفّ جشع بقياس حقيقي، ثم تصغير الحجم حتى يدخل في عدد السطور المسموح */
function layoutTitle(title, fontFiles, { maxWidth, maxLines = 3, sizes = [68, 60, 54, 48, 42] }) {
    const words = String(title).split(/\s+/).filter(Boolean);

    for (const size of sizes) {
        const lines = [];
        let line = '';
        let fits = true;

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (measure(candidate, size, 'Thmanyah Display', 700, fontFiles) <= maxWidth) {
                line = candidate;
                continue;
            }
            if (!line) { fits = false; break; }        // كلمة واحدة أعرض من السطر
            lines.push(line);
            line = word;
        }
        if (line) lines.push(line);

        if (fits && lines.length <= maxLines) return { size, lines };
    }

    // آخر مخرج: أصغر حجم، وتُقطع الزيادة بدل أن تفيض خارج البطاقة
    const size = sizes[sizes.length - 1];
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (measure(candidate, size, 'Thmanyah Display', 700, fontFiles) <= maxWidth) line = candidate;
        else { if (line) lines.push(line); line = word; }
        if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines) lines[maxLines - 1] += '…';
    return { size, lines };
}

/** شعار القسم كـ data URI — المصدر webp ومحرّك SVG لا يُعوَّل على قراءته */
async function emblemDataUri(relPath, height) {
    const { sharp } = load();
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return null;
    const buf = await sharp(abs).resize({ height, withoutEnlargement: false }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    return { uri: `data:image/png;base64,${buf.toString('base64')}`, w: meta.width, h: meta.height };
}

/**
 * بطاقة مرسومة من العنوان.
 * @param {{title:string, kicker:string, emblem:string|null, outAbs:string}} o
 */
async function renderTitleCard(o) {
    const { Resvg, sharp } = load();
    const fontFiles = await ensureFonts();

    const marginX = 90;
    const maxWidth = W - marginX * 2;
    const { size, lines } = layoutTitle(o.title, fontFiles, { maxWidth });

    const lineHeight = Math.round(size * 1.34);
    const blockHeight = lines.length * lineHeight;
    // الكتلة موسّطة رأسياً في المساحة بين الكيكر والتذييل
    const top = Math.round((H - blockHeight) / 2) + Math.round(size * 0.72);

    const emblem = o.emblem ? await emblemDataUri(o.emblem, 96) : null;

    const titleLines = lines.map((line, i) => (
        `  <text x="${W - marginX}" y="${top + i * lineHeight}" text-anchor="end" `
        + `font-family="Thmanyah Display" font-weight="700" font-size="${size}" `
        + `fill="${INK}" direction="rtl">${escapeXml(line)}</text>`
    )).join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${ACCENT}"/>
${emblem ? `  <image x="${marginX}" y="76" width="${emblem.w}" height="${emblem.h}" href="${emblem.uri}"/>` : ''}
  <text x="${W - marginX}" y="128" text-anchor="end" font-family="Thmanyah Sans" font-weight="500"
        font-size="30" fill="${MUTED}" direction="rtl">${escapeXml(o.kicker)}</text>
${titleLines}
${o.title.trim() === 'محمد الزبيدي' ? '' : `  <text x="${W - marginX}" y="${H - 64}" text-anchor="end" font-family="Thmanyah Sans" font-weight="500"
        font-size="27" fill="${MUTED}" direction="rtl">محمد الزبيدي</text>`}
  <text x="${marginX}" y="${H - 64}" text-anchor="start" font-family="Thmanyah Sans" font-weight="400"
        font-size="26" fill="${MUTED}" direction="ltr">alzobaidi.me</text>
</svg>`;

    const png = new Resvg(svg, {
        font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Thmanyah Display' },
        fitTo: { mode: 'width', value: W }
    }).render().asPng();

    fs.mkdirSync(path.dirname(o.outAbs), { recursive: true });
    await sharp(png).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toFile(o.outAbs);
    return { width: W, height: H };
}

/** بطاقة من غلاف حقيقي — قصّ إلى المقاس الاجتماعي وتحويل إلى JPEG */
async function renderCoverCard(coverRel, outAbs) {
    const { sharp } = load();
    const abs = path.join(ROOT, coverRel);
    if (!fs.existsSync(abs)) return null;
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    await sharp(abs)
        .resize(W, H, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 86 })
        .toFile(outAbs);
    return { width: W, height: H };
}

module.exports = { available, missingReason, renderTitleCard, renderCoverCard, W, H };

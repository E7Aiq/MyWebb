/**
 * seo.js — الأدوات المشتركة لطبقة البناء الساكن.
 *
 * قاعدة هذا الملف: لا يخترع نصّاً أبداً. كل عنوان ووصف ونصّ بديل يُشتقّ من
 * محتوى حقيقي في data/ — وإن لم يوجد المصدر، تُعاد قيمة فارغة ويُبلّغ عنها
 * في تقرير البناء بدل ملء الفراغ بكلام مصنوع.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// ── ملفات ────────────────────────────────────────────────────────────────
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

function writeFileIfChanged(rel, content) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const existing = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (existing === content) return false;
    fs.writeFileSync(abs, content, 'utf8');
    return true;
}

// ── هروب ─────────────────────────────────────────────────────────────────
const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escapeXml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** JSON-LD يُحقن داخل <script>: التسلسل الوحيد الخطر هو </script> و <!-- */
const jsonLd = (obj) => JSON.stringify(obj, null, 2)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

// ── نصّ من HTML ──────────────────────────────────────────────────────────
const BLOCK = 'p|div|section|article|h[1-6]|li|tr|blockquote|pre|figcaption|br|hr';

function htmlToText(html) {
    return String(html || '')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(new RegExp(`</?(?:${BLOCK})\\b[^>]*>`, 'gi'), '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

/**
 * فقرات المتن الصالحة لاشتقاق وصف: نثر حقيقي، لا سطور بيانات ولا اقتباسات
 * ترويسة. كتابات المشاريع تفتح بـ blockquote فيه «Project Owner / Status»
 * وهو أسوأ ما يمكن أن يظهر في نتيجة بحث.
 */
function proseParagraphs(html) {
    const withoutQuotes = String(html || '').replace(/<blockquote[\s\S]*?<\/blockquote>/gi, ' ');
    const out = [];
    const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = re.exec(withoutQuotes)) !== null) {
        const text = htmlToText(m[1]).replace(/\s+/g, ' ').trim();
        if (text.length < 40) continue;              // سطر بيانات أو تسمية صورة
        if (/^[^\s]+\s*[:：]/.test(text) && text.length < 90) continue;
        out.push(text);
    }
    return out;
}

/**
 * وصف الصفحة: يُشتقّ من أول نثر حقيقي في المتن، ويُقطع عند حدّ جملة أو كلمة.
 * الهدف ١٥٠–١٦٠ محرفاً. لا يُخترع شيء: بلا متن ⇒ سلسلة فارغة.
 */
function deriveDescription(html, { min = 120, max = 160 } = {}) {
    const paras = proseParagraphs(html);
    let text = paras.join(' ');
    if (!text) text = htmlToText(html).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return clampText(text, { min, max });
}

function clampText(text, { min = 120, max = 160 } = {}) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;

    // ١. حدّ جملة داخل النافذة
    const window = clean.slice(0, max + 1);
    const sentence = Math.max(
        window.lastIndexOf('. '), window.lastIndexOf('。'),
        window.lastIndexOf('؟ '), window.lastIndexOf('! '),
        window.lastIndexOf('، ')
    );
    if (sentence >= min) return clean.slice(0, sentence + 1).trim();

    // ٢. حدّ كلمة
    const space = window.lastIndexOf(' ');
    const cut = space > min ? space : max;
    return clean.slice(0, cut).trim().replace(/[،,؛;:-]$/, '') + '…';
}

// ── عناوين ───────────────────────────────────────────────────────────────
/**
 * <title>: يقدّم الموضوع نفسه أولاً. اللاحقة تُضاف فقط إن بقي متّسع تحت
 * الحدّ — العنوان أثمن من العلامة في شريط النتائج.
 */
function buildTitle(topic, suffix, { max = 60, hard = 65 } = {}) {
    const t = String(topic || '').replace(/\s+/g, ' ').trim();
    if (!t) return String(suffix || '');
    if (suffix && (t.length + 3 + suffix.length) <= max) return `${t} | ${suffix}`;
    if (t.length <= hard) return t;
    const window = t.slice(0, hard + 1);
    const space = window.lastIndexOf(' ');
    return t.slice(0, space > 30 ? space : hard).trim();
}

// ── معرّفات المسار ───────────────────────────────────────────────────────
const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g;

/**
 * المعرّف يتبع خطّ العنوان: عربيّ للعنوان العربي، لاتينيّ للاتيني. لا نقحرة
 * — النقحرة تُنتج «aldhka-alastnay» وهي ليست كلمةً في أي لغة، فتخسر معنى
 * العنوان ولا تكسب قابلية قراءة.
 */
function slugify(text, { maxWords = 9, maxChars = 60 } = {}) {
    const base = String(text || '')
        .normalize('NFC')
        .replace(ARABIC_DIACRITICS, '')
        .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')  // علامات اتجاه
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

    if (!base) return '';

    const words = base.split(/\s+/).slice(0, maxWords);
    let slug = words.join('-');
    while (slug.length > maxChars && words.length > 2) {
        words.pop();
        slug = words.join('-');
    }
    return slug.toLowerCase();
}

/** معرّف موضوع — الموضوعات وسوم قصيرة، فلا حدّ كلمات عليها */
const topicSlug = (name) => slugify(name, { maxWords: 12, maxChars: 80 });

/** الرابط في الترميز: مسار مطلق من الجذر، مع ترميز نسبة للمحارف غير اللاتينية */
const encodePath = (p) => String(p || '').split('/').map(encodeURIComponent).join('/');

// ── أرقام وتواريخ — مطابقة حرفية لِـ js/i18n.js ─────────────────────────
const toArabicDigits = (v) => String(v).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function formatDate(dateString, lang = 'ar') {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return '';
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    try {
        return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory', opts);
    } catch {
        return d.toLocaleDateString(lang === 'en' ? 'en' : 'ar');
    }
}

/** العربية تميّز أربع حالات عدديّة — نفس منطق I18N.readTime حرفياً */
function readTime(minutes, withWord = true, lang = 'ar') {
    const n = Number(minutes) || 5;
    if (lang === 'en') return `${n} min${withWord ? ' read' : ''}`;
    const ar = toArabicDigits(n);
    const tail = withWord ? ' قراءة' : '';
    if (n === 1) return 'دقيقة' + tail;
    if (n === 2) return 'دقيقتان' + tail;
    if (n <= 10) return `${ar} دقائق${tail}`;
    return `${ar} دقيقة${tail}`;
}

/** تاريخ ISO كامل — article:published_time و datePublished يطلبان لحظة لا يوماً */
function isoDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return d.toISOString();
}

const isLatin = (s) => /[A-Za-z]/.test(s || '') && !/[\u0600-\u06FF]/.test(s || '');

module.exports = {
    ROOT,
    readJson, writeFileIfChanged,
    escapeHtml, escapeAttr, escapeXml, jsonLd,
    htmlToText, proseParagraphs, deriveDescription, clampText,
    buildTitle, slugify, topicSlug, encodePath,
    toArabicDigits, formatDate, readTime, isoDate, isLatin
};

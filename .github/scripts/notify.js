/**
 * notify.js — يُرسل بريداً واحداً للمهتمّين حين يُنشر جديد.
 *
 * يُشغَّل بعد البناء في كلا مسارَي Notion. يقرأ ما في data/، ويقارنه بما
 * سُجّل إرساله في Supabase، فيرسل ما لم يُرسل قطّ — ولا شيء غيره.
 *
 * ثلاثة مبادئ تحكم هذا الملف:
 *
 *   ١. لا يُرسل مرّتين. جدول sent_log يحمل مفتاحاً مركّباً (العنصر، القائمة)،
 *      فإعادة تشغيل سير العمل أو تعطّله في المنتصف لا يُنتج بريداً مكرّراً.
 *
 *   ٢. لا يُرسل بأثر رجعيّ. أوّل تشغيلة تجد السجلّ فارغاً فتختم كل المحتوى
 *      القائم «أُرسل» بلا إرسال — وإلا انهال على المشترك الأول أرشيفُ
 *      الموقع كلّه في لحظة واحدة.
 *
 *   ٣. لا يُفشل البناء. غياب مفتاح أو تعذّر إرسال يُطبع ويُنهي بنجاح: نشر
 *      الموقع لا يتوقّف لأن نشرة بريدية تعثّرت.
 *
 * الأسرار (GitHub Secrets، لا تدخل المستودع أبداً):
 *   SUPABASE_URL · SUPABASE_SERVICE_KEY · RESEND_API_KEY · MAIL_FROM
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const ORIGIN = site.origin;

const SUPABASE_URL = process.env.SUPABASE_URL || (site.subscribe && site.subscribe.url);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM;
const DRY_RUN = process.env.NOTIFY_DRY_RUN === '1';

const LISTS = {
    dhura: { label: 'ذُرى', kind: 'مشروع', hue: '#B4532A', section: 'projects' },
    ban: { label: 'بان', kind: 'مقال', hue: '#1F6B75', section: 'articles' }
};

function log(msg) { console.log('   ' + msg); }

/* ── حرّاس التشغيل ───────────────────────────────────────────────────────── */
function preflight() {
    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
    if (!RESEND_KEY) missing.push('RESEND_API_KEY');
    if (!MAIL_FROM) missing.push('MAIL_FROM');

    if (missing.length) {
        console.log('\n📭 الإشعار البريدي غير مهيّأ — تخطّي (والبناء يمضي).');
        log('ينقص: ' + missing.join('، '));
        log('أضفها في GitHub ← Settings ← Secrets and variables ← Actions.');
        log('التفصيل في docs/SUBSCRIBE.md §4.');
        return false;
    }
    return true;
}

/* ── Supabase عبر service_role: يتجاوز RLS ويقرأ الجدول ─────────────────── */
async function sb(pathname, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
        ...options,
        headers: {
            apikey: SERVICE_KEY,
            Authorization: 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
    // ‏PostgREST يعيد جسداً فارغاً للإدراج والتحديث ما لم يُطلب Prefer: return
    return body ? JSON.parse(body) : null;
}

/* ── ما يجب إرساله ──────────────────────────────────────────────────────── */
function readItems() {
    const out = [];
    const read = (file, key, list) => {
        const abs = path.join(ROOT, 'data', file);
        if (!fs.existsSync(abs)) return;
        const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
        for (const it of data[key] || []) {
            out.push({
                id: it.id,
                list,
                title: it.title,
                summary: (it.description || it.summary || '').trim(),
                date: it.date
            });
        }
    };
    read('articles.json', 'articles', 'ban');
    read('projects.json', 'projects', 'dhura');
    return out;
}

/** مسار الصفحة من سجلّ المعرّفات — نفس المصدر الذي بنى الصفحة */
function urlOf(item) {
    const ledgerPath = path.join(ROOT, 'data', 'slugs.json');
    if (!fs.existsSync(ledgerPath)) return null;
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const rec = ledger[item.id];
    if (!rec) return null;
    const section = LISTS[item.list].section;
    return `${ORIGIN}/${section}/${encodeURIComponent(rec.slug)}/`;
}

/* ── قالب البريد ────────────────────────────────────────────────────────── */
const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function emailHtml(item, url, unsubUrl) {
    const L = LISTS[item.list];
    return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F2EF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F2EF;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#F9F8F6;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0 0 6px;font:500 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${L.hue};letter-spacing:.04em;">
        ${esc(L.label)} · ${esc(L.kind)} جديد</p>
      <h1 style="margin:0 0 14px;font:700 25px/1.35 Georgia,serif;color:#16181C;">${esc(item.title)}</h1>
      ${item.summary ? `<p style="margin:0 0 22px;font:400 16px/1.75 Georgia,serif;color:#5B6169;">${esc(item.summary)}</p>` : ''}
      <a href="${esc(url)}"
         style="display:inline-block;background:${L.hue};color:#fff;text-decoration:none;
                padding:12px 26px;border-radius:999px;font:500 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        اقرأ ${esc(L.kind === 'مشروع' ? 'المشروع' : 'المقال')}</a>
    </td></tr>
    <tr><td style="padding:28px;">
      <hr style="border:none;border-top:1px solid #E1E2DD;margin:0 0 16px;">
      <p style="margin:0;font:400 12px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5B6169;">
        وصلك هذا البريد لأنك مشترك في تحديثات ${esc(L.label)} من
        <a href="${esc(ORIGIN)}/" style="color:#2A4A9B;">${esc(site.name_ar)}</a>.<br>
        <a href="${esc(unsubUrl)}" style="color:#5B6169;">إلغاء الاشتراك</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function emailText(item, url, unsubUrl) {
    const L = LISTS[item.list];
    return [
        `${L.label} · ${L.kind} جديد`, '',
        item.title, '',
        item.summary || '',
        '', url, '',
        '—',
        `وصلك هذا البريد لأنك مشترك في تحديثات ${L.label}.`,
        `إلغاء الاشتراك: ${unsubUrl}`
    ].filter((l) => l !== null).join('\n');
}

/* ── الإرسال ────────────────────────────────────────────────────────────── */
async function send(to, subject, html, text) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text })
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── المسار ─────────────────────────────────────────────────────────────── */
async function main() {
    console.log('\n📣 إشعار المشتركين\n');
    if (!preflight()) return;

    const items = readItems();
    const sent = await sb('sent_log?select=item_id,list');
    const sentKeys = new Set(sent.map((r) => `${r.item_id}:${r.list}`));

    // المبدأ ٢: أوّل تشغيلة تختم ولا ترسل
    if (sent.length === 0) {
        log(`السجلّ فارغ — أوّل تشغيلة. تُختم ${items.length} عنصراً قائماً بلا إرسال،`);
        log('فلا ينهال أرشيف الموقع على المشترك الأول. الجديد بعد اليوم يُرسل.');
        if (items.length) {
            await sb('sent_log', {
                method: 'POST',
                headers: { Prefer: 'resolution=ignore-duplicates' },
                body: JSON.stringify(items.map((i) => ({ item_id: i.id, list: i.list, recipients: 0 })))
            });
        }
        console.log('\n✅ خُتم المحتوى القائم. لم يُرسل شيء.');
        return;
    }

    const fresh = items.filter((i) => !sentKeys.has(`${i.id}:${i.list}`));
    if (!fresh.length) {
        console.log('✅ لا جديد يستحقّ الإرسال.');
        return;
    }
    log(`جديد لم يُرسل: ${fresh.length}`);

    for (const item of fresh) {
        const url = urlOf(item);
        if (!url) { log(`⚠️  تخطّي «${item.title}» — لا مسار في data/slugs.json`); continue; }

        const col = item.list;
        const subs = await sb(`subscribers?select=email,unsub_token&${col}=is.true`);
        const L = LISTS[col];

        if (!subs.length) {
            log(`«${item.title}» — لا مشترك في ${L.label}. يُختم بلا إرسال.`);
            await sb('sent_log', { method: 'POST', body: JSON.stringify({ item_id: item.id, list: col, recipients: 0 }) });
            continue;
        }

        const subject = `${L.label} · ${item.title}`;
        let ok = 0, failed = 0;

        for (const s of subs) {
            const unsubUrl = `${ORIGIN}/unsubscribe/?t=${s.unsub_token}&l=${col}`;
            if (DRY_RUN) { ok++; continue; }
            try {
                await send(s.email, subject, emailHtml(item, url, unsubUrl), emailText(item, url, unsubUrl));
                ok++;
            } catch (err) {
                failed++;
                log(`   ✗ ${s.email.replace(/(.{2}).*(@.*)/, '$1***$2')}: ${err.message}`);
            }
            await sleep(600);   // حدّ Resend المجاني ٢/ث — هامش مريح
        }

        log(`«${item.title}» → ${L.label}: ${ok} نجحت${failed ? `، ${failed} فشلت` : ''}${DRY_RUN ? ' (تجربة جافّة)' : ''}`);

        if (!DRY_RUN) {
            await sb('sent_log', { method: 'POST', body: JSON.stringify({ item_id: item.id, list: col, recipients: ok }) });
            const now = new Date().toISOString();
            await sb(`subscribers?${col}=is.true`, { method: 'PATCH', body: JSON.stringify({ last_sent_at: now }) });
        }
    }

    console.log('\n✅ انتهى الإشعار.');
}

main().catch((err) => {
    // المبدأ ٣: لا يُفشل البناء
    console.error('\n⚠️  تعثّر الإشعار البريدي — والموقع منشور على أي حال.');
    console.error('   ' + err.message);
    process.exit(0);
});

/**
 * بطاقة الاشتراك — ذُرى و بان
 *
 * المفتاح المستعمل هنا عامّ (anon) ومنشورٌ عمداً. أمانه ليس في إخفائه بل في
 * أن قاعدة البيانات لا تمنح حامله شيئاً: لا قراءة للجدول ولا كتابة مباشرة
 * فيه، وإنما استدعاء دالّتين محكومتين تتحقّقان من المدخلات. جُرّب ذلك:
 * ‏GET على الجدول يعود 42501 permission denied. راجع docs/SUBSCRIBE.md.
 *
 * تحسين تدريجي: بلا جافاسكربت يبقى النصّ والصورة ظاهرين، ويُخفى الزرّ عبر
 * html:not(.js) فلا يُعرض زرّ ميت.
 */

(function () {
    'use strict';

    const T = (ar, en) => (window.I18N ? window.I18N.t(ar, en) : ar);

    const CFG = window.SUBSCRIBE_CONFIG || null;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.sub-card').forEach(setup);
    });

    function setup(card) {
        const openBtn = card.querySelector('.sub-open');
        const form = card.querySelector('.sub-form');
        const input = card.querySelector('input[type="email"]');
        const submit = card.querySelector('.sub-submit');
        const note = card.querySelector('.sub-note');
        const toggle = card.querySelector('.switch-input');
        const panel = card.querySelector('.sub-panel');
        if (!openBtn || !form || !input || !submit || !note) return;

        const primary = card.dataset.list;                   // 'dhura' | 'ban'
        const secondary = primary === 'dhura' ? 'ban' : 'dhura';

        openBtn.addEventListener('click', () => {
            card.classList.add('is-open');
            openBtn.setAttribute('aria-expanded', 'true');
            /* اللوح ينتقل من ارتفاع صفر، و.focus() على عنصر بلا ارتفاع
               لا يفعل شيئاً. الإطار التالي يكفي. */
            requestAnimationFrame(() => input.focus());
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = input.value.trim();

            if (!isEmail(email)) {
                say(note, 'error', T('بريد غير صالح. تحقّق منه ثم أعد المحاولة.',
                                     'That email does not look right. Please check it.'));
                input.focus();
                return;
            }
            if (!CFG) {
                say(note, 'error', T('الاشتراك غير مهيّأ بعد.', 'Subscriptions are not configured yet.'));
                return;
            }

            submit.disabled = true;
            const original = submit.textContent;
            submit.textContent = T('لحظة…', 'One moment…');
            say(note, '', '');

            try {
                const body = { p_email: email, p_source: primary };
                body['p_' + primary] = true;
                body['p_' + secondary] = !!(toggle && toggle.checked);

                const res = await fetch(CFG.url + '/rest/v1/rpc/subscribe', {
                    method: 'POST',
                    headers: {
                        apikey: CFG.key,
                        Authorization: 'Bearer ' + CFG.key,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const data = await res.json().catch(() => null);

                if (!res.ok || !data || data.ok !== true) {
                    const code = data && data.error;
                    say(note, 'error', code === 'invalid_email'
                        ? T('بريد غير صالح. تحقّق منه ثم أعد المحاولة.',
                            'That email does not look right. Please check it.')
                        : T('تعذّر إتمام الاشتراك الآن. أعد المحاولة بعد قليل.',
                            'Could not complete the subscription. Please try again shortly.'));
                    submit.disabled = false;
                    submit.textContent = original;
                    return;
                }

                done(card, panel, data.created, primary, !!(toggle && toggle.checked));
            } catch (err) {
                say(note, 'error', T('تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',
                                     'Connection failed. Check your network and try again.'));
                submit.disabled = false;
                submit.textContent = original;
            }
        });
    }

    /** النموذج يُستبدل برسالة واحدة — فلا يُرسل مرّتين بالخطأ */
    function done(card, panel, created, primary, both) {
        const name = primary === 'dhura' ? 'ذُرى' : 'بان';
        const other = primary === 'dhura' ? 'بان' : 'ذُرى';
        const nameEn = primary === 'dhura' ? 'Dhura' : 'Ban';
        const otherEn = primary === 'dhura' ? 'Ban' : 'Dhura';

        const what = both
            ? T(`تم. سيصلك جديد ${name} و${other}.`,
                `Done. You will hear about new ${nameEn} and ${otherEn} work.`)
            : T(`تم. سيصلك جديد ${name}.`, `Done. You will hear about new ${nameEn} work.`);

        const extra = created
            ? ''
            : T(' كنت مشتركاً من قبل، وحُدّثت تفضيلاتك.', ' You were already subscribed; your preferences were updated.');

        const wrap = panel.querySelector('div') || panel;
        wrap.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'sub-done';
        p.setAttribute('role', 'status');
        p.textContent = what + extra;
        wrap.appendChild(p);
    }

    function say(node, state, text) {
        node.textContent = text;
        if (state) node.setAttribute('data-state', state);
        else node.removeAttribute('data-state');
    }

    /* فحص خفيف في الواجهة لتوفير رحلة شبكة — والفحص الملزم في قاعدة
       البيانات، فلا يُعتمد على المتصفّح في شيء. */
    function isEmail(v) {
        return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) && v.length <= 254;
    }
})();

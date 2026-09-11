/**
 * صفحة إلغاء الاشتراك.
 *
 * الرابط يحمل رمزاً عشوائياً (uuid) لا بريداً: لا يُعرف صاحبه من الرابط،
 * ولا يُخمَّن رمز غيره. والرمز وحده كافٍ — لا كلمة مرور ولا تسجيل دخول،
 * لأن الحاجز أمام الخروج هو أسوأ ما في نشرة بريدية.
 */

(function () {
    'use strict';

    const T = (ar, en) => (window.I18N ? window.I18N.t(ar, en) : ar);
    const CFG = window.SUBSCRIBE_CONFIG || null;

    document.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('unsubRoot');
        if (!root) return;

        const params = new URLSearchParams(location.search);
        const token = params.get('t');
        const list = params.get('l') || 'all';
        const note = document.getElementById('unsubNote');
        const actions = document.getElementById('unsubActions');

        if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
            show(note, 'error', T('الرابط ناقص أو غير صالح. افتح الرابط من البريد كما وصلك.',
                                  'This link is incomplete or invalid. Open it from the email as it arrived.'));
            if (actions) actions.hidden = true;
            return;
        }
        if (!CFG) {
            show(note, 'error', T('الخدمة غير مهيّأة.', 'The service is not configured.'));
            return;
        }

        document.querySelectorAll('[data-unsub]').forEach((btn) => {
            btn.addEventListener('click', () => run(btn.dataset.unsub, token, note, actions, btn));
        });

        // الرابط يحمل قائمة بعينها ⇒ نفّذ مباشرةً، فالقصد صريح
        if (list === 'dhura' || list === 'ban') {
            run(list, token, note, actions, null);
        }
    });

    async function run(list, token, note, actions, btn) {
        const label = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = T('لحظة…', 'One moment…'); }
        show(note, '', T('جارٍ التنفيذ…', 'Working…'));

        try {
            const res = await fetch(CFG.url + '/rest/v1/rpc/unsubscribe', {
                method: 'POST',
                headers: {
                    apikey: CFG.key,
                    Authorization: 'Bearer ' + CFG.key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ p_token: token, p_list: list })
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || !data || data.ok !== true) {
                show(note, 'error', T('تعذّر تنفيذ الطلب. قد يكون الرابط انتهى أو أُلغي الاشتراك من قبل.',
                                      'Could not complete the request. The link may have expired, or you already unsubscribed.'));
                if (btn) { btn.disabled = false; btn.textContent = label; }
                return;
            }

            const still = [];
            if (data.dhura) still.push('ذُرى');
            if (data.ban) still.push('بان');

            show(note, 'ok', still.length
                ? T(`تم. ما زلت مشتركاً في ${still.join(' و')}.`,
                    `Done. You are still subscribed to ${still.join(' and ')}.`)
                : T('تم إلغاء اشتراكك. لن يصلك بريد بعد الآن.',
                    'You have been unsubscribed. You will not receive any more email.'));
            if (actions) actions.hidden = true;
        } catch (err) {
            show(note, 'error', T('تعذّر الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',
                                  'Connection failed. Check your network and try again.'));
            if (btn) { btn.disabled = false; btn.textContent = label; }
        }
    }

    function show(node, state, text) {
        if (!node) return;
        node.textContent = text;
        if (state) node.setAttribute('data-state', state);
        else node.removeAttribute('data-state');
    }
})();

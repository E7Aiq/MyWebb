/**
 * i18n — طبقة لغة الواجهة
 *
 * العربية هي الأصل: كل نصّ مكتوب في الترميز عربياً، والإنجليزية تعيش في
 * السمة data-en بجانبه. فإن أخفقت جافاسكربت أو عُطّلت بقي الموقع عربياً
 * كاملاً وصحيحاً — لا صفحة نصفها مفاتيح ترجمة.
 *
 * ما يُترجَم: نصوص الواجهة التي كُتبت في هذا المستودع.
 * ما لا يُترجَم: متن المقالات والمشاريع — مصدره data/ وهو خارج نطاق
 * التعديل، ولا توجد نسخة إنجليزية منه. وكذلك بيت الشعر: اقتباس عربي
 * بعينه، والاقتباسات تُنقل لا تُترجَم في طبقة واجهة.
 *
 * السمات المدعومة على العنصر:
 *   data-en          نصّ العنصر
 *   data-en-label    aria-label
 *   data-en-content  محتوى <meta>
 */
(function () {
    'use strict';

    const KEY = 'alzobaidi:lang';
    const DEFAULT_LANG = 'ar';

    /* الأصل العربي يُلتقط مرة واحدة عند أول تبديل.
       يُخزَّن كـ innerHTML لا textContent: بعض العناصر تحمل ترميزاً داخلياً
       له معنى — الاسم في الهيرو مثلاً فيه <span class="swash"> التي تحمل
       الحرف المرسل. الكتابة بـ textContent كانت تمحو ذلك الترميز، فيختفي
       الحرف المرسل نهائياً بعد أول تبديل ذهاباً وإياباً.
       الإنجليزية تُكتب دائماً بـ textContent لأنها نصّ من سمة. */
    const original = new WeakMap();

    function captureAttr(el, prop, key) {
        const store = 'ar' + key;
        if (el.dataset[store] === undefined) {
            el.dataset[store] = el.getAttribute(prop) || '';
        }
        return el.dataset[store];
    }

    function swap(root, lang) {
        const en = lang === 'en';

        root.querySelectorAll('[data-en]').forEach((el) => {
            if (!original.has(el)) original.set(el, el.innerHTML);
            if (en) el.textContent = el.dataset.en;
            else el.innerHTML = original.get(el);
        });

        root.querySelectorAll('[data-en-label]').forEach((el) => {
            const ar = captureAttr(el, 'aria-label', 'Label');
            el.setAttribute('aria-label', en ? el.dataset.enLabel : ar);
        });

        root.querySelectorAll('[data-en-content]').forEach((el) => {
            const ar = captureAttr(el, 'content', 'Content');
            el.setAttribute('content', en ? el.dataset.enContent : ar);
        });
    }

    function stored() {
        try { return localStorage.getItem(KEY); } catch { return null; }
    }

    function persist(lang) {
        try { localStorage.setItem(KEY, lang); } catch { /* وضع خاص — تجاهل */ }
    }

    function current() {
        return document.documentElement.lang === 'en' ? 'en' : 'ar';
    }

    /**
     * ‏lang وdir يُضبطان على <html> كسمتين لا بـ CSS: السمة تعمل قبل تحميل
     * الأنماط وتضبط الاتجاه الأساسي لخوارزمية bidi.
     */
    function apply(lang, { announce = true } = {}) {
        const en = lang === 'en';
        const de = document.documentElement;

        de.lang = en ? 'en' : 'ar';
        de.dir = en ? 'ltr' : 'rtl';

        swap(document, lang);
        syncToggle(lang);

        if (announce) {
            document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
        }
    }

    /* الزرّ يعرض اللغة التي سينتقل إليها، لا التي هو فيها — وهو ما يفهمه
       القارئ فوراً بلا تعلّم. */
    function syncToggle(lang) {
        document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
            const toEn = lang !== 'en';
            btn.textContent = toEn ? 'EN' : 'ع';
            btn.setAttribute('lang', toEn ? 'en' : 'ar');
            btn.setAttribute('aria-label', toEn ? 'Switch to English' : 'التبديل إلى العربية');
            btn.setAttribute('title', toEn ? 'Switch to English' : 'التبديل إلى العربية');
        });
    }

    function toggle() {
        const next = current() === 'en' ? 'ar' : 'en';
        persist(next);
        apply(next);
    }

    function init() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-lang-toggle]');
            if (!btn) return;
            e.preventDefault();
            toggle();
        });

        // السكربت السطري في <head> ضبط lang/dir قبل الرسم؛ هنا يُبدَّل النصّ.
        apply(current(), { announce: false });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ── الواجهة البرمجية للملفات الأخرى ──────────────────────────────────
       t('عربي', 'English') تُرجع النصّ حسب اللغة الحالية. المولّدات تستدعيها
       عند البناء، وتعيد البناء عند حدث langchange. */
    window.I18N = {
        get lang() { return current(); },
        t(ar, en) { return current() === 'en' ? en : ar; },
        /** الأرقام: عربية-هندية في الوضع العربي، لاتينية في الإنجليزي */
        num(value) {
            const s = String(value);
            return current() === 'en'
                ? s
                : s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
        },
        /**
         * زمن القراءة. العربية تميّز أربع حالات عدديّة:
         *   ١ ⇒ مفرد · ٢ ⇒ مثنّى · ٣–١٠ ⇒ جمع قلّة · ١١+ ⇒ تمييز مفرد منصوب
         */
        readTime(minutes, withWord = true) {
            const n = Number(minutes) || 5;
            if (current() === 'en') {
                return `${n} min${withWord ? ' read' : ''}`;
            }
            const ar = this.num(n);
            const tail = withWord ? ' قراءة' : '';
            if (n === 1) return 'دقيقة' + tail;
            if (n === 2) return 'دقيقتان' + tail;
            if (n <= 10) return `${ar} دقائق${tail}`;
            return `${ar} دقيقة${tail}`;
        },
        /**
         * التاريخ: تقويم ميلادي في اللغتين.
         * ar-SA وحدها تتخلّف إلى التقويم الهجري، والمصدر تواريخ ISO ميلادية.
         */
        date(dateString) {
            if (!dateString) return '';
            const d = new Date(dateString);
            if (isNaN(d)) return '';
            const opts = { year: 'numeric', month: 'long', day: 'numeric' };
            try {
                return d.toLocaleDateString(
                    current() === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory', opts);
            } catch {
                return d.toLocaleDateString(current() === 'en' ? 'en' : 'ar');
            }
        },
        /** تُستدعى من المولّدات كي تُعيد البناء عند تبديل اللغة */
        onChange(fn) { document.addEventListener('langchange', fn); }
    };
})();

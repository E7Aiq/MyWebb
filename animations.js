/**
 * Scroll reveal.
 *
 * يضيف فئة «تم الكشف» فقط — لا يُخفي شيئاً أبداً. الإخفاء يعيش كلّه في
 * animations.css خلف بوابتَي .js و prefers-reduced-motion، فإن لم يعمل هذا
 * الملف بقي كل المحتوى ظاهراً (انظر عقد «CSS لا يُخفي المحتوى»).
 *
 * أُزيل: تعتيم <body> عند التحميل (كان يومض صفحة فارغة على الاتصالات
 * البطيئة)، وتتابع .skill-card (لا وجود لهذه الفئة في أي صفحة).
 */

(function () {
    'use strict';

    const SELECTOR = '.rv, .fade-in, .slide-up, .slide-left, .slide-right, .scale-in';
    // الأب المتتابع يُراقَب أيضاً وإن لم يحمل فئة كشف: أبناؤه يُكشفون منه
    // وحده، فلو لم يُراقَب بقيت البطاقات مخفيّة (بالضبط كعلّة .slide-up).
    const OBSERVE = SELECTOR + ', .stagger-parent';
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('DOMContentLoaded', () => {
        if (prefersReduced) return;   // CSS يُبقيها ظاهرة أصلاً

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('animate');

                if (entry.target.classList.contains('stagger-parent')) {
                    entry.target.querySelectorAll('.stagger-child').forEach((child, i) => {
                        setTimeout(() => child.classList.add('animate'), i * 70);
                    });
                }
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        // ما هو ظاهر أصلاً عند التركيب يُكشف فوراً بلا انتظار المراقب:
        // المحتوى فوق حدّ الشاشة يجب ألا ينتظر دورة IntersectionObserver.
        const inViewport = (el) => {
            const r = el.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
        };

        const observe = (root) => {
            root.querySelectorAll(OBSERVE).forEach((el) => {
                if (el.classList.contains('observed')) return;
                el.classList.add('observed');
                if (inViewport(el)) {
                    el.classList.add('animate');
                    // الأب الظاهر يكشف أبناءه فوراً كذلك
                    if (el.classList.contains('stagger-parent')) {
                        el.querySelectorAll('.stagger-child').forEach((c) => c.classList.add('animate'));
                    }
                    return;
                }
                observer.observe(el);
            });
        };

        observe(document);

        // شبكة أمان: لو لم يُطلق المراقب إطلاقاً (تبويب في الخلفية، أو بيئة
        // تُعلّق rAF/IO، أو خطأ في مكان آخر) يظهر كل شيء بعد مهلة قصيرة.
        // مبدأ العقد: قد نخسر الحركة، ولا نخسر المحتوى أبداً.
        //
        // لا بدّ أن تشمل .stagger-child أيضاً: هؤلاء يُكشفون من الأب لا
        // بالمراقبة المباشرة، فلو لم يتقاطع الأب بقيت البطاقات الأربع في
        // «رحلة البيانات» مخفيّة إلى الأبد — وهي نفس علّة .slide-up القديمة.
        setTimeout(() => {
            document.querySelectorAll(SELECTOR + ', .stagger-child')
                .forEach((el) => el.classList.add('animate'));
        }, 1500);

        // البطاقات تُبنى بعد جلب JSON — راقب الأوعية الديناميكية
        // featuredArticlesGrid كان ناقصاً: بطاقة المقال المميّز في الصفحة
        // الرئيسية لم تكن تُسجَّل عند المراقب، فلم يكن ينقذها إلا مهلة
        // الأمان أعلاه — سباقٌ يخسره الجلب البطيء وتكبر خسارته مع الملف.
        ['projectsGrid', 'featuredProjectsGrid',
         'articles-grid', 'featuredArticlesGrid'].forEach((id) => {
            const host = document.getElementById(id);
            if (!host) return;
            new MutationObserver(() => observe(host))
                .observe(host, { childList: true, subtree: true });
        });
    });
})();

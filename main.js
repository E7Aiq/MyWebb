/**
 * Shared chrome: mobile nav, active link, smooth scroll, nav scroll state.
 * لا منطق بيانات هنا إطلاقاً.
 */

(function () {
    'use strict';

    // ارتفاع النافبار من مصدر واحد (--nav-h) بدل 80px مكرّرة في JS وCSS
    function navHeight() {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
        const px = parseFloat(v);
        if (!px) return 64;
        return v.trim().endsWith('rem')
            ? px * parseFloat(getComputedStyle(document.documentElement).fontSize)
            : px;
    }

    // ── قائمة الجوال ──────────────────────────────────────────────────────
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    if (mobileToggle && navLinks) {
        const setOpen = (open) => {
            mobileToggle.classList.toggle('active', open);
            navLinks.classList.toggle('active', open);
            document.documentElement.classList.toggle('nav-open', open);
            mobileToggle.setAttribute('aria-expanded', String(open));
            if (open) navLinks.scrollTop = 0;
        };
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-controls', 'navLinks');

        mobileToggle.addEventListener('click', () => {
            setOpen(!navLinks.classList.contains('active'));
        });

        navLinks.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => setOpen(false));
        });

        document.addEventListener('click', (e) => {
            if (!mobileToggle.contains(e.target) && !navLinks.contains(e.target)) setOpen(false);
        });

        // Esc يغلق القائمة — سلوك متوقّع لأي overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                setOpen(false);
                mobileToggle.focus();
            }
        });
    }

    // ── إبراز الرابط النشط ────────────────────────────────────────────────
    // صفحات التفاصيل تنتمي إلى قسمها: article.html تحت «المقالات»،
    // و project-details.html تحت «المشاريع». المطابقة بالاسم وحدها كانت
    // تترك هاتين الصفحتين بلا رابط نشط إطلاقاً.
    const SECTION_OF = {
        'article.html': 'articles.html',
        'project-details.html': 'projects.html'
    };

    function setActiveNavLink() {
        let current = window.location.pathname.split('/').pop() || 'index.html';
        current = SECTION_OF[current] || current;

        document.querySelectorAll('.nav-link').forEach((link) => {
            const href = (link.getAttribute('href') || '').split('#')[0];
            const isActive = href === current;
            link.classList.toggle('active', isActive);
            if (isActive) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    // ── تمرير سلس للمراسي ─────────────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - navHeight();
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
        });
    });

    // ── حالة النافبار عند التمرير ─────────────────────────────────────────
    // فئة تُبدَّل مع rAF ومستمع passive — بدل ضبط box-shadow سطرياً في كل
    // حدث تمرير (كان يتجاوز الـ CSS ويعمل بلا تقييد).
    const navbar = document.getElementById('navbar');
    if (navbar) {
        let ticking = false;
        const update = () => {
            ticking = false;
            navbar.classList.toggle('is-scrolled', window.scrollY > 8);
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    // ── روابط خارجية آمنة ─────────────────────────────────────────────────
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
        if (!link.hasAttribute('rel')) link.setAttribute('rel', 'noopener noreferrer');
    });

    document.addEventListener('DOMContentLoaded', setActiveNavLink);
})();

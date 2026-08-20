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
    const MOBILE_NAV_MQ = window.matchMedia('(max-width: 48rem)');

    if (mobileToggle && navLinks) {
        let navLinksHome = null;
        let navLinksBefore = null;
        let lockedScrollY = 0;

        // fixed داخل navbar + backdrop-filter يُقصّ اللوح في Safari الحقيقي
        const mountNavOverlay = () => {
            if (!MOBILE_NAV_MQ.matches || navLinks.parentElement === document.body) return;
            navLinksHome = navLinks.parentElement;
            navLinksBefore = navLinks.nextElementSibling;
            document.body.appendChild(navLinks);
        };

        const unmountNavOverlay = () => {
            if (!navLinksHome || navLinks.parentElement !== document.body) return;
            navLinksHome.insertBefore(navLinks, navLinksBefore);
        };

        const lockPageScroll = () => {
            lockedScrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${lockedScrollY}px`;
            document.body.style.left = '0';
            document.body.style.right = '0';
            document.body.style.width = '100%';
        };

        const unlockPageScroll = () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.width = '';
            window.scrollTo(0, lockedScrollY);
        };

        const setOpen = (open) => {
            mobileToggle.classList.toggle('active', open);
            navLinks.classList.toggle('active', open);
            document.documentElement.classList.toggle('nav-open', open);
            mobileToggle.setAttribute('aria-expanded', String(open));
            if (open) {
                mountNavOverlay();
                navLinks.scrollTop = 0;
                lockPageScroll();
            } else {
                unlockPageScroll();
            }
            /* حبس التركيز داخل اللوح. inert يُخرج بقيّة الصفحة من شجرة
               الوصول ومن ترتيب Tab معاً — فلا يتسرّب التركيز إلى محتوى
               مخفيّ خلف الطبقة الضبابية. يُحسَب بعد mountNavOverlay لأن
               اللوح ينتقل إلى body فيغيّر قائمة الأشقّاء. */
            [...document.body.children].forEach((el) => {
                if (el !== navLinks && el.tagName !== 'SCRIPT') el.inert = open;
            });
            /* اللوح ينتقل من visibility:hidden، و.focus() على عنصر مخفيّ
               لا يفعل شيئاً. الإطار التالي يكفي ليصير مرئياً. */
            if (open) {
                requestAnimationFrame(() => {
                    if (navLinks.classList.contains('active')) {
                        navLinks.querySelector('.nav-link')?.focus();
                    }
                });
            }
        };

        const syncNavOverlay = () => {
            if (MOBILE_NAV_MQ.matches) mountNavOverlay();
            else {
                if (navLinks.classList.contains('active')) setOpen(false);
                unmountNavOverlay();
            }
        };

        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-controls', 'navLinks');

        mobileToggle.addEventListener('click', () => {
            setOpen(!navLinks.classList.contains('active'));
        });

        navLinks.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => setOpen(false));
        });

        /* الحارس شرط لا تحسين: بدونه كانت كل نقرة في المستند تنادي setOpen(false)
           فينفَّذ unlockPageScroll ومعه scrollTo(0, lockedScrollY) — وهي صفر ما لم
           تُفتح القائمة قط. فكان كل رابط مرساة يُلغى بعد تنفيذه مباشرة: معالج
           الرابط يمرّر نحو #contact، ثم تصل الفقاعة إلى المستند فتُعيد التمرير
           إلى الصفر. «تواصل معي» وروابط التخطّي كانت معطّلة بهذا. */
        document.addEventListener('click', (e) => {
            if (!navLinks.classList.contains('active')) return;
            if (!mobileToggle.contains(e.target) && !navLinks.contains(e.target)) setOpen(false);
        });

        // Esc يغلق القائمة — سلوك متوقّع لأي overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                setOpen(false);
                mobileToggle.focus();
            }
        });

        syncNavOverlay();
        MOBILE_NAV_MQ.addEventListener('change', syncNavOverlay);
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

            /* preventDefault يلغي نقل التركيز الذي كان المتصفّح سيقوم به،
               فكان مستخدم لوحة المفاتيح يرى الصفحة تنتقل وتركيزه لم يبرح
               مكانه. tabindex="-1" يجعل الهدف قابلاً للتركيز برمجياً فقط. */
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });

            /* والعنوان يتبع الموضع، فيعمل زرّ الرجوع ويصحّ نسخ الرابط */
            history.replaceState(null, '', href);
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

    /* ── مُوقِف شريط الشعارات ───────────────────────────────────────────────
       WCAG 2.2.2 يوجب وسيلة إيقاف لأي حركة تلقائية تتجاوز خمس ثوانٍ. الشريط
       يدور بلا نهاية في دورة ٥٢s. الإيقاف عند التحويم أُزيل بطلب، فالبديل
       زرّ صريح — وهو يخدم اللمس أيضاً حيث لا تحويم أصلاً. */
    document.querySelectorAll('[data-mq-toggle]').forEach((btn) => {
        const track = document.querySelector('.mq__track');
        if (!track) return;
        btn.addEventListener('click', () => {
            const paused = track.style.animationPlayState === 'paused';
            track.style.animationPlayState = paused ? 'running' : 'paused';
            btn.setAttribute('aria-pressed', String(!paused));
            const label = paused
                ? { ar: 'إيقاف حركة الشعارات', en: 'Pause logo motion' }
                : { ar: 'تشغيل حركة الشعارات', en: 'Play logo motion' };
            btn.setAttribute('aria-label', window.I18N ? window.I18N.t(label.ar, label.en) : label.ar);
            btn.dataset.enLabel = label.en;
        });
    });

    /* ── نسخ البريد ────────────────────────────────────────────────────────
       ‏mailto: يفتح برنامجاً غير مهيّأ — أو لا شيء — عند من يستعمل بريد الويب
       على الحاسوب، وهم الأكثرية. زرّ النسخ مخرج لا يعتمد على إعدادات النظام. */
    document.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const value = btn.dataset.copy;
            try {
                await navigator.clipboard.writeText(value);
            } catch {
                const input = document.createElement('input');
                input.value = value;
                document.body.appendChild(input);
                input.select();
                try { document.execCommand('copy'); } catch { /* لا شيء */ }
                input.remove();
            }
            const original = btn.textContent;
            btn.textContent = window.I18N ? window.I18N.t('نُسخ ✓', 'Copied ✓') : 'نُسخ ✓';
            setTimeout(() => { btn.textContent = original; }, 1800);
        });
    });

    document.addEventListener('DOMContentLoaded', setActiveNavLink);
})();

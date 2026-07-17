/**
 * Visual Effects Layer — "Data as Art"
 * طبقة جمالية بحتة: لا تلمس منطق البيانات إطلاقاً.
 * كلها vanilla JS — بدون مكتبات.
 *
 * البوابات:
 *  - prefers-reduced-motion  → تعطيل كل الحركة (الكانفس يُرسم إطاراً ثابتاً)
 *  - ≤768px                  → لا كانفس (أداء الجوال)
 *  - أجهزة اللمس             → لا مغناطيسية أزرار ولا توهج مؤشر
 */

(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    // عرض 0 = بيئة غير جاهزة (prerender/تبويب مخفي) — لا نحكم عليها "جوال"
    const isMobile = window.matchMedia('(max-width: 768px)').matches
        && window.innerWidth > 0 && window.innerWidth <= 768;

    document.addEventListener('DOMContentLoaded', () => {
        initHeroCanvas();
        initHeroTitleReveal();
        initCardCursorGlow();
        initMagneticButtons();
        initTitleObserver();
        initSectionReveal();
        initSkillCardTilt();
        initTouchRipple();
        initNavUnderline();
        initDetailCover();
        initReadingProgress();
    });

    // ============================================================
    // 1. سماء البيانات — شبكة نقاط متصلة في خلفية الهيرو
    // ============================================================

    function initHeroCanvas() {
        const hero = document.querySelector('.hero');
        if (!hero || isMobile) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'heroCanvas';
        canvas.setAttribute('aria-hidden', 'true');
        hero.prepend(canvas);

        const ctx = canvas.getContext('2d');
        const rootStyles = getComputedStyle(document.documentElement);
        const RGB_A = (rootStyles.getPropertyValue('--accent-primary-rgb') || '59,130,246').trim();
        const RGB_B = (rootStyles.getPropertyValue('--accent-secondary-rgb') || '16,185,129').trim();
        const GOLD = (rootStyles.getPropertyValue('--accent-gold-rgb') || '200,164,92').trim();

        const TAU = Math.PI * 2;
        const COUNT = 58;          // نجوم
        const LINK_DIST = 118;     // مسافة خطوط الأبراج
        const SPEED = 0.16;        // انجراف بطيء كلاسيكي

        let w = 0, h = 0;
        let particles = [];
        let rafId = null;
        let inView = true;
        // مركز الأسطرلاب + حلقاته + زاوية الدوران البطيء
        let cx = 0, cy = 0, rings = [], rot = 0;
        const mouse = { x: null, y: null };
        const parallax = { x: 0, y: 0 };

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = hero.getBoundingClientRect();
            // سلسلة احتياط: قياسات صفرية تعني تبويباً غير مرئي بعد
            w = hero.offsetWidth || rect.width || window.innerWidth || 1280;
            h = hero.offsetHeight || rect.height || window.innerHeight || 800;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            // inset:0 يمدّد الكانفس على صندوق الهيرو — لا حاجة لأبعاد CSS صريحة
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function seed() {
            // مركز الخريطة الفلكية ونظام حلقاتها المتحدة المركز
            cx = w * 0.5;
            cy = h * 0.46;
            const maxR = Math.hypot(w, h) * 0.44;
            rings = [0.34, 0.56, 0.78, 1.0].map((f) => maxR * f);
            particles = Array.from({ length: COUNT }, (_, i) => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * SPEED,
                vy: (Math.random() - 0.5) * SPEED,
                r: Math.random() * 1.4 + 0.5,
                rgb: i % 3 === 0 ? RGB_B : RGB_A,
                depth: Math.random() * 0.6 + 0.4,   // للبارالاكس
                mag: Math.random() * 0.4 + 0.35     // لمعان النجم
            }));
        }

        /* الخريطة الفلكية العتيقة (أسطرلاب): حلقات متحدة المركز + تقسيمات
           شعاعية + شرطات درجات ذهبية باهتة تدور ببطء، ونجوم مع خطوط أبراج.
           دمج: الشبكة الفلكية ذهبية كلاسيكية، النجوم/الروابط بلون البيانات. */
        function draw(animate) {
            ctx.clearRect(0, 0, w, h);

            if (animate && mouse.x !== null) {
                parallax.x += ((mouse.x - w / 2) * 0.02 - parallax.x) * 0.05;
                parallax.y += ((mouse.y - h / 2) * 0.02 - parallax.y) * 0.05;
            }
            if (animate) rot += 0.0008;   // دوران بطيء جداً كأسطرلاب

            // ── الشبكة الفلكية الذهبية (تدور) ──
            ctx.save();
            ctx.translate(cx + parallax.x * 0.3, cy + parallax.y * 0.3);
            ctx.rotate(rot);
            ctx.lineWidth = 1;
            for (let ri = 0; ri < rings.length; ri++) {
                ctx.strokeStyle = `rgba(${GOLD}, ${0.42 - ri * 0.06})`;
                ctx.beginPath(); ctx.arc(0, 0, rings[ri], 0, TAU); ctx.stroke();
            }
            // تقسيمات شعاعية كل 30° (كأقسام دائرة البروج)
            ctx.strokeStyle = `rgba(${GOLD}, 0.16)`;
            const inner = rings[0], outer = rings[rings.length - 1];
            for (let a = 0; a < 12; a++) {
                const ang = a * Math.PI / 6;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
                ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
                ctx.stroke();
            }
            // شرطات الدرجات على الحلقة الخارجية (كل 6°، أطول كل 30°)
            ctx.strokeStyle = `rgba(${GOLD}, 0.34)`;
            for (let a = 0; a < 60; a++) {
                const ang = a * Math.PI / 30;
                const t = (a % 5 === 0) ? 9 : 4;
                ctx.beginPath();
                ctx.moveTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
                ctx.lineTo(Math.cos(ang) * (outer - t), Math.sin(ang) * (outer - t));
                ctx.stroke();
            }
            ctx.restore();

            // ── خطوط الأبراج (شبكة البيانات كخريطة نجوم) ──
            for (let i = 0; i < particles.length; i++) {
                const a = particles[i];
                for (let j = i + 1; j < particles.length; j++) {
                    const b = particles[j];
                    const dist = Math.hypot(a.x - b.x, a.y - b.y);
                    if (dist < LINK_DIST) {
                        ctx.strokeStyle = `rgba(${a.rgb}, ${(1 - dist / LINK_DIST) * 0.10})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x + parallax.x * a.depth, a.y + parallax.y * a.depth);
                        ctx.lineTo(b.x + parallax.x * b.depth, b.y + parallax.y * b.depth);
                        ctx.stroke();
                    }
                }
            }
            // ── النجوم ──
            for (const p of particles) {
                if (animate) {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
                    if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
                }
                ctx.fillStyle = `rgba(${p.rgb}, ${p.mag})`;
                ctx.beginPath();
                ctx.arc(p.x + parallax.x * p.depth, p.y + parallax.y * p.depth, p.r, 0, TAU);
                ctx.fill();
            }
        }

        function loop() {
            draw(true);
            rafId = requestAnimationFrame(loop);
        }

        function start() {
            if (rafId === null && inView && !document.hidden && !prefersReduced) {
                rafId = requestAnimationFrame(loop);
            }
        }

        function stop() {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }

        resize();
        seed();
        // إطار أولي فوري: يظهر قبل أول rAF وفي التبويبات المخفية،
        // وهو أيضاً الوضع النهائي مع prefers-reduced-motion (ثابت)
        draw(false);

        if (!prefersReduced) {
            hero.addEventListener('pointermove', (e) => {
                const rect = hero.getBoundingClientRect();
                mouse.x = e.clientX - rect.left;
                mouse.y = e.clientY - rect.top;
            }, { passive: true });

            hero.addEventListener('pointerleave', () => {
                mouse.x = null;
                mouse.y = null;
            }, { passive: true });

            // إيقاف عند إخفاء التبويب
            document.addEventListener('visibilitychange', () => {
                document.hidden ? stop() : start();
            });

            // إيقاف عند خروج الهيرو من الشاشة
            new IntersectionObserver((entries) => {
                inView = entries[0].isIntersecting;
                inView ? start() : stop();
            }, { threshold: 0 }).observe(hero);

            let resizeTimer = null;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => { resize(); seed(); }, 200);
            }, { passive: true });

            start();
        }
    }

    // ============================================================
    // 2. كشف عنوان الهيرو
    //    العربي: كتلة واحدة (تقسيم الحروف يكسر التشكيل المتصل)
    //    الإنجليزي: كلمة-كلمة
    // ============================================================

    function initHeroTitleReveal() {
        if (prefersReduced) return;

        const nameAr = document.querySelector('.hero-title .name-ar');
        const nameEn = document.querySelector('.hero-title .name-en');

        // العربي: تقسيم على المسافات فقط (يحفظ تشكيل الحروف المتصلة داخل الكلمة)
        // كل كلمة ترتفع مع ضباب→حدّة + تجاوز نابض، والتدرّج يتنفّس بعد الدخول
        if (nameAr) splitIntoWords(nameAr, 'name-word', 0.0, 0.12);
        if (nameEn) splitIntoWords(nameEn, 'reveal-word', 0.5, 0.08);
    }

    /**
     * يقسّم نص عنصر إلى كلمات، كل كلمة في span بكلاس معطى.
     * التأخير يُمرَّر عبر متغيّر --rise-delay (لا animation-delay مباشرة)
     * حتى لا يتعارض مع أنيميشن "التنفّس" الذي له توقيته الخاص.
     */
    function splitIntoWords(el, className, baseDelay, step) {
        const words = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = className;
            span.textContent = word;
            span.style.setProperty('--rise-delay', `${(baseDelay + i * step).toFixed(2)}s`);
            el.appendChild(span);
            if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
    }

    // ============================================================
    // 3. توهج يتبع المؤشر داخل البطاقات
    //    (تفويض واحد على المستند — يعمل مع البطاقات المبنية لاحقاً)
    // ============================================================

    function initCardCursorGlow() {
        if (!finePointer || prefersReduced) return;

        // بطاقات المشروع/المقال تستخدم كسحة اللمعة بدل التوهّج المتتبّع
        const SELECTOR = '.skill-card, .contact-item, .stage-card';
        let pending = null;

        document.addEventListener('pointermove', (e) => {
            pending = e;
            requestAnimationFrame(() => {
                if (!pending) return;
                const card = pending.target.closest && pending.target.closest(SELECTOR);
                if (card) {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty('--glow-x', (pending.clientX - rect.left) + 'px');
                    card.style.setProperty('--glow-y', (pending.clientY - rect.top) + 'px');
                }
                pending = null;
            });
        }, { passive: true });
    }

    // ============================================================
    // 4. أزرار مغناطيسية — انجذاب خفيف نحو المؤشر
    // ============================================================

    function initMagneticButtons() {
        if (!finePointer || prefersReduced) return;

        const SELECTOR = '.btn, .filter-btn';
        const MAX_PULL = 5;       // أقصى إزاحة بالبكسل
        const STRENGTH = 0.18;
        let activeBtn = null;

        document.addEventListener('pointermove', (e) => {
            const btn = e.target.closest && e.target.closest(SELECTOR);

            if (btn !== activeBtn && activeBtn) {
                activeBtn.style.transform = '';
                activeBtn = null;
            }
            if (!btn) return;

            activeBtn = btn;
            const rect = btn.getBoundingClientRect();
            const dx = (e.clientX - rect.left - rect.width / 2) * STRENGTH;
            const dy = (e.clientY - rect.top - rect.height / 2) * STRENGTH;
            const px = Math.max(-MAX_PULL, Math.min(MAX_PULL, dx));
            const py = Math.max(-MAX_PULL, Math.min(MAX_PULL, dy));
            btn.style.transform = `translate(${px}px, ${py - 2}px)`;
        }, { passive: true });

        document.addEventListener('pointerout', (e) => {
            if (activeBtn && !e.relatedTarget?.closest?.(SELECTOR)) {
                activeBtn.style.transform = '';
                activeBtn = null;
            }
        }, { passive: true });
    }

    // ============================================================
    // 5. عناوين الأقسام: يُرسم الخط السفلي (scaleX من اليمين) عند الدخول،
    //    ثم تكتسحها لمعة. مع reduced-motion: الحالة النهائية فوراً.
    // ============================================================

    function initTitleObserver() {
        const titles = document.querySelectorAll('.section-title, .page-title');
        if (!titles.length) return;

        if (prefersReduced) {
            titles.forEach((t) => t.classList.add('title-drawn')); // خط مرسوم، بلا حركة
            return;
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                io.unobserve(entry.target);
                entry.target.classList.add('title-drawn');                 // الخط يُرسم
                setTimeout(() => entry.target.classList.add('title-shimmer'), 700); // ثم اللمعة
            });
        }, { threshold: 0.6 });

        titles.forEach((t) => io.observe(t));
    }

    // ============================================================
    // 5b. سرد بصري بالتمرير: توهّج كل قسم يظهر عند دخوله (فصول)
    // ============================================================

    function initSectionReveal() {
        const sections = document.querySelectorAll('.about, .skills, .contact, .page-header');
        if (!sections.length) return;

        if (prefersReduced) {
            sections.forEach((s) => s.classList.add('section-lit')); // مضاء فوراً، بلا تلاشٍ
            return;
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('section-lit');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.15 });

        sections.forEach((s) => io.observe(s));
    }

    // ============================================================
    // 5c. بطاقات المهارات: ميلان ثلاثي الأبعاد يتبع المؤشر (±6°)
    //     + تحرير تحويل الكشف بعد انتهائه ليعمل الـ hover
    // ============================================================

    function initSkillCardTilt() {
        const cards = document.querySelectorAll('.skill-card');
        if (!cards.length) return;

        // بعد انتهاء أنيميشن الاستقرار، حرّر التحويل لتفاعل الـ hover
        cards.forEach((card) => {
            card.addEventListener('animationend', (e) => {
                if (e.animationName === 'cardSettle') card.classList.add('card-ready');
            });
            // احتياط: لو لم يُطلَق animationend (اختُصر بالحركة المقلّلة)
            if (prefersReduced) card.classList.add('card-ready');
        });

        if (!finePointer || prefersReduced) return;

        const MAX = 6; // أقصى ميلان بالدرجات
        cards.forEach((card) => {
            let rect = null;
            card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); });
            card.addEventListener('pointermove', (e) => {
                if (!rect) rect = card.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5..0.5
                const py = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.setProperty('--tilt-x', `${(px * 2 * MAX).toFixed(2)}deg`);   // rotateY
                card.style.setProperty('--tilt-y', `${(-py * 2 * MAX).toFixed(2)}deg`);  // rotateX
            }, { passive: true });
            card.addEventListener('pointerleave', () => {
                rect = null;
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
            }, { passive: true });
        });
    }

    // ============================================================
    // 5d. موجة نقر لمسية على بطاقات المهارات (بديل الميلان)
    // ============================================================

    function initTouchRipple() {
        if (finePointer || prefersReduced) return; // للمس فقط، ويُلغى مع تقليل الحركة

        document.querySelectorAll('.skill-card').forEach((card) => {
            card.addEventListener('pointerdown', (e) => {
                const rect = card.getBoundingClientRect();
                const ripple = document.createElement('span');
                ripple.className = 'tap-ripple';
                ripple.setAttribute('aria-hidden', 'true');
                ripple.style.left = (e.clientX - rect.left) + 'px';
                ripple.style.top = (e.clientY - rect.top) + 'px';
                card.appendChild(ripple);
                ripple.addEventListener('animationend', () => ripple.remove());
            }, { passive: true });
        });
    }

    // ============================================================
    // 5e. خط سفلي منزلق بين روابط التنقّل (FLIP) — سطح المكتب فقط
    //     يستخدم translateX + scaleX (GPU فقط)، ويرتدّ للرابط النشط
    // ============================================================

    function initNavUnderline() {
        const navLinks = document.getElementById('navLinks');
        if (!navLinks) return;

        // جوال حقيقي فقط — عرض 0 يعني بيئة غير جاهزة (لا نحكم عليها "جوال")
        const mobileNow = () => window.innerWidth > 0 && window.innerWidth <= 768;
        if (mobileNow()) return; // القائمة الجوال overlay عمودي

        const links = Array.from(navLinks.querySelectorAll('.nav-link'));
        if (!links.length) return;

        const underline = document.createElement('span');
        underline.className = 'nav-underline';
        underline.setAttribute('aria-hidden', 'true');
        navLinks.appendChild(underline);
        navLinks.classList.add('slider-ready');

        const BASE = 100; // يطابق width في CSS
        function moveTo(link) {
            const navRect = navLinks.getBoundingClientRect();
            const r = link && link.getBoundingClientRect();
            // إخفاء إن كان جوالاً أو التخطيط غير جاهز بعد (عرض 0)
            if (!link || mobileNow() || !r.width) { underline.style.opacity = '0'; return; }
            underline.style.opacity = '1';
            underline.style.transform =
                `translateX(${(r.left - navRect.left).toFixed(1)}px) scaleX(${(r.width / BASE).toFixed(3)})`;
        }
        const activeLink = () => navLinks.querySelector('.nav-link.active') || links[0];
        const place = () => moveTo(activeLink());

        requestAnimationFrame(place);
        window.addEventListener('load', place);           // بعد جهوزية التخطيط
        links.forEach((link) => link.addEventListener('pointerenter', () => moveTo(link)));
        navLinks.addEventListener('pointerleave', place);
        window.addEventListener('resize', place, { passive: true }); // 0→حقيقي يعيد الوضع
    }

    // ============================================================
    // 5f. صور غلاف صفحات التفاصيل: كشف من تكبير خفيف → استقرار.
    //     أساسها opacity:0 في CSS، فنضيف .cover-in عند التحميل
    //     (مهم: بدونها تبقى الصورة مخفية).
    // ============================================================

    function initDetailCover() {
        const cover = document.getElementById('project-cover') || document.getElementById('article-cover');
        if (!cover) return;

        const reveal = () => cover.classList.add('cover-in');

        // لو حُمِّلت الصورة مسبقاً (كاش) أو أخفقت، لا نُبقيها شفافة للأبد
        if (cover.complete && cover.naturalWidth > 0) reveal();
        cover.addEventListener('load', reveal);
        cover.addEventListener('error', reveal);
    }

    // ============================================================
    // 6. شريط تقدّم القراءة — صفحات المقال والمشروع فقط
    // ============================================================

    function initReadingProgress() {
        if (!document.getElementById('article-body') && !document.getElementById('project-body')) return;

        const bar = document.createElement('div');
        bar.className = 'reading-progress';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML =
            '<div class="reading-progress-fill"></div>' +
            '<div class="reading-progress-head"></div>';
        document.body.appendChild(bar);

        const fill = bar.querySelector('.reading-progress-fill');
        const head = bar.querySelector('.reading-progress-head');
        let ticking = false;

        function update() {
            ticking = false;
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
            fill.style.transform = `scaleX(${progress})`;
            // الرأس المتوهّج عند الحافة الأمامية (RTL: يتحرّك من اليمين لليسار)
            const barWidth = window.innerWidth;
            head.style.transform = `translateX(${((1 - progress) * barWidth).toFixed(1)}px)`;
            head.style.opacity = progress > 0.01 && progress < 0.999 ? '1' : '0';
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });

        window.addEventListener('resize', update, { passive: true });
        update();
    }

})();

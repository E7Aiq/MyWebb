/**
 * Generative Layer — "Living Data" (فن توليدي × سويسري)
 * محرّك مشترك واحد لكل العناصر التوليدية عبر الصفحات الخمس.
 * طبقة جمالية بحتة: لا تلمس منطق البيانات إطلاقاً. vanilla — بدون مكتبات.
 *
 * البوابات (نفس عقد effects.js):
 *  - prefers-reduced-motion → إطار ثابت واحد، لا حلقة ولا مستمعين
 *  - ≤768px                 → لا كانفس إطلاقاً (أداء الجوال)
 *  - IntersectionObserver   → يتوقّف خارج الشاشة
 *  - visibilitychange       → يتوقّف عند إخفاء التبويب
 *  - حلقة rAF واحدة مشتركة لكل المشاهد (لا حلقات متعدّدة)
 */

(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    // عرض 0 = بيئة غير جاهزة (prerender) — لا نحكم عليها "جوال"
    const isMobile = window.matchMedia('(max-width: 768px)').matches
        && window.innerWidth > 0 && window.innerWidth <= 768;

    if (isMobile) return; // بطاقات الكانفس تُخفى بالـ CSS ≤768px

    // ─── قراءة ألوان النظام من :root (ممنوع hex ثابت) ───
    let GOLD = '200,164,92', VERM = '226,71,46', BLUE = '59,130,246', GREEN = '16,185,129';

    // ─── حالة المحرّك المشتركة ───
    const scenes = [];
    let rafId = null;
    let lastNow = 0;
    const pointer = { x: null, y: null };

    // ============================================================
    // المحرّك: حلقة rAF واحدة + بوابات الرؤية
    // ============================================================

    function schedule() {
        if (rafId === null && !document.hidden && !prefersReduced
            && scenes.some((s) => s.inView)) {
            lastNow = performance.now();
            rafId = requestAnimationFrame(tick);
        }
    }

    function stopLoop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function tick(now) {
        rafId = null;
        const dt = Math.min(now - lastNow, 50) / 1000; // سقف dt: لا قفزات بعد سكون
        lastNow = now;
        for (const s of scenes) {
            if (!s.inView) continue;
            // تعافٍ ذاتي: تخطيط كان عرضه 0 عند التركيب (تبويب/لوح غير جاهز)
            if (!s.w || !s.h) resizeScene(s);
            s.time += dt;
            drawScene(s, true);
        }
        schedule();
    }

    function drawScene(s, animate) {
        if (!s.w || !s.h) return;
        let mouse = null;
        if (animate && s.hover && finePointer && pointer.x !== null) {
            const rect = s.canvas.getBoundingClientRect();
            const mx = pointer.x - rect.left;
            const my = pointer.y - rect.top;
            if (mx > -60 && my > -60 && mx < rect.width + 60 && my < rect.height + 60) {
                mouse = { x: mx, y: my };
            }
        }
        s.ctx.clearRect(0, 0, s.w, s.h);
        s.draw(s.ctx, s.w, s.h, s.time, mouse);
    }

    function resizeScene(s) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const host = s.sizeFrom;
        const rect = host.getBoundingClientRect();
        s.w = host.offsetWidth || rect.width || 0;
        s.h = host.offsetHeight || rect.height || 0;
        if (!s.w || !s.h) return;
        s.canvas.width = s.w * dpr;
        s.canvas.height = s.h * dpr;
        s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (s.init) s.init(s.w, s.h);
    }

    /**
     * يركّب مشهداً على مضيف: يُنشئ كانفس زخرفياً position:absolute داخله.
     * factory(scene) يملأ scene.draw و scene.init (اختياري).
     */
    function mount(host, factory, opts) {
        const canvas = document.createElement('canvas');
        canvas.className = 'gen-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.classList.add('gen-host');
        host.insertBefore(canvas, host.firstChild);
        return register(canvas, host, factory, opts);
    }

    function register(canvas, sizeFrom, factory, opts) {
        const s = {
            canvas,
            sizeFrom,
            ctx: canvas.getContext('2d'),
            w: 0, h: 0,
            time: 0,
            inView: false,
            hover: !!(opts && opts.hover),
            draw: null,
            init: null
        };
        factory(s);
        scenes.push(s);
        resizeScene(s);
        drawScene(s, false); // إطار أولي فوري — وهو النهائي مع reduced-motion

        io.observe(canvas);
        return s;
    }

    // مراقب واحد لكل المشاهد
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const s = scenes.find((x) => x.canvas === entry.target);
            if (!s) continue;
            s.inView = entry.isIntersecting;
            // مع reduced-motion لا حلقة — لكن المقاس قد يصبح متاحاً الآن
            if (s.inView && (!s.w || !s.h)) {
                resizeScene(s);
                drawScene(s, false);
            }
        }
        schedule();
    }, { threshold: 0 });

    // ============================================================
    // ضوضاء رخيصة (مجموع جيوب) — كافية لخطوط عضوية هادئة
    // ============================================================

    function noise(x, seed) {
        return Math.sin(x * 1.7 + seed) * 0.6
             + Math.sin(x * 3.1 + seed * 1.7) * 0.3
             + Math.sin(x * 5.3 + seed * 0.31) * 0.1;
    }

    // ============================================================
    // المشهد 1: أفق البيانات — شريط الفوتر (كل الصفحات)
    // خطوط أفقية متموّجة تتطوّر ببطء + نقطة مسح قرمزية تعبر RTL
    // ============================================================

    function horizonScene(s) {
        s.draw = (ctx, w, h, t) => {
            ctx.lineWidth = 1;
            for (let li = 0; li < 3; li++) {
                const base = h * (0.38 + li * 0.17);
                const amp = h * 0.13;
                ctx.strokeStyle = `rgba(${GOLD}, ${0.20 - li * 0.055})`;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 6) {
                    const y = base + noise(x * 0.008 + li * 7, t * 0.12 + li * 2.3) * amp;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            // شرطات مسطرة على القاعدة (زخرفة سويسرية)
            ctx.strokeStyle = `rgba(${GOLD}, 0.14)`;
            ctx.beginPath();
            for (let x = 24; x < w; x += 48) {
                ctx.moveTo(x, h - 6);
                ctx.lineTo(x, h - 2);
            }
            ctx.stroke();
            // نقطة المسح القرمزية — تعبر من اليمين لليسار (RTL)
            const frac = (t / 16) % 1;
            const dx = w * (1 - frac);
            const dy = h * 0.38 + noise(dx * 0.008, t * 0.12) * h * 0.13;
            ctx.fillStyle = `rgba(${VERM}, 0.85)`;
            ctx.beginPath();
            ctx.arc(dx, dy, 2, 0, Math.PI * 2);
            ctx.fill();
        };
    }

    // ============================================================
    // المشهد 2: حزمة خطوط انسيابية (streamlines)
    // "عني" في الرئيسية (باهت جداً) + إيقاع أسطر المخطوطة لرأس المقالات
    // ============================================================

    function flowScene(opts) {
        return (s) => {
            const count = opts.count;
            s.draw = (ctx, w, h, t) => {
                ctx.lineWidth = 1;
                for (let i = 0; i < count; i++) {
                    const fr = count === 1 ? 0.5 : i / (count - 1);
                    const base = h * (opts.band[0] + (opts.band[1] - opts.band[0]) * fr);
                    const amp = opts.amp + (i % 3) * 2;
                    const verm = i === opts.vermIndex;
                    ctx.strokeStyle = verm
                        ? `rgba(${VERM}, ${opts.alpha + 0.06})`
                        : `rgba(${GOLD}, ${opts.alpha})`;
                    ctx.beginPath();
                    for (let x = 0; x <= w; x += 8) {
                        const y = base
                            + noise(x * 0.006 + i * 13, t * (0.10 + i * 0.013)) * amp
                            + Math.sin(x * 0.002 + i) * amp * 0.5;
                        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            };
        };
    }

    // ============================================================
    // المشهد 3: عنقود نقاط بيانات منجرفة (قسم التواصل)
    // نقاط تسبح ببطء + روابط قصيرة، وتستجيب لقرب المؤشر
    // ============================================================

    function driftScene(s) {
        let pts = [];
        s.init = (w, h) => {
            pts = Array.from({ length: 26 }, (_, i) => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.12,
                vy: (Math.random() - 0.5) * 0.12,
                r: Math.random() * 1.3 + 0.7,
                rgb: i % 9 === 0 ? VERM : (i % 2 ? BLUE : GREEN),
                a: Math.random() * 0.25 + 0.18
            }));
        };
        s.draw = (ctx, w, h, t, mouse) => {
            ctx.lineWidth = 1;
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
                for (let j = i + 1; j < pts.length; j++) {
                    const q = pts[j];
                    const d = Math.hypot(p.x - q.x, p.y - q.y);
                    if (d < 90) {
                        ctx.strokeStyle = `rgba(${p.rgb}, ${(1 - d / 90) * 0.07})`;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }
                let alpha = p.a;
                // استجابة لطيفة لقرب المؤشر: النقاط القريبة تضيء وتتصل به
                if (mouse) {
                    const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                    if (dm < 150) {
                        alpha = Math.min(0.8, p.a + (1 - dm / 150) * 0.45);
                        ctx.strokeStyle = `rgba(${GOLD}, ${(1 - dm / 150) * 0.16})`;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
                ctx.fillStyle = `rgba(${p.rgb}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        };
    }

    // ============================================================
    // المشهد 4: حقل انتثار (scatter) — رأس صفحة المشاريع
    // نقاط مبعثرة تتلألأ + محاور شعرية يمنى/سفلى (RTL) + خط اتجاه قرمزي
    // ============================================================

    function scatterScene(s) {
        let pts = [];
        s.init = (w, h) => {
            pts = Array.from({ length: 42 }, () => ({
                x: w * (0.06 + Math.random() * 0.88),
                y: h * (0.10 + Math.random() * 0.75),
                r: Math.random() * 1.6 + 0.8,
                ph: Math.random() * Math.PI * 2,
                rgb: Math.random() < 0.5 ? BLUE : GREEN
            }));
        };
        s.draw = (ctx, w, h, t, mouse) => {
            ctx.lineWidth = 1;
            // المحوران (RTL: المحور الرأسي على اليمين)
            ctx.strokeStyle = `rgba(${GOLD}, 0.18)`;
            ctx.beginPath();
            ctx.moveTo(w - 24, h * 0.06); ctx.lineTo(w - 24, h - 18);
            ctx.moveTo(16, h - 18); ctx.lineTo(w - 24, h - 18);
            ctx.stroke();
            ctx.beginPath();
            for (let x = w - 72; x > 24; x -= 48) { ctx.moveTo(x, h - 18); ctx.lineTo(x, h - 13); }
            for (let y = h - 66; y > 12; y -= 48) { ctx.moveTo(w - 24, y); ctx.lineTo(w - 29, y); }
            ctx.stroke();
            // خط اتجاه قرمزي يتنفّس ميله ببطء (يهبط نحو اليسار = RTL)
            ctx.strokeStyle = `rgba(${VERM}, 0.22)`;
            ctx.setLineDash([5, 7]);
            ctx.beginPath();
            ctx.moveTo(w * 0.92, h * (0.68 + Math.sin(t * 0.05) * 0.05));
            ctx.lineTo(w * 0.08, h * (0.28 + Math.sin(t * 0.07 + 2) * 0.06));
            ctx.stroke();
            ctx.setLineDash([]);
            // النقاط
            for (const p of pts) {
                let a = 0.22 + 0.20 * (0.5 + 0.5 * Math.sin(t * 0.6 + p.ph));
                let r = p.r;
                if (mouse) {
                    const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                    if (dm < 120) {
                        a = Math.min(0.85, a + (1 - dm / 120) * 0.5);
                        r = p.r * (1 + (1 - dm / 120) * 0.7);
                    }
                }
                ctx.fillStyle = `rgba(${p.rgb}, ${a})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        };
    }

    // ============================================================
    // المشهد 6: أثر القراءة — هامش صفحات التفاصيل
    // خط زلزالي رأسي ينمو مع تقدّم القراءة + رأس قرمزي
    // ============================================================

    function seismoScene(s) {
        s.draw = (ctx, w, h, t) => {
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
            const mid = w * 0.5;
            // دليل رأسي شعري + شرطات مسطرة
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${GOLD}, 0.13)`;
            ctx.beginPath();
            ctx.moveTo(mid, 0); ctx.lineTo(mid, h);
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i <= 12; i++) {
                const y = (h / 12) * i;
                ctx.moveTo(mid - 3, y); ctx.lineTo(mid + 3, y);
            }
            ctx.stroke();
            // الأثر: يُرسم من الأعلى حتى موضع التقدّم، سعته تتسع مع العمق
            const yEnd = h * p;
            if (yEnd > 2) {
                ctx.strokeStyle = `rgba(${GOLD}, 0.42)`;
                ctx.beginPath();
                let lx = mid, ly = 0;
                for (let y = 0; y <= yEnd; y += 4) {
                    const grow = 0.35 + 0.65 * (y / h);
                    const x = mid + noise(y * 0.02, t * 0.05) * w * 0.34 * grow;
                    y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    lx = x; ly = y;
                }
                ctx.stroke();
                // الرأس القرمزي
                ctx.fillStyle = `rgba(${VERM}, 0.9)`;
                ctx.beginPath();
                ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        };
    }

    // ============================================================
    // التركيب حسب الصفحة (كشف بالـ DOM — لا إعدادات في HTML)
    // ============================================================

    document.addEventListener('DOMContentLoaded', () => {
        // ألوان النظام من :root
        const rs = getComputedStyle(document.documentElement);
        GOLD = (rs.getPropertyValue('--accent-gold-rgb') || GOLD).trim();
        VERM = (rs.getPropertyValue('--editorial-vermilion-rgb') || VERM).trim();
        BLUE = (rs.getPropertyValue('--accent-primary-rgb') || BLUE).trim();
        GREEN = (rs.getPropertyValue('--accent-secondary-rgb') || GREEN).trim();

        // الفوتر: أفق بيانات (كل الصفحات)
        const footer = document.querySelector('.footer');
        if (footer) mount(footer, horizonScene);

        // الرئيسية: انسياب باهت خلف "عني" + عنقود منجرف في "تواصل"
        const about = document.querySelector('.about');
        if (about) mount(about, flowScene({ count: 7, band: [0.15, 0.85], amp: 6, alpha: 0.05, vermIndex: -1 }));
        const contact = document.querySelector('.contact');
        if (contact) mount(contact, driftScene, { hover: true });

        // رؤوس صفحات القوائم: انتثار للمشاريع / إيقاع أسطر للمقالات
        const header = document.querySelector('.page-header');
        if (header && document.getElementById('projectsGrid')) {
            mount(header, scatterScene, { hover: true });
        } else if (header && document.getElementById('articles-grid')) {
            mount(header, flowScene({ count: 9, band: [0.2, 0.9], amp: 4, alpha: 0.11, vermIndex: 4 }));
        }

        // صفحات التفاصيل: أثر القراءة في الهامش (يُخفى بالـ CSS < 1380px)
        if (document.getElementById('article-body') || document.getElementById('project-body')) {
            const rail = document.createElement('div');
            rail.className = 'gen-margin';
            rail.setAttribute('aria-hidden', 'true');
            const cv = document.createElement('canvas');
            rail.appendChild(cv);
            document.body.appendChild(rail);
            register(cv, rail, seismoScene);
        }

        // إعادة القياس تلزم حتى مع reduced-motion (الإطار الثابت بمقاس صحيح)
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                scenes.forEach((s) => { resizeScene(s); drawScene(s, false); });
            }, 200);
        }, { passive: true });

        // ─── مستمعو الحركة: لا شيء منهم مع reduced-motion ───
        if (prefersReduced) return;

        document.addEventListener('visibilitychange', () => {
            document.hidden ? stopLoop() : schedule();
        });

        if (finePointer) {
            document.addEventListener('pointermove', (e) => {
                pointer.x = e.clientX;
                pointer.y = e.clientY;
            }, { passive: true });
        }

        schedule();
    });

})();

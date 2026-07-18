/**
 * /work-with-me — محرك الفن التوليدي + كشف التمرير
 * مستقل تماماً عن الموقع الأم. vanilla، بلا مكتبات.
 *
 * البوابات:
 *  - prefers-reduced-motion → إطار ساكن واحد لكل كانفس، لا حركة إطلاقاً
 *  - ≤768px               → إطار ساكن (يبقى الفن، تسقط الحركة — أداء)
 *  - rAF واحد مشترك، يتوقف خارج الشاشة (IO) وعند إخفاء التبويب
 */

(function () {
    'use strict';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const mobileNow = () =>
        window.matchMedia('(max-width: 768px)').matches &&
        window.innerWidth > 0 && window.innerWidth <= 768;

    // ألوان الصفحة من رموز :root (لا hex هنا)
    const rootStyles = getComputedStyle(document.documentElement);
    const INK = (rootStyles.getPropertyValue('--ink-rgb') || '26,23,18').trim();
    const VERM = (rootStyles.getPropertyValue('--verm-rgb') || '214,59,31').trim();

    const TAU = Math.PI * 2;

    /* ضوضاء رخيصة مستقرة (مجاميع جيوب) — تكفي لخطوط حية هادئة */
    function noise(x, s) {
        return Math.sin(x * 1.7 + s) * 0.6 +
               Math.sin(x * 3.3 + s * 1.9) * 0.3 +
               Math.sin(x * 6.1 + s * 0.4) * 0.1;
    }
    function rand(seed) {
        // مولّد حتمي صغير — نفس البذرة = نفس اللوحة (إطار ساكن متّسق)
        let s = seed;
        return () => {
            s = (s * 16807 + 19487171) % 2147483647;
            return (s & 0xffff) / 0xffff;
        };
    }

    // ============================================================
    // المحرك: حلقة rAF واحدة لكل المشاهد + بوابات الرؤية
    // ============================================================

    const scenes = [];
    let rafId = null;
    let mouse = { x: null, y: null };

    function schedule() {
        if (rafId === null && !document.hidden && scenes.some((s) => s.active)) {
            rafId = requestAnimationFrame(tick);
        }
    }
    function tick(now) {
        rafId = null;
        for (const s of scenes) {
            if (!s.active) continue;
            const dt = Math.min(now - (s.last || now), 50) / 1000;
            s.last = now;
            s.t += dt;
            s.ctx.clearRect(0, 0, s.w, s.h);
            s.draw(s.ctx, s.w, s.h, s.t, s);
        }
        schedule();
    }

    function sizeCanvas(s) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = s.canvas.getBoundingClientRect();
        s.w = s.canvas.clientWidth || rect.width || 300;
        s.h = s.canvas.clientHeight || rect.height || 150;
        s.canvas.width = s.w * dpr;
        s.canvas.height = s.h * dpr;
        s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function mount(canvas, factory) {
        if (!canvas) return;
        const s = {
            canvas,
            ctx: canvas.getContext('2d'),
            t: 0, last: 0, w: 0, h: 0,
            active: false,
            inView: true,
            draw: null, init: null,
        };
        factory(s);
        sizeCanvas(s);
        if (s.init) s.init();
        // الإطار الأول دائماً (وهو الوضع النهائي للحركة المقلّلة/الجوال)
        s.ctx.clearRect(0, 0, s.w, s.h);
        s.draw(s.ctx, s.w, s.h, 0, s);

        if (reduced || mobileNow()) return; // ساكن — لا تسجيل في الحلقة

        scenes.push(s);
        new IntersectionObserver((entries) => {
            s.inView = entries[0].isIntersecting;
            s.active = s.inView;
            if (s.active) s.last = 0;
            schedule();
        }, { threshold: 0 }).observe(canvas);
    }

    // ============================================================
    // مشهد البطل: ضجيج يتّجه (RTL) نحو بنية — نقاط تنجرف يساراً
    // فتتشابك داخل عنقود، مع خيوط انسياب شعرية وخيط قرمزي
    // ============================================================

    function heroScene(s) {
        const N = 108;
        let pts = [];
        s.init = () => {
            const r = rand(7);
            pts = Array.from({ length: N }, (_, i) => ({
                x: r() * s.w,
                y: r() * s.h,
                vx: -(0.12 + r() * 0.2),          // انجراف يميني→يساري (اتجاه القراءة)
                vy: (r() - 0.5) * 0.06,
                r: 0.8 + r() * 1.5,
                verm: i % 8 === 0,                 // خيط قرمزي مبثوث
                tw: r() * TAU,
            }));
        };
        s.draw = (ctx, w, h, t) => {
            const cx = w * 0.30, cy = h * 0.55;
            const cr = Math.min(w, h) * 0.34;      // نطاق العنقود (يسار الوسط)

            // خيوط انسياب شعرية خلفية
            for (let i = 0; i < 4; i++) {
                ctx.strokeStyle = i === 3
                    ? `rgba(${VERM}, 0.10)`
                    : `rgba(${INK}, 0.055)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                const yb = h * (0.3 + i * 0.16);
                for (let x = 0; x <= w; x += 10) {
                    const y = yb + noise(x * 0.0035 + i * 9, t * 0.06 + i) * h * 0.05;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // تحديث النقاط: تبطؤ داخل العنقود (الضجيج يستقرّ بنية)
            for (const p of pts) {
                const dC = Math.hypot(p.x - cx, p.y - cy);
                const inC = dC < cr;
                p.x += p.vx * (inC ? 0.35 : 1) * (s.active ? 1 : 0);
                p.y += p.vy + Math.sin(t * 0.4 + p.tw) * 0.03;
                if (p.x < -12) { p.x = w + 12; p.y = Math.random() * h; }
                if (p.y < -12) p.y = h + 12;
                if (p.y > h + 12) p.y = -12;
            }

            // الوصلات داخل العنقود فقط — البنية تظهر حيث يستقر الضجيج
            for (let i = 0; i < N; i++) {
                const a = pts[i];
                if (Math.hypot(a.x - cx, a.y - cy) > cr) continue;
                for (let j = i + 1; j < N; j++) {
                    const b = pts[j];
                    if (Math.hypot(b.x - cx, b.y - cy) > cr) continue;
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 74) {
                        const link = a.verm && b.verm;
                        ctx.strokeStyle = link
                            ? `rgba(${VERM}, ${(1 - d / 74) * 0.35})`
                            : `rgba(${INK}, ${(1 - d / 74) * 0.13})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            // النقاط + استجابة لطيفة لقرب المؤشر
            for (const p of pts) {
                let al = p.verm ? 0.55 : 0.4;
                let rr = p.r;
                if (mouse.x !== null) {
                    const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                    if (dm < 130) { al += (1 - dm / 130) * 0.35; rr += (1 - dm / 130) * 0.8; }
                }
                ctx.fillStyle = p.verm ? `rgba(${VERM}, ${al})` : `rgba(${INK}, ${al})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, rr, 0, TAU);
                ctx.fill();
            }

            // حلقة بوصلة شعرية حول العنقود — "هنا يُرى النمط"
            ctx.strokeStyle = `rgba(${INK}, 0.10)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = `rgba(${VERM}, 0.35)`;
            const a0 = t * 0.1;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, a0, a0 + 0.5);
            ctx.stroke();
        };
    }

    // ============================================================
    // لمسات الخدمات — أربعة أنماط صغيرة هادئة
    // ============================================================

    /* ٠١ صوت العملاء: صفوف آراء كنقاط، يتكرّر فيها نمط قرمزي */
    function voiceScene(s) {
        s.draw = (ctx, w, h, t) => {
            const cols = 13, rows = 6;
            const gx = w / (cols + 1), gy = h / (rows + 1);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = w - (c + 1) * gx;           // RTL: يبدأ يميناً
                    const y = (r + 1) * gy;
                    const vm = (r * cols + c) % 17 === 3; // النمط المتكرّر
                    const base = vm ? 0.5 : 0.18;
                    const al = base + noise(c * 0.7 + r * 1.3, t * 0.25) * 0.12;
                    ctx.fillStyle = vm
                        ? `rgba(${VERM}, ${Math.max(0.25, al)})`
                        : `rgba(${INK}, ${Math.max(0.08, al)})`;
                    ctx.beginPath();
                    ctx.arc(x, y, vm ? 2.4 : 1.7, 0, TAU);
                    ctx.fill();
                }
            }
        };
    }

    /* ٠٢ المنافسون: منحنيان يفترقان — والفجوة مُعلَّمة بالقرمزي */
    function rivalsScene(s) {
        s.draw = (ctx, w, h, t) => {
            const y1 = (x) => h * 0.42 + noise(x * 0.008, t * 0.08) * h * 0.06;
            const gap = (x) => h * 0.16 * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(x * 0.012 - t * 0.12 + 1)));
            let mx = 0, mg = -1;
            ctx.lineWidth = 1;
            for (const which of [0, 1]) {
                ctx.strokeStyle = `rgba(${INK}, ${which ? 0.3 : 0.42})`;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 6) {
                    const y = which ? y1(x) + gap(x) : y1(x);
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    if (which && gap(x) > mg) { mg = gap(x); mx = x; }
                }
                ctx.stroke();
            }
            // الفجوة الأوسع — فرصتك
            ctx.strokeStyle = `rgba(${VERM}, 0.75)`;
            ctx.beginPath();
            ctx.moveTo(mx, y1(mx));
            ctx.lineTo(mx, y1(mx) + mg);
            ctx.stroke();
            for (const yy of [y1(mx), y1(mx) + mg]) {
                ctx.fillStyle = `rgba(${VERM}, 0.85)`;
                ctx.beginPath();
                ctx.arc(mx, yy, 2.2, 0, TAU);
                ctx.fill();
            }
        };
    }

    /* ٠٣ الحضور الرقمي: شبكة تُبنى بخلايا تكتمل — وخلية هوية قرمزية */
    function presenceScene(s) {
        s.draw = (ctx, w, h, t) => {
            const cols = 9, rows = 5;
            const cw = w / cols, ch = h / rows;
            ctx.strokeStyle = `rgba(${INK}, 0.12)`;
            ctx.lineWidth = 1;
            for (let c = 0; c <= cols; c++) {
                ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke();
            }
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke();
            }
            const phase = Math.floor(t / 3.2);          // تشكيلة تتبدّل بهدوء كل ~3s
            const rr = rand(41 + phase);
            for (let i = 0; i < 11; i++) {
                const c = Math.floor(rr() * cols), r2 = Math.floor(rr() * rows);
                ctx.fillStyle = `rgba(${INK}, 0.07)`;
                ctx.fillRect(w - (c + 1) * cw, r2 * ch, cw, ch); // RTL: يُبنى من اليمين
            }
            // خلية الهوية
            const pulse = 0.2 + 0.12 * Math.sin(t * 0.8);
            ctx.fillStyle = `rgba(${VERM}, ${pulse})`;
            ctx.fillRect(w - 3 * cw, 2 * ch, cw, ch);
            ctx.strokeStyle = `rgba(${VERM}, 0.6)`;
            ctx.strokeRect(w - 3 * cw, 2 * ch, cw, ch);
        };
    }

    /* ٠٤ الحلول المخصّصة: شجرة تتفرّع من جذر يميني، ونبضة تعبر مساراً */
    function customScene(s) {
        let nodes = [], links = [], paths = [];
        s.init = () => {
            const r = rand(23);
            nodes = [{ x: s.w - 16, y: s.h / 2 }];
            links = []; paths = [];
            let prev = [0];
            for (let depth = 1; depth <= 3; depth++) {
                const next = [];
                for (const pi of prev) {
                    const kids = depth === 3 ? 2 : 2;
                    for (let k = 0; k < kids; k++) {
                        const n = {
                            x: s.w - 16 - depth * (s.w - 40) / 3,
                            y: nodes[pi].y + (r() - 0.5) * s.h * (0.9 / depth),
                        };
                        n.y = Math.max(12, Math.min(s.h - 12, n.y));
                        nodes.push(n);
                        const ni = nodes.length - 1;
                        links.push([pi, ni]);
                        next.push(ni);
                    }
                }
                prev = next;
            }
            // مسارات جذر→ورقة للنبضات
            for (const leaf of prev) {
                const path = [leaf];
                let cur = leaf;
                while (cur !== 0) {
                    const l = links.find((lk) => lk[1] === cur);
                    cur = l[0];
                    path.push(cur);
                }
                paths.push(path.reverse());
            }
        };
        s.draw = (ctx, w, h, t) => {
            ctx.strokeStyle = `rgba(${INK}, 0.3)`;
            ctx.lineWidth = 1;
            for (const [a, b] of links) {
                ctx.beginPath();
                ctx.moveTo(nodes[a].x, nodes[a].y);
                ctx.lineTo(nodes[b].x, nodes[b].y);
                ctx.stroke();
            }
            for (let i = 0; i < nodes.length; i++) {
                ctx.fillStyle = i === 0 ? `rgba(${VERM}, 0.9)` : `rgba(${INK}, 0.5)`;
                ctx.beginPath();
                ctx.arc(nodes[i].x, nodes[i].y, i === 0 ? 3 : 1.8, 0, TAU);
                ctx.fill();
            }
            // نبضة تعبر من الجذر إلى ورقة (تتبدّل الورقة كل دورة)
            const cycle = 2.6;
            const pi2 = Math.floor(t / cycle) % paths.length;
            const u = (t % cycle) / cycle;
            const path = paths[pi2];
            const segF = u * (path.length - 1);
            const si = Math.min(Math.floor(segF), path.length - 2);
            const su = segF - si;
            const a = nodes[path[si]], b = nodes[path[si + 1]];
            ctx.fillStyle = `rgba(${VERM}, ${0.9 * Math.sin(Math.PI * u)})`;
            ctx.beginPath();
            ctx.arc(a.x + (b.x - a.x) * su, a.y + (b.y - a.y) * su, 2.4, 0, TAU);
            ctx.fill();
        };
    }

    // ============================================================
    // الخاتمة: أفق بياني — طبقات خطوط ضوضاء تتطوّر ونقطة قرمزية تعبر
    // ============================================================

    function footScene(s) {
        s.draw = (ctx, w, h, t) => {
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(${INK}, ${0.16 - i * 0.045})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                const yb = h * (0.38 + i * 0.18);
                for (let x = 0; x <= w; x += 8) {
                    const y = yb + noise(x * 0.006 + i * 13, t * 0.05 + i * 2) * h * 0.13;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            // شرطات مسطرة سفلية
            ctx.strokeStyle = `rgba(${INK}, 0.18)`;
            for (let x = 24; x < w; x += 56) {
                ctx.beginPath();
                ctx.moveTo(x, h - 8);
                ctx.lineTo(x, h - 4);
                ctx.stroke();
            }
            // العابر القرمزي (RTL: يمين → يسار)
            const u = (t / 16) % 1;
            const xd = w * (1 - u);
            const yd = h * 0.38 + noise(xd * 0.006, t * 0.05) * h * 0.13;
            ctx.fillStyle = `rgba(${VERM}, 0.85)`;
            ctx.beginPath();
            ctx.arc(xd, yd, 2.6, 0, TAU);
            ctx.fill();
        };
    }

    // ============================================================
    // كشف التمرير + التركيب
    // ============================================================

    function initReveal() {
        const els = Array.from(document.querySelectorAll('.rv'));
        if (reduced) { els.forEach((el) => el.classList.add('in')); return; }

        // ما هو داخل الشاشة عند التحميل يُكشف فوراً (بمهلة قصيرة كي يُرسم
        // الوضع المخفي أولاً فيعمل الانتقال) — لا اعتماد على IO فوق الطيّة
        const vh = window.innerHeight || 800;
        const above = els.filter((el) => el.getBoundingClientRect().top < vh * 0.92);
        const below = els.filter((el) => !above.includes(el));
        setTimeout(() => above.forEach((el) => el.classList.add('in')), 60);

        if (!below.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                io.unobserve(e.target);
            });
        }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
        below.forEach((el) => io.observe(el));
    }

    document.addEventListener('DOMContentLoaded', () => {
        initReveal();

        const factories = {
            hero: heroScene,
            voice: voiceScene,
            rivals: rivalsScene,
            presence: presenceScene,
            custom: customScene,
            foot: footScene,
        };
        document.querySelectorAll('canvas[data-scene]').forEach((c) => {
            const f = factories[c.dataset.scene];
            if (f) mount(c, f);
        });

        if (!reduced && !mobileNow()) {
            // مؤشر البطل (زخرفي — استجابة لطيفة فقط)
            const heroCanvas = document.querySelector('.hero-canvas');
            if (heroCanvas && finePointer) {
                const hero = heroCanvas.closest('.hero');
                hero.addEventListener('pointermove', (e) => {
                    const r = heroCanvas.getBoundingClientRect();
                    mouse.x = e.clientX - r.left;
                    mouse.y = e.clientY - r.top;
                }, { passive: true });
                hero.addEventListener('pointerleave', () => {
                    mouse.x = null; mouse.y = null;
                }, { passive: true });
            }

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
                } else {
                    scenes.forEach((s) => { s.last = 0; });
                    schedule();
                }
            });

            let rt = null;
            window.addEventListener('resize', () => {
                clearTimeout(rt);
                rt = setTimeout(() => {
                    scenes.forEach((s) => {
                        sizeCanvas(s);
                        if (s.init) s.init();
                        s.ctx.clearRect(0, 0, s.w, s.h);
                        s.draw(s.ctx, s.w, s.h, s.t, s);
                    });
                }, 200);
            }, { passive: true });
        }
    });

})();

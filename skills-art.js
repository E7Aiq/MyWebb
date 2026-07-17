/**
 * skills-art.js — لوحات فن توليدي لبطاقات "رحلة البيانات" (index فقط)
 * أربع تصاميم، كل واحدة تمثّل مرحلة. vanilla <canvas> بلا مكتبات.
 *
 * الأداء:
 *  - حلقة rAF واحدة مشتركة للبطاقات الأربع.
 *  - كل بطاقة لها مراقب تقاطع خاص → تُرسم المرئية فقط (والحلقة تتوقف
 *    تماماً حين لا توجد بطاقة مرئية).
 *  - تتوقف عند إخفاء التبويب.
 *  - prefers-reduced-motion → إطار ثابت واحد فقط، بلا حلقة.
 *  - ≤768px → أعداد جزيئات أقل (أخفّ على الجوال).
 */

(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = () => window.innerWidth > 0 && window.innerWidth <= 768;
    /** عدد الجزيئات: سطح المكتب مقابل الجوال */
    const N = (desktop, mobile) => (isMobile() ? mobile : desktop);

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const cards = Array.from(document.querySelectorAll('.stage-card'));
        if (!cards.length) return;

        const rs = getComputedStyle(document.documentElement);
        const COLORS = {
            primary: (rs.getPropertyValue('--accent-primary-rgb') || '59,130,246').trim(),
            secondary: (rs.getPropertyValue('--accent-secondary-rgb') || '16,185,129').trim(),
            tertiary: (rs.getPropertyValue('--accent-tertiary-rgb') || '139,92,246').trim(),
            gold: (rs.getPropertyValue('--accent-gold-rgb') || '200,164,92').trim()
        };

        const renderers = cards.map((card) => {
            const canvas = card.querySelector('.stage-canvas');
            return canvas ? makeRenderer(card, canvas, card.dataset.motif, COLORS) : null;
        }).filter(Boolean);
        if (!renderers.length) return;

        // إطار ثابت أولي دائماً (يظهر فوراً، وهو النهائي مع تقليل الحركة)
        renderers.forEach((r) => { r.resize(); r.draw(0); });

        if (prefersReduced) return; // ثابت فقط — لا حلقة

        let rafId = null;
        const anyActive = () => !document.hidden && renderers.some((r) => r.inView);

        function loop(t) {
            let active = false;
            for (const r of renderers) {
                if (r.inView) { r.draw(t); active = true; }
            }
            rafId = active ? requestAnimationFrame(loop) : null;
        }
        function start() { if (rafId === null && anyActive()) rafId = requestAnimationFrame(loop); }

        // مراقبة كل بطاقة على حدة — تُرسم المرئية فقط
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                const r = renderers.find((x) => x.card === e.target);
                if (r) r.inView = e.isIntersecting;
            });
            start();
        }, { threshold: 0.05 });
        renderers.forEach((r) => io.observe(r.card));

        document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

        let rt = null;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => { renderers.forEach((r) => r.resize()); start(); }, 200);
        }, { passive: true });
    }

    // ============================================================
    // مُنشئ المُصيّر لكل بطاقة
    // ============================================================

    function makeRenderer(card, canvas, motif, COLORS) {
        const ctx = canvas.getContext('2d');
        const impl = MOTIFS[motif] || MOTIFS.question;
        const s = { card, canvas, ctx, motif, inView: false, hovered: false, w: 0, h: 0 };

        card.addEventListener('pointerenter', () => { s.hovered = true; }, { passive: true });
        card.addEventListener('pointerleave', () => { s.hovered = false; }, { passive: true });

        s.resize = function () {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = card.getBoundingClientRect();
            s.w = card.offsetWidth || rect.width || 280;
            s.h = card.offsetHeight || rect.height || 320;
            canvas.width = s.w * dpr;
            canvas.height = s.h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            impl.build(s, COLORS);
        };
        s.draw = function (t) { impl.draw(s, COLORS, t); };
        return s;
    }

    /** مزج لونين "r, g, b" بنسبة t (0..1) */
    function mixRGB(a, b, t) {
        const pa = a.split(',').map(Number);
        const pb = b.split(',').map(Number);
        const m = (i) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
        return `${m(0)}, ${m(1)}, ${m(2)}`;
    }

    const TAU = Math.PI * 2;

    /** إطار "لوح علمي" محفور: مستطيل ذهبي رفيع + شرطات زوايا (نقش عتيق) */
    function plate(s, C) {
        const ctx = s.ctx, m = 10;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${C.gold}, 0.20)`;
        ctx.strokeRect(m, m, s.w - 2 * m, s.h - 2 * m);
        ctx.strokeStyle = `rgba(${C.gold}, 0.55)`;
        const k = 9;
        const corners = [[m, m, 1, 1], [s.w - m, m, -1, 1], [m, s.h - m, 1, -1], [s.w - m, s.h - m, -1, -1]];
        for (const c of corners) {
            ctx.beginPath();
            ctx.moveTo(c[0] + c[2] * k, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * k);
            ctx.stroke();
        }
    }

    // ============================================================
    // المرحلة ١ — "أبدأ بالسؤال": نقاط متناثرة تتصل بعقدة (محفورة كأداة علمية)
    // ============================================================

    const question = {
        build(s) {
            const n = N(16, 9);
            s.dots = Array.from({ length: n }, () => ({
                x: Math.random() * s.w,
                y: Math.random() * s.h,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.22,
                r: Math.random() * 1.3 + 0.6
            }));
            s.center = { x: s.w * 0.5, y: s.h * 0.34 };
        },
        draw(s, C, t) {
            const { ctx } = s;
            ctx.clearRect(0, 0, s.w, s.h);
            plate(s, C);
            const spd = s.hovered ? 1.7 : 1;
            const cx = s.center.x, cy = s.center.y;
            const CONNECT = Math.min(s.w, s.h) * 0.6;

            for (const d of s.dots) {
                d.x += d.vx * spd; d.y += d.vy * spd;
                if (d.x < 0) d.x = s.w; else if (d.x > s.w) d.x = 0;
                if (d.y < 0) d.y = s.h; else if (d.y > s.h) d.y = 0;
            }
            // خطوط تتشكّل نحو المركز (سؤال ينبثق من الضجيج)
            for (const d of s.dots) {
                const dist = Math.hypot(d.x - cx, d.y - cy);
                if (dist < CONNECT) {
                    ctx.strokeStyle = `rgba(${C.primary}, ${(1 - dist / CONNECT) * 0.18})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(cx, cy); ctx.stroke();
                }
            }
            for (const d of s.dots) {
                ctx.fillStyle = `rgba(${C.primary}, 0.5)`;
                ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
            }
            // العقدة المركزية كأداة رصد محفورة: حلقتان + تصليب (crosshair)
            const pr = 3 + Math.sin(t * 0.002 * spd) * 0.6;
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${C.gold}, 0.6)`;
            ctx.beginPath(); ctx.arc(cx, cy, pr + 4, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.stroke();
            ctx.strokeStyle = `rgba(${C.gold}, 0.4)`;
            const cr = pr + 10;
            ctx.beginPath();
            ctx.moveTo(cx - cr, cy); ctx.lineTo(cx - pr - 2, cy);
            ctx.moveTo(cx + pr + 2, cy); ctx.lineTo(cx + cr, cy);
            ctx.moveTo(cx, cy - cr); ctx.lineTo(cx, cy - pr - 2);
            ctx.moveTo(cx, cy + pr + 2); ctx.lineTo(cx, cy + cr);
            ctx.stroke();
            ctx.fillStyle = `rgba(${C.primary}, 0.9)`;
            ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, TAU); ctx.fill();
        }
    };

    // ============================================================
    // المرحلة ٢ — "أستخرج وأُنقّي": جداول جزيئات تتساقط وتنتظم كلما هبطت
    // ============================================================

    const extract = {
        build(s) {
            s.cols = N(5, 3);
            const n = N(42, 20);
            s.parts = Array.from({ length: n }, () => ({
                col: Math.floor(Math.random() * s.cols),
                y: Math.random() * s.h,
                speed: Math.random() * 0.7 + 0.4,
                jitter: (Math.random() - 0.5)
            }));
        },
        draw(s, C, t) {
            const { ctx } = s;
            ctx.clearRect(0, 0, s.w, s.h);
            plate(s, C);
            const spd = s.hovered ? 1.7 : 1;
            const colW = s.w / (s.cols + 1);
            for (const p of s.parts) {
                p.y += p.speed * spd;
                if (p.y > s.h) { p.y = 0; p.jitter = (Math.random() - 0.5); }
                const order = p.y / s.h;            // 0 أعلى (فوضى) → 1 أسفل (منتظم)
                const baseX = colW * (p.col + 1);
                const x = baseX + p.jitter * colW * 0.85 * (1 - order);
                const col = mixRGB(C.primary, C.secondary, order); // أزرق → أخضر مزرق
                ctx.fillStyle = `rgba(${col}, ${0.14 + 0.36 * order})`;
                ctx.fillRect(x, p.y, 1.6, 4);
            }
        }
    };

    // ============================================================
    // المرحلة ٣ — "أكشف وأُنمذج": شبكة عُقد بخطوط نابضة، عنقودان يتشكّلان
    // ============================================================

    const model = {
        build(s) {
            const n = N(11, 7);
            s.nodes = Array.from({ length: n }, (_, i) => {
                const cl = i < n * 0.5 ? 0 : 1;      // عنقودان
                const cxr = cl === 0 ? 0.34 : 0.66;
                const cyr = cl === 0 ? 0.36 : 0.5;
                return {
                    x: s.w * cxr + (Math.random() - 0.5) * s.w * 0.28,
                    y: s.h * cyr + (Math.random() - 0.5) * s.h * 0.34,
                    ox: 0, oy: 0, ph: Math.random() * TAU
                };
            });
        },
        draw(s, C, t) {
            const { ctx } = s;
            ctx.clearRect(0, 0, s.w, s.h);
            plate(s, C);
            const spd = s.hovered ? 1.6 : 1;
            const LINK = Math.min(s.w, s.h) * 0.52;
            for (const nd of s.nodes) {
                nd.ox = Math.sin(t * 0.0006 * spd + nd.ph) * 6;
                nd.oy = Math.cos(t * 0.0005 * spd + nd.ph) * 6;
            }
            for (let i = 0; i < s.nodes.length; i++) {
                for (let j = i + 1; j < s.nodes.length; j++) {
                    const a = s.nodes[i], b = s.nodes[j];
                    const ax = a.x + a.ox, ay = a.y + a.oy, bx = b.x + b.ox, by = b.y + b.oy;
                    const dist = Math.hypot(ax - bx, ay - by);
                    if (dist < LINK) {
                        const pulse = 0.5 + 0.5 * Math.sin(t * 0.002 * spd + (i + j));
                        const col = mixRGB(C.primary, C.secondary, (i + j) / (s.nodes.length * 2));
                        ctx.strokeStyle = `rgba(${col}, ${(1 - dist / LINK) * 0.16 * pulse})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
                    }
                }
            }
            for (let i = 0; i < s.nodes.length; i++) {
                const nd = s.nodes[i];
                const col = mixRGB(C.primary, C.secondary, i / s.nodes.length);
                ctx.fillStyle = `rgba(${col}, 0.6)`;
                ctx.beginPath(); ctx.arc(nd.x + nd.ox, nd.y + nd.oy, 1.8, 0, TAU); ctx.fill();
            }
        }
    };

    // ============================================================
    // المرحلة ٤ — "أروي القرار": موجة رسم بياني/مساحي ترتفع ثم تستقرّ (أخضر)
    // ============================================================

    const story = {
        build(s) {
            s.rise = 0.4;
            s.riseTarget = 0.5;
        },
        draw(s, C, t) {
            const { ctx } = s;
            ctx.clearRect(0, 0, s.w, s.h);
            plate(s, C);
            const spd = s.hovered ? 1.7 : 1;
            // ترتفع نحو هدف يتغيّر ببطء ثم تستقرّ (القصة تنحلّ إلى خلاصة)
            if (Math.random() < 0.005) s.riseTarget = 0.32 + Math.random() * 0.5;
            s.rise += (s.riseTarget - s.rise) * 0.02 * spd;

            const baseY = s.h * (0.74 - s.rise * 0.24);
            const amp = s.h * 0.06;
            const k = TAU / s.w;
            const pts = [];
            ctx.beginPath();
            ctx.moveTo(0, s.h);
            for (let x = 0; x <= s.w; x += 6) {
                const y = baseY
                    + Math.sin(x * k * 1.5 + t * 0.0008 * spd) * amp * 0.6
                    + Math.sin(x * k * 0.6 - t * 0.0005 * spd) * amp;
                pts.push(x, y);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(s.w, s.h);
            ctx.closePath();
            const g = ctx.createLinearGradient(0, baseY - amp, 0, s.h);
            g.addColorStop(0, `rgba(${C.secondary}, 0.22)`);
            g.addColorStop(1, `rgba(${C.secondary}, 0)`);
            ctx.fillStyle = g;
            ctx.fill();
            // خط الموجة
            ctx.beginPath();
            for (let i = 0; i < pts.length; i += 2) {
                if (i === 0) ctx.moveTo(pts[i], pts[i + 1]); else ctx.lineTo(pts[i], pts[i + 1]);
            }
            ctx.strokeStyle = `rgba(${C.secondary}, 0.55)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    };

    const MOTIFS = { question, extract, model, story };

})();

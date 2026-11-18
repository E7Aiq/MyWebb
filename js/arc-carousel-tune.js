/**
 * لوحة ضبط دوّار القوس — أداة تطوير لا تُحمَّل إلا مع ‎?tune=1‎.
 *
 * منزلقٌ لكل قيمة في الإعداد الفعّال للطبقة الحالية (جوال/لوحي/حاسوب)،
 * يُطبَّق فوراً. «نسخ الإعداد» يطبع الأساس والطبقات مع التعديلات JSON،
 * يُلصق في BASE وTIERS في js/arc-carousel.js.
 */
(function () {
    'use strict';

    const api = window.ArcCarousel;
    if (!api || !api.instances.length) return;
    const arc = api.instances[0];

    const RANGES = {
        maxWidth: [600, 1600, 10], height: [0.3, 1.2, 0.01], radius: [0.2, 1.5, 0.01],
        spacing: [5, 45, 0.5], apexY: [0.05, 0.8, 0.01], reach: [1, 6, 1],
        cardWidth: [0.06, 0.5, 0.002], aspect: [0.5, 1.5, 0.01], cornerRadius: [0, 40, 1],
        activeScale: [0.8, 2, 0.01], lift: [0, 0.1, 0.002], sideScale: [0.4, 1.2, 0.01],
        sideOpacity: [0, 1, 0.01], titleY: [0.2, 0.9, 0.01], dotsY: [0.3, 1, 0.01],
        duration: [150, 1500, 10], textBelow: [0, 1, 1]
    };

    const style = document.createElement('style');
    style.textContent = `
      .arc-tune{position:fixed;inset-block-end:12px;inset-inline-start:12px;z-index:3000;
        inline-size:min(320px,calc(100vw - 24px));max-block-size:70vh;overflow:auto;
        padding:12px;border-radius:12px;background:#fff;color:#16181C;direction:ltr;
        font:12px/1.4 ui-monospace,Menlo,monospace;box-shadow:0 12px 40px rgba(0,0,0,.25)}
      .arc-tune h3{font:600 12px/1.4 ui-monospace,Menlo,monospace;margin:0 0 8px}
      .arc-tune label{display:grid;grid-template-columns:96px 1fr 52px;gap:6px;align-items:center;margin:4px 0}
      .arc-tune input[type=range]{inline-size:100%}
      .arc-tune output{text-align:end}
      .arc-tune button{margin-block-start:8px;padding:6px 10px;border-radius:8px;background:#16181C;color:#fff}`;
    document.head.append(style);

    const panel = document.createElement('div');
    panel.className = 'arc-tune';
    document.body.append(panel);

    function draw() {
        const c = arc.c;
        panel.replaceChildren();
        const h = document.createElement('h3');
        h.textContent = `arc · ${c.tier} · W=${Math.round(arc.W)}px`;
        panel.append(h);

        Object.keys(RANGES).forEach((key) => {
            const [min, max, step] = RANGES[key];
            const label = document.createElement('label');
            const name = document.createElement('span');
            name.textContent = key;
            const input = document.createElement('input');
            Object.assign(input, { type: 'range', min, max, step, value: c[key] });
            const out = document.createElement('output');
            out.textContent = c[key];
            input.addEventListener('input', () => {
                const v = Number(input.value);
                out.textContent = v;
                const tier = arc.c.tier;
                arc.overrides[tier] = Object.assign({}, arc.overrides[tier], { [key]: v });
                arc.layout();
            });
            label.append(name, input, out);
            panel.append(label);
        });

        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy config';
        copy.addEventListener('click', async () => {
            const tiers = api.TIERS.map((t) => Object.assign({}, t, arc.overrides[t.name] || {}));
            const json = JSON.stringify({ BASE: api.BASE, TIERS: tiers }, (k, v) => (v === Infinity ? 'Infinity' : v), 2);
            try { await navigator.clipboard.writeText(json); copy.textContent = 'Copied ✓'; }
            catch { console.log(json); copy.textContent = 'Logged to console'; }
            setTimeout(() => { copy.textContent = 'Copy config'; }, 1500);
        });
        panel.append(copy);
    }

    // الطبقة تتبدّل مع العرض، فتُعاد اللوحة على قيمها
    let tier = '';
    new ResizeObserver(() => {
        if (arc.c && arc.c.tier !== tier) { tier = arc.c.tier; draw(); }
    }).observe(document.documentElement);
    draw();
})();

/**
 * Arc Focus Carousel — دوّار القوس لصفحتَي ذُرى وبان.
 *
 * يقرأ البطاقات المصيَّرة مسبقاً في الصفحة نفسها (لا طلب ولا بيانات جديدة)
 * ويرسمها على قوس: البطاقة النشطة قائمة في قمّته، وما حولها يميل مع
 * انحنائه. كل الحركة من عددٍ واحد `pos` — موضعٌ كسريّ في القائمة — يُعاد
 * منه حساب تحويل كل بطاقة في كل إطار، فتسير البطاقات على القوس لا في
 * خطوط مستقيمة، ويُقاطَع الانتقال من حيث وصل.
 *
 * تحسين تدريجي: القسم مخفيّ في الترميز، وسكربت سطري فيه يُظهره ويضع
 * ‎.arc-on‎ على <html> فيُخفي CSS الفهرس. إن تعذّر تحميل هذا الملف
 * (onerror على وسمه) أو أخفق التركيب، يعود كل شيء كما كان: الفهرس ظاهر
 * والقسم مخفيّ. وبلا جافاسكربت لا يتغيّر في الصفحة شيء.
 */
(function () {
    'use strict';

    /* ── الإعداد ─────────────────────────────────────────────────────────
       القيم نسبٌ من عرض المسرح W أو ارتفاعه H ما لم يُذكر غير ذلك، فيتبع
       كل شيء المقاس بلا نقاط كسر داخلية. الطبقات تعلو الأساس بحسب W —
       الجوال أولاً: النصّ تحت البطاقات، وبطاقة واحدة تتوسّط وجارتاها تطلّان
       من الحافّتين. ‎?tune=1‎ يفتح لوحة لكل قيمة ويطبع الإعداد JSON. */
    /* البطاقة بنسبة الأغلفة نفسها (16:9) في كل مقاس: الغلاف يُرى كاملاً كما
       صُمّم، لا مقصوصاً إلى بطاقة طولية. ستّة أغلفة من ثمانية 16:9 تماماً،
       والباقيان (1.75 و1.5) يفقدان شريطاً رفيعاً من أعلاهما وأسفلهما فقط.
       ولأن البطاقة عريضة صار الفاصل بين بطاقتين أوسع (28°) كي لا تتراكب. */
    const BASE = {
        maxWidth: 1200,     // px — عرض المسرح الأقصى
        height: 0.62,       // H ÷ W
        radius: 0.49,       // R ÷ W
        spacing: 28,        // درجات بين بطاقتين متجاورتين
        apexY: 0.27,        // قمّة القوس ÷ H
        reach: 2,           // يُرى ±reach، ويتلاشى ما بعده
        cardWidth: 0.2,     // ÷ W
        aspect: 16 / 9,     // العرض ÷ الارتفاع — نسبة الأغلفة
        cornerRadius: 18,   // px
        activeScale: 1.3,
        lift: 0.02,         // ÷ W — ارتفاع النشطة فوق القوس
        sideScale: 0.86,
        sideOpacity: 0.92,
        titleY: 0.56,       // منتصف سطر العنوان ÷ H
        dotsY: 0.86,        // ÷ H
        duration: 720,      // ms
        textBelow: 0        // 1 ⇒ النصّ تحت البطاقات لا داخل القوس
    };

    /* الجوال واللوحي: النصّ تحت القوس، والقوس أسطح (نصف قطر أكبر وفاصل أضيق)
       كي لا تهبط الجارتان فتتركا فراغاً بين البطاقة والعنوان. في الجوال
       تطلّ الجارتان من الحافّتين خلف النشطة، وفي اللوحي تظهران كاملتين. */
    const TIERS = [
        { name: 'phone', max: 640,
          height: 0.56, apexY: 0.427, radius: 1.3, spacing: 26, reach: 2,
          cardWidth: 0.62, activeScale: 1.08, lift: 0.02, textBelow: 1 },
        { name: 'tablet', max: 1024,
          height: 0.34, apexY: 0.405, radius: 1.0, spacing: 21, reach: 2,
          cardWidth: 0.3, activeScale: 1.2, lift: 0.015, textBelow: 1 },
        { name: 'laptop', max: Infinity }
    ];

    /* ما يخصّ كل قسم: أين بطاقاته، وكيف يُقرأ منها عنصر، ومن أين يبدأ */
    const KINDS = {
        projects: {
            max: 8,
            loop: true,
            label: ['مشاريع ذُرى', 'Dhura projects'],
            cta: ['تفاصيل المشروع', 'Project details'],
            source: '#projectsGrid',
            read(root) {
                return [...root.querySelectorAll('.project-card')].map((card) => ({
                    id: card.dataset.id || '',
                    title: text(card, '.project-card-title'),
                    sub: text(card, '.project-card-summary'),
                    href: attr(card, '.project-card-link', 'href'),
                    cover: attr(card, '.project-card-image', 'src'),
                    preview: attr(card, '.project-card-btn-preview', 'href')
                }));
            }
        },
        articles: {
            max: 9,
            loop: true,
            label: ['مقالات بان', 'Ban articles'],
            cta: ['اقرأ المقال', 'Read the article'],
            source: '#articles-grid',
            read(root) {
                return [...root.querySelectorAll(':scope > .article-lead, :scope > .article-card')].map((a) => {
                    const excerpt = text(a, '.article-card-description');
                    // الفاصلة العربية لا «·»: النقطة الوسطى بين رقمين عربيّين تُقرأ صفراً
                    const when = [text(a, '.article-card-date'), text(a, '.article-read-time')]
                        .filter(Boolean).join(T(['، ', ' · ']));
                    return {
                        id: a.dataset.id || '',
                        title: text(a, '.article-lead-title, .article-card-title'),
                        sub: excerpt || when,
                        href: a.getAttribute('href') || '',
                        cover: attr(a, 'img', 'src')
                    };
                });
            }
        }
    };

    const T = (pair) => (window.I18N ? window.I18N.t(pair[0], pair[1]) : pair[0]);
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const mod = (v, n) => ((v % n) + n) % n;
    const DEG = Math.PI / 180;

    function text(root, sel) {
        const el = root.querySelector(sel);
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }
    function attr(root, sel, name) {
        const el = root.querySelector(sel);
        return el ? el.getAttribute(name) || '' : '';
    }

    const CHEVRON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
        + 'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="m9 6 6 6-6 6"></path></svg>';

    /* ════════════════════════════════════════════════════════════════════ */
    class Arc {
        constructor(root, kind) {
            this.root = root;
            this.kind = kind;
            this.source = document.querySelector(kind.source);
            this.overrides = {};          // من لوحة الضبط، لكل طبقة
            this.items = [];
            this.cards = [];
            this.pos = 0;
            this.vel = 0;                 // عناصر في الثانية — يحفظها النابض بين الأهداف
            this.to = 0;
            this.last = 0;
            this.raf = 0;
            this.index = 0;
            this.pendingReveal = false;
            this.drag = null;
            this.dragged = false;
            this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.tick = this.tick.bind(this);

            this.build();
            // الدوران يتبع مدى الطبقة، والبداية تتبع الدوران — فيُحسبان قبل القراءة
            this.c = this.configFor(this.root.clientWidth || window.innerWidth);
            if (!this.load()) throw new Error('arc: لا عناصر');

            new ResizeObserver(() => this.layout()).observe(this.root);
            this.layout();
            this.setText(this.index);
            this.root.classList.add('is-ready');
            requestAnimationFrame(() => this.reveal());
            // قياس نصّ الختم يتبع الخط؛ يُعاد حين يكتمل تحميله
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.fitSeal());

            /* الفهرس يُعاد بناؤه عند تبديل اللغة (تواريخ وتسميات) — يُقرأ منه
               من جديد بعد أن يستقرّ، وتبقى البطاقة النشطة هي هي. */
            if (this.source) {
                let wait = 0;
                new MutationObserver(() => {
                    clearTimeout(wait);
                    wait = setTimeout(() => this.reload(), 60);
                }).observe(this.source, { childList: true, subtree: true });
            }
            if (window.I18N) window.I18N.onChange(() => { this.relabel(); this.layout(); });
        }

        /* ── الإعداد الفعّال لعرضٍ ما: الأساس ثم الطبقة ثم تعديلات اللوحة ── */
        configFor(w) {
            const tier = TIERS.find((t) => w <= t.max) || TIERS[TIERS.length - 1];
            return Object.assign({}, BASE, tier, this.overrides[tier.name] || {}, { tier: tier.name });
        }

        /* ── الهيكل ─────────────────────────────────────────────────────── */
        build() {
            const r = this.root;
            r.setAttribute('role', 'region');
            r.setAttribute('aria-roledescription', 'carousel');

            this.stage = el('div', 'arc-stage');
            this.track = el('div', 'arc-track');
            this.text = el('div', 'arc-text');
            this.head = el('div', 'arc-head');
            this.prev = el('button', 'arc-nav arc-prev');
            this.next = el('button', 'arc-nav arc-next');
            this.prev.type = this.next.type = 'button';
            this.prev.innerHTML = this.next.innerHTML = CHEVRON;
            this.title = el('p', 'arc-title');
            this.title.setAttribute('aria-live', 'polite');
            this.title.dir = 'auto';
            this.sub = el('p', 'arc-sub');
            this.cta = el('a', 'arc-cta');
            this.dots = el('div', 'arc-dots');
            this.dots.setAttribute('role', 'group');

            this.seal = this.buildSeal();

            this.head.append(this.prev, this.title, this.next);
            this.text.append(this.head, this.sub, this.cta);
            this.stage.append(this.track, this.seal, this.text, this.dots);
            r.append(this.stage);

            this.prev.addEventListener('click', () => this.step(-1));
            this.next.addEventListener('click', () => this.step(1));
            this.dots.addEventListener('click', (e) => {
                const dot = e.target.closest('.arc-dot');
                if (dot) this.focusIndex(Number(dot.dataset.index));
            });
            this.track.addEventListener('click', (e) => this.onCardClick(e));
            r.addEventListener('keydown', (e) => this.onKey(e));

            // السحب على المسرح كلّه: الأفقي لنا، والرأسي للصفحة (touch-action)
            this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
            this.stage.addEventListener('pointermove', (e) => this.onMove(e));
            this.stage.addEventListener('pointerup', (e) => this.onUp(e));
            this.stage.addEventListener('pointercancel', (e) => this.onUp(e, true));
            // نقرةٌ تلي سحباً لا تفتح رابطاً
            this.stage.addEventListener('click', (e) => {
                if (!this.dragged) return;
                this.dragged = false;
                e.preventDefault();
                e.stopPropagation();
            }, true);
            this.stage.addEventListener('dragstart', (e) => e.preventDefault());

            this.reduced.addEventListener('change', () => this.render());
        }

        /* ── البيانات: من بطاقات الفهرس نفسها ─────────────────────────────── */
        load() {
            if (!this.source) return false;
            const items = this.kind.read(this.source)
                .filter((it) => it.title && it.href)
                .slice(0, this.kind.max);
            if (!items.length) return false;

            const keep = this.items[this.index] && this.items[this.index].id;
            this.items = items;
            this.track.replaceChildren(...items.map((it, i) => this.card(it, i)));
            this.cards = [...this.track.children];
            this.dots.replaceChildren(...items.map((it, i) => {
                const b = el('button', 'arc-dot');
                b.type = 'button';
                b.dataset.index = i;
                return b;
            }));

            this.loop = this.kind.loop && items.length >= 3;
            const again = keep ? items.findIndex((it) => it.id === keep) : -1;
            this.index = again >= 0 ? again : 0;
            this.pos = this.to = this.index;
            this.vel = 0;
            // غلاف البطاقة النشطة أوّلاً وبأولوية — هو ما يُرى قبل غيره
            const first = this.cards[this.index].firstElementChild;
            if (first && first.dataset.src) {
                first.fetchPriority = 'high';
                first.src = first.dataset.src;
            }
            this.relabel();
            return true;
        }

        reload() {
            const was = this.items.map((it) => it.href + it.sub).join('|');
            const now = this.kind.read(this.source).slice(0, this.kind.max)
                .map((it) => it.href + it.sub).join('|');
            if (was === now) return;
            if (this.load()) { this.layout(); this.setText(this.index); this.reveal(); }
        }

        card(it, i) {
            const a = el('a', 'arc-card');
            a.href = it.href;
            a.draggable = false;
            a.dataset.index = i;
            if (it.id) a.dataset.id = it.id;   // يقرأه مورف الانتقال إلى الغلاف
            if (it.cover) {
                const img = new Image();
                img.className = 'arc-card-img';
                img.alt = '';
                img.decoding = 'async';
                img.draggable = false;
                img.dataset.src = it.cover;
                // غلاف لا يُحمَّل يُزال، فتبقى أرضية البطاقة المصبوغة وحدها
                img.addEventListener('error', () => img.remove(), { once: true });
                a.append(img);
            }
            return a;
        }

        relabel() {
            const n = this.items.length;
            this.root.setAttribute('aria-label', T(this.kind.label));
            this.prev.setAttribute('aria-label', T(['السابق', 'Previous']));
            this.next.setAttribute('aria-label', T(['التالي', 'Next']));
            this.dots.setAttribute('aria-label', T(['اختر عنصراً', 'Choose an item']));
            this.cta.textContent = T(this.kind.cta);
            [...this.dots.children].forEach((b, i) => {
                const k = window.I18N ? window.I18N.num(i + 1) : String(i + 1);
                const of = window.I18N ? window.I18N.num(n) : String(n);
                b.setAttribute('aria-label', T([`${k} من ${of}`, `${i + 1} of ${n}`]));
            });
            this.cards.forEach((c, i) => c.setAttribute('aria-label', this.items[i].title));
            if (this.c) this.fitSeal();
        }

        /* ── الهندسة: تُحسب عند كل تغيّر في المقاس ─────────────────────────── */
        layout() {
            const w = this.root.clientWidth;
            if (!w) return;
            const c = this.configFor(w);
            const W = Math.min(w, c.maxWidth);
            const H = c.height * W;
            this.c = c;
            this.W = W;
            this.H = H;
            this.dir = document.documentElement.dir === 'ltr' ? 1 : -1;   // RTL: التالي يسار
            this.R = c.radius * W;
            this.apex = c.apexY * H;
            this.cw = c.cardWidth * W;
            this.ch = this.cw / c.aspect;
            this.liftPx = c.lift * W;
            this.pxPerItem = Math.max(40, this.R * Math.sin(c.spacing * DEG));

            const s = this.stage.style;
            s.setProperty('--arc-w', `${W}px`);
            s.setProperty('--arc-h', `${H}px`);
            s.setProperty('--arc-cw', `${this.cw}px`);
            s.setProperty('--arc-ch', `${this.ch}px`);
            s.setProperty('--arc-r', `${c.cornerRadius}px`);
            this.stage.classList.toggle('is-below', !!c.textBelow);
            this.placeSeal();

            this.render();
            this.placeText();
            this.syncControls();
        }

        /* النصّ داخل القوس: سطر العنوان يتوسّط titleY، والنقاط عند dotsY أو
           تحت النصّ إن طال العنوان سطرين — ولا يتداخلان أبداً. */
        placeText() {
            const c = this.c;
            if (!c) return;
            if (c.textBelow) {
                this.text.style.top = this.dots.style.top = '';
                this.stage.style.removeProperty('--arc-stage-h');
                this.stage.style.removeProperty('--arc-head-w');
                return;
            }
            /* عرض سطر العنوان: ما بين البطاقتين الثانيتين على جانبي القمّة —
               فلا يجلس سهمٌ فوق بطاقة، ولا يمتدّ العنوان تحتها. */
            const far = Math.min(c.reach, this.loop
                ? Math.floor((this.items.length - 1) / 2) : this.items.length - 1);
            const th = Math.min(2 * c.spacing, 80) * DEG;
            const half = (this.cw * Math.cos(th) + this.ch * Math.sin(th)) * c.sideScale / 2;
            // بلا بطاقتين ثانيتين (ثلاثة عناصر) لا يضيّق شيءٌ سطرَ العنوان
            const room = far >= 2 ? clamp(2 * (this.R * Math.sin(th) - half) - 16, 280, 640) : 640;
            this.stage.style.setProperty('--arc-head-w', `${room}px`);
            const top = c.titleY * this.H - this.head.offsetHeight / 2;
            this.text.style.top = `${top}px`;
            // النقاط عند قاعدة القوس حين تبلغها البطاقات، وإلا فتحت النصّ مباشرة
            const dotsTop = Math.max(far >= 2 ? c.dotsY * this.H : 0, top + this.text.offsetHeight + 28);
            this.dots.style.top = `${dotsTop}px`;
            /* المسرح بقدر ما يُرسم فيه: قائمةٌ قصيرة بلا دوران لا تبلغ بطاقاتها
               ركنَي القوس السفليين، فلا يُحجز لها فراغ تحت النقاط. */
            const fth = Math.min(far, 89 / c.spacing) * c.spacing * DEG;
            const low = this.apex + this.R * (1 - Math.cos(fth))
                + (this.cw * Math.sin(fth) + this.ch * Math.cos(fth)) * c.sideScale / 2;
            const h = Math.max(dotsTop + this.dots.offsetHeight + 16, low + 16);
            this.stage.style.setProperty('--arc-stage-h', `${h}px`);
        }

        /* ── الرسم: إطار واحد ───────────────────────────────────────────── */
        render() {
            const c = this.c;
            if (!c) return;
            const n = this.items.length;
            for (let i = 0; i < n; i++) {
                const card = this.cards[i];
                let d = i - this.pos;
                if (this.loop) d = mod(d + n / 2, n) - n / 2;
                const ad = Math.abs(d);
                const t = Math.min(ad, 1);
                let fade = clamp(c.reach + 1 - ad, 0, 1);
                // في الدوران تعبر البطاقة من طرفٍ إلى الطرف المقابل عند ‎±n/2‎ —
                // تخفت قبل العبور وتظهر بعده، فلا تُرى قافزةً عبر القوس.
                if (this.loop) fade = Math.min(fade, clamp((n / 2 - ad) * 2, 0, 1));
                const th = d * c.spacing * DEG;
                const phi = this.dir * th;
                const x = this.W / 2 + this.R * Math.sin(phi) - this.cw / 2;
                const y = this.apex + this.R * (1 - Math.cos(th)) - this.liftPx * (1 - t) - this.ch / 2;
                const scale = lerp(c.activeScale, c.sideScale, t);

                card.style.transform =
                    `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${phi.toFixed(4)}rad) scale(${scale.toFixed(4)})`;
                card.style.opacity = (lerp(1, c.sideOpacity, t) * fade).toFixed(3);
                card.style.zIndex = String(1000 - Math.round(ad * 10));
                card.style.visibility = fade > 0 ? '' : 'hidden';

                // الصورة تُطلب حين تقترب البطاقة من ±2 — ما وراءها ينتظر
                if (ad <= 2.5) {
                    const img = card.firstElementChild;
                    if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
                }
            }
        }

        /* ── الحركة ─────────────────────────────────────────────────────── */
        nearest(i) {
            if (!this.loop) return clamp(i, 0, this.items.length - 1);
            const n = this.items.length;
            const here = mod(Math.round(this.to), n);
            let delta = mod(i - here, n);
            if (delta > n / 2) delta -= n;
            return Math.round(this.to) + delta;
        }

        step(delta) {
            const target = Math.round(this.to) + delta;
            this.goTo(this.loop ? target : clamp(target, 0, this.items.length - 1));
        }

        focusIndex(i) { this.goTo(this.nearest(i)); }

        goTo(target, velocity) {
            const n = this.items.length;
            const k = mod(Math.round(target), n);
            const moving = Math.abs(target - this.pos) > 0.001;
            const focusCard = document.activeElement && document.activeElement.classList.contains('arc-card');

            this.to = target;
            this.index = k;
            this.hideText();
            this.setText(k);
            this.syncControls();
            if (focusCard) this.cards[k].focus({ preventScroll: true });

            if (!moving) { this.pos = target; this.vel = 0; this.render(); this.reveal(); return; }

            // تقليل الحركة: لا انتقال على القوس — تلاشٍ متقاطع فقط
            if (this.reduced.matches) {
                cancelAnimationFrame(this.raf);
                this.raf = 0;
                this.track.classList.add('is-fading');
                clearTimeout(this.fadeTimer);
                this.fadeTimer = setTimeout(() => {
                    this.pos = target;
                    this.vel = 0;
                    this.render();
                    this.track.classList.remove('is-fading');
                    this.reveal();
                }, 160);
                return;
            }

            if (velocity !== undefined) this.vel = velocity;
            this.pendingReveal = true;
            if (!this.raf) {
                this.last = performance.now();
                this.raf = requestAnimationFrame(this.tick);
            }
        }

        /* نابضٌ مُخمَّد حرجاً بدل منحنى زمنيّ: يبدأ من سرعته الحالية بلا قفزة،
           ويهدأ عند الهدف بلا ارتداد، وإن تغيّر الهدف في منتصف الطريق انعطف
           بالسرعة نفسها — فلا توقّف ولا اندفاع. الحلّ تحليليّ لكل إطار، فلا
           يتأثّر بتفاوت الإطارات. ‎duration‎ زمن الاستقرار تقريباً. */
        tick(now) {
            const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
            this.last = now;
            const w = 7.5 / (this.c.duration / 1000);
            const e0 = this.pos - this.to;
            const v0 = this.vel;
            const decay = Math.exp(-w * dt);
            const e = (e0 + (v0 + w * e0) * dt) * decay;
            this.vel = (v0 - w * (v0 + w * e0) * dt) * decay;
            this.pos = this.to + e;
            this.render();

            // النصّ الجديد يبدأ حين تقترب البطاقة من القمّة، قبل أن تستقرّ
            if (this.pendingReveal && Math.abs(e) < 0.3) { this.pendingReveal = false; this.reveal(); }

            if (Math.abs(e) > 0.0005 || Math.abs(this.vel) > 0.01) {
                this.raf = requestAnimationFrame(this.tick);
                return;
            }
            this.raf = 0;
            this.pos = this.to;
            this.vel = 0;
            // في الدوران يبقى الموضع قريباً من نطاق القائمة
            if (this.loop && Math.abs(this.pos) > this.items.length * 4) this.pos = this.to = this.index;
            this.render();
            if (this.pendingReveal) { this.pendingReveal = false; this.reveal(); }
        }

        /* ── ختم المعاينة: على ركن البطاقة النشطة، لمشروعٍ له معاينة حيّة ────
           دائرةٌ ورقية صغيرة يدور حولها نصّها كما يدور المدار حول نقطة
           الشعار، وفي قلبها سهمٌ بلون القسم. يظهر حين تستقرّ البطاقة ويختفي
           فور حركتها، كالنصّ. رابطٌ حقيقي يُفتح في نافذة جديدة. */
        buildSeal() {
            const a = el('a', 'arc-seal');
            a.target = '_blank';
            a.rel = 'noopener';
            a.tabIndex = -1;
            a.setAttribute('aria-hidden', 'true');
            const id = `arcSeal${Math.random().toString(36).slice(2, 8)}`;
            a.innerHTML =
                '<svg class="arc-seal-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
                + `<defs><path id="${id}" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0"></path></defs>`
                + '<circle class="arc-seal-hair" cx="50" cy="50" r="29"></circle>'
                + `<text class="arc-seal-text"><textPath href="#${id}"></textPath></text>`
                + '</svg>'
                + '<span class="arc-seal-core" aria-hidden="true">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
                + 'stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M9 7h8v8"></path></svg>'
                + '</span>';
            this.sealText = a.querySelector('textPath');
            return a;
        }

        /* مركز الختم على ركن البطاقة النشطة العلويّ من جهة النهاية (يسار في
           العربية)، داخل الركن قليلاً كي يُقرأ ختماً على الطبعة لا معلّقاً. */
        placeSeal() {
            const c = this.c;
            const size = this.seal.offsetWidth || 72;
            const halfW = this.cw * c.activeScale / 2;
            const halfH = this.ch * c.activeScale / 2;
            const inset = size * 0.2;
            const x = this.W / 2 + this.dir * (halfW - inset);
            const y = this.apex - this.liftPx - halfH + inset;
            this.stage.style.setProperty('--seal-x', `${x}px`);
            this.stage.style.setProperty('--seal-y', `${y}px`);
            this.fitSeal();
        }

        /* النصّ يملأ محيط الدائرة تماماً بمقاسٍ صغير ثابت تقريباً (٩ وحدات من
           ١٠٠): تُقاس العبارة مرّة، ويُحسب كم مرّة تتكرّر لتقارب المحيط، ثم
           يُضبط المقاس بالنسبة كي لا تبقى فجوة. لا textLength: تمطيط المسافات
           يفصل الحروف العربية المتصلة. */
        fitSeal() {
            const phrase = T(['معاينة حيّة • ', 'LIVE PREVIEW • ']);
            const textEl = this.sealText.parentNode;
            const circumference = 2 * Math.PI * 38;
            this.sealText.textContent = phrase;
            textEl.style.fontSize = '10px';
            let one = 0;
            try { one = textEl.getComputedTextLength(); } catch (err) { one = 0; }
            if (!one) return;
            const reps = Math.max(1, Math.round(circumference / (one * 1.15)));
            this.sealText.textContent = phrase.repeat(reps);
            textEl.style.fontSize = `${(10 * circumference * 0.985) / (one * reps)}px`;
        }

        showSeal() {
            const it = this.items[this.index];
            const on = !!(it && it.preview);
            this.seal.classList.toggle('is-in', on);
            this.seal.tabIndex = on ? 0 : -1;
            if (on) {
                this.seal.href = it.preview;
                this.seal.removeAttribute('aria-hidden');
                this.seal.setAttribute('aria-label', T([`معاينة حيّة لـ«${it.title}» — تُفتح في نافذة جديدة`,
                    `Live preview of “${it.title}” — opens in a new tab`]));
            } else {
                this.seal.setAttribute('aria-hidden', 'true');
            }
        }

        /* ── النصّ: يختفي فور بدء الحركة، ويظهر متدرّجاً ───────────────────── */
        setText(k) {
            const it = this.items[k];
            this.title.textContent = it.title;
            this.sub.textContent = it.sub;
            this.sub.hidden = !it.sub;
            this.cta.href = it.href;
            // عنوانٌ أطول من سطرَي المقاس الكبير ينزل إلى أصغر مقاسات العرض (28px)
            // قبل أن يُقصّ — فيُقرأ الاسم كاملاً ما أمكن.
            this.title.classList.remove('is-long');
            if (this.title.scrollHeight > this.title.clientHeight + 2) this.title.classList.add('is-long');
            this.placeText();
        }
        hideText() {
            this.text.classList.remove('is-in');
            this.seal.classList.remove('is-in');
            this.seal.tabIndex = -1;
        }
        reveal() {
            void this.text.offsetWidth;   // يثبّت حالة الإخفاء قبل الانتقال
            this.text.classList.add('is-in');
            this.showSeal();
        }

        syncControls() {
            const n = this.items.length;
            const k = this.index;
            this.prev.disabled = !this.loop && k <= 0;
            this.next.disabled = !this.loop && k >= n - 1;
            [...this.dots.children].forEach((b, i) => {
                const on = i === k;
                b.classList.toggle('is-active', on);
                if (on) b.setAttribute('aria-current', 'true');
                else b.removeAttribute('aria-current');
            });
            this.cards.forEach((card, i) => {
                const on = i === k;
                card.tabIndex = on ? 0 : -1;
                card.classList.toggle('is-active', on);
                if (on) card.removeAttribute('aria-hidden');
                else card.setAttribute('aria-hidden', 'true');
            });
        }

        /* ── المدخلات ───────────────────────────────────────────────────── */
        onCardClick(e) {
            const card = e.target.closest('.arc-card');
            if (!card) return;
            const i = Number(card.dataset.index);
            if (i === this.index && Math.abs(this.pos - this.to) < 0.5) return;   // النشطة: الرابط يعمل
            e.preventDefault();
            this.focusIndex(i);
        }

        onKey(e) {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const rtl = this.dir === -1;
            let delta = 0;
            if (e.key === 'ArrowLeft') delta = rtl ? 1 : -1;
            else if (e.key === 'ArrowRight') delta = rtl ? -1 : 1;
            else if (e.key === 'Home') return this.keyTo(e, 0);
            else if (e.key === 'End') return this.keyTo(e, this.items.length - 1);
            else return;
            e.preventDefault();
            this.step(delta);
        }
        keyTo(e, i) { e.preventDefault(); this.focusIndex(i); }

        onDown(e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('.arc-nav, .arc-dot, .arc-cta, .arc-seal')) return;
            this.dragged = false;
            this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: this.pos, active: false, samples: [] };
        }

        onMove(e) {
            const g = this.drag;
            if (!g || g.id !== e.pointerId) return;
            const dx = e.clientX - g.x;
            if (!g.active) {
                if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - g.y)) return;
                g.active = true;
                this.dragged = true;
                cancelAnimationFrame(this.raf);
                this.raf = 0;
                this.vel = 0;
                clearTimeout(this.fadeTimer);
                this.track.classList.remove('is-fading');
                g.pos = this.pos;
                g.x = e.clientX;
                this.hideText();
                this.stage.classList.add('is-dragging');
                try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* لا شيء */ }
                return;
            }
            // RTL: السحب يميناً يجلب ما على اليسار — أي التالي
            let p = g.pos - this.dir * (e.clientX - g.x) / this.pxPerItem;
            if (!this.loop) {
                const hi = this.items.length - 1;
                if (p < 0) p *= 0.3;
                else if (p > hi) p = hi + (p - hi) * 0.3;
            }
            this.pos = p;
            this.render();
            const k = mod(Math.round(clamp(p, this.loop ? -Infinity : 0, this.loop ? Infinity : this.items.length - 1)), this.items.length);
            if (k !== this.index) { this.index = k; this.syncControls(); }
            const now = performance.now();
            g.samples.push([now, p]);
            while (g.samples.length > 2 && now - g.samples[0][0] > 100) g.samples.shift();
        }

        onUp(e, cancelled) {
            const g = this.drag;
            if (!g || g.id !== e.pointerId) return;
            this.drag = null;
            if (!g.active) return;
            this.stage.classList.remove('is-dragging');
            // سحب اللمس لا يُتبَع بنقرة غالباً، فلا تبقى العلامة تبتلع النقرة التالية
            setTimeout(() => { this.dragged = false; }, 0);
            let v = 0;   // عناصر لكل ms
            if (!cancelled && g.samples.length > 1) {
                const [t0, p0] = g.samples[0];
                const [t1, p1] = g.samples[g.samples.length - 1];
                if (t1 > t0) v = (p1 - p0) / (t1 - t0);
            }
            // مكافأة النفض: دفعةٌ صغيرة في اتجاهه، لا تتجاوز عنصرين. والنابض
            // يبدأ بسرعة الإصبع نفسها، فتكمل البطاقات حركتها ولا تنطلق من سكون.
            const bonus = clamp(v * 180, -2, 2);
            let target = Math.round(this.pos + bonus);
            if (!this.loop) target = clamp(target, 0, this.items.length - 1);
            this.goTo(target, clamp(v * 1000, -12, 12));
        }
    }

    function el(tag, cls) {
        const node = document.createElement(tag);
        node.className = cls;
        return node;
    }

    /* ── التركيب ───────────────────────────────────────────────────────── */
    const instances = [];

    function fail(root) {
        document.documentElement.classList.remove('arc-on');
        root.hidden = true;
        root.replaceChildren();
    }

    function mount() {
        document.querySelectorAll('.arc[data-arc]').forEach((root) => {
            const kind = KINDS[root.dataset.arc];
            if (!kind || root.classList.contains('is-ready')) return;
            try {
                instances.push(new Arc(root, kind));
            } catch (err) {
                console.error(err);
                fail(root);
            }
        });

        // لوحة الضبط: لا يُحمَّل كودها إلا مع ‎?tune=1‎
        if (instances.length && /[?&]tune=1\b/.test(location.search)) {
            const me = document.querySelector('script[src*="arc-carousel.js"]');
            const v = me ? (me.src.split('?')[1] || '') : '';
            const s = document.createElement('script');
            s.src = `/js/arc-carousel-tune.js${v ? `?${v}` : ''}`;
            document.body.append(s);
        }
    }

    window.ArcCarousel = { BASE, TIERS, instances };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();

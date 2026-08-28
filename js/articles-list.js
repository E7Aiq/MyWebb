/**
 * Articles Index
 * يقرأ data/articles.json ويبني الفهرس: مقال صدارة ثم قائمة.
 * لا يلمس طبقة البيانات — قراءة فقط.
 */

(function () {
    'use strict';

    /* ── جسر i18n ────────────────────────────────────────────────────────
       كل نصّ واجهة يمرّ من هنا. الاحتياطي يُبقي الموقع عربياً صحيحاً لو
       أخفق تحميل js/i18n.js — لا مفاتيح ترجمة عارية في الصفحة. */
    const T = (ar, en) => (window.I18N ? window.I18N.t(ar, en) : ar);
    const readTime = (m, w) => (window.I18N ? window.I18N.readTime(m, w) : `${m || 5} دقائق`);
    const formatDate = (d) => (window.I18N ? window.I18N.date(d) : '');

    /* مطلقة من الجذر: هذه السكربتات تعمل الآن من /articles/ و/articles/<slug>/
       أيضاً، والمسار النسبي كان سيطلب /articles/<slug>/data/articles.json. */
    const CONFIG = {
        dataUrl: '/data/articles.json',
        slugsUrl: '/data/slugs.json',
        containerId: 'articles-grid',
        featuredGridId: 'featuredArticlesGrid'   // أحدث مقال في الصفحة الرئيسية
    };

    /* خريطة المعرّف ← المسار النظيف، يكتبها البناء في data/slugs.json.
       بدونها تُبنى الروابط على الشكل القديم — وهو يعمل (جسر تحويل) لكنه
       يكلّف قفزة، فالخريطة تُجلب مرّة وتُخبّأ. */
    let slugMap = null;

    async function fetchSlugs() {
        if (slugMap) return slugMap;
        try {
            const response = await fetch(CONFIG.slugsUrl);
            slugMap = response.ok ? await response.json() : {};
        } catch {
            slugMap = {};
        }
        return slugMap;
    }

    /* مسارات الأغلفة في data/ نسبيّة («assets/…»). من /articles/ أو من
       /articles/<slug>/ تُحلّ إلى مسار لا وجود له، فتُجذَّر هنا. */
    const assetUrl = (p) => (!p || /^(https?:)?\/\//i.test(p) || p.startsWith('/')) ? p : '/' + p;

    function hrefFor(id) {
        const record = slugMap && slugMap[id];
        if (!record || !record.slug) return `/article.html?id=${encodeURIComponent(id)}`;
        return `/articles/${encodeURIComponent(record.slug)}/`;
    }

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        if (document.getElementById(CONFIG.containerId)) init();
        if (document.getElementById(CONFIG.featuredGridId)) loadFeatured();
    }

    async function fetchArticles() {
        const response = await fetch(CONFIG.dataUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        return data.articles || [];
    }

    // ── articles.html ────────────────────────────────────────────────────
    async function init() {
        const container = document.getElementById(CONFIG.containerId);

        /* الشبكة مصيَّرة مسبقاً في البناء. إعادة بنائها هنا تُنتج نفس الترميز
           حرفاً بحرف، لكنها تهدم عقداً يراقبها IntersectionObserver أصلاً
           وتُلغي أثر التصيير المسبق. تُترك كما هي، وتُعاد فقط عند تبديل
           اللغة — وعندها تكون العلامة قد نُزعت. */
        if (container.dataset.prerendered === '1') {
            delete container.dataset.prerendered;
            /* التصيير المسبق عربيّ — وهو الأصل. إن كانت لغة الواجهة إنجليزية
               عند التحميل فلا مفرّ من إعادة البناء، وإلا بقيت تسميات
               البطاقات وتواريخها عربيةً وحدها وسط واجهة إنجليزية. */
            if (!window.I18N || window.I18N.lang !== 'en') {
                announce(container.querySelectorAll('.article-card, .article-lead').length);
                return;
            }
        }

        try {
            await fetchSlugs();
            const articles = await fetchArticles();
            render(container, articles);
            announce(articles.length);
        } catch (error) {
            console.error('Error loading articles:', error);
            showError(container, T('حدث خطأ في تحميل المقالات',
                                   'Something went wrong loading the articles.'));
            announce(null);
        }
    }

    /**
     * قارئ الشاشة لا يرى الشبكة تمتلئ ولا تفرغ — المنطقة الحيّة تنطق ما وقع.
     */
    function announce(count) {
        const el = document.getElementById('gridStatus');
        if (!el) return;
        if (count === null) {
            el.textContent = T('تعذّر تحميل المقالات.', 'Could not load the writing.');
        } else if (count === 0) {
            el.textContent = T('لا مقالات بعد.', 'Nothing published yet.');
        } else {
            const n = window.I18N ? window.I18N.num(count) : count;
            el.textContent = T(`عُرض ${n} من المقالات.`, `Showing ${count} article${count === 1 ? '' : 's'}.`);
        }
    }

    // ── index.html — أحدث مقال وحده ───────────────────────────────────────
    async function loadFeatured() {
        const container = document.getElementById(CONFIG.featuredGridId);
        if (container.dataset.prerendered === '1') {
            delete container.dataset.prerendered;
            if (!window.I18N || window.I18N.lang !== 'en') return;
        }
        try {
            await fetchSlugs();
            const [latest] = orderArticles(await fetchArticles());
            container.innerHTML = '';
            if (latest) container.appendChild(createArticleCard(latest));
        } catch (error) {
            console.error('Error loading featured article:', error);
            container.innerHTML = '';   // الصفحة الرئيسية لا تُظهر خطأً مزعجاً
        }
    }

    /**
     * ترتيب المقالات — نفس القاعدة المستعملة في js/article.js للسابق/التالي،
     * فيبقى ترتيب الفهرس وترتيب التنقّل داخل المقال متطابقين.
     *
     * القاعدة: المميّز (featured) أولاً، ثم الأحدث تاريخاً.
     *
     * كان التعليق هنا يقول إن حقل date فارغ في كل مقال فلا معنى للفرز
     * الزمني — وقد امتلأ الحقل منذُئذٍ (٢٠٢٥-٠٤-١٢ و٢٠٢٣-٠٩-٠٩)، وكلا
     * المقالين featured:false، فكان الفرز لا يفعل شيئاً والترتيب ترتيبَ
     * Notion. الفارغ يُعزل صراحةً بدل ترك new Date(null) ينتج NaN فيُفسد
     * الفرز صامتاً.
     */
    function orderArticles(articles) {
        return [...articles].sort((a, b) => {
            const byFeatured = (b.featured === true) - (a.featured === true);
            if (byFeatured) return byFeatured;
            const ta = a.date ? new Date(a.date).getTime() : -Infinity;
            const tb = b.date ? new Date(b.date).getTime() : -Infinity;
            return tb - ta;
        });
    }

    function render(container, articles) {
        if (!articles.length) return showEmpty(container);

        const ordered = orderArticles(articles);
        const [lead, ...rest] = ordered;

        container.innerHTML = '';
        container.appendChild(createLead(lead));
        rest.forEach((article) => container.appendChild(createArticleCard(article)));
    }

    /**
     * مقال الصدارة: غلافه بعرض العمود، وعنوانه بخط العرض.
     * عنصر <a> حقيقي — التنقّل بلوحة المفاتيح مجّاني ولا يحتاج role يدوياً.
     */
    function createLead(article) {
        const a = document.createElement('a');
        a.className = 'article-lead rv';
        a.dataset.id = article.id;
        a.href = hrefFor(article.id);

        // الصدارة فوق حدّ الشاشة ⇒ تُحمَّل بأولوية، والبقية كسولة.
        const cover = article.cover
            ? `<img class="article-lead-cover" src="${escapeAttr(assetUrl(article.cover))}" alt=""
                    loading="eager" fetchpriority="high" decoding="async">`
            : '';

        a.innerHTML = `
            ${cover}
            <h2 class="article-lead-title">${escapeHtml(article.title)}</h2>
            ${metaRow(article)}
        `;
        return a;
    }

    /**
     * مدخل في الفهرس — الشكل نفسه الذي تأخذه الصدارة، بغلاف أصغر.
     *
     * كان الشكل السابق صفّاً بمصغّرة 88×64 وعنوان بخط المتن: شكل صفحة
     * نتائج بحث. البيانات فيها مقالان بلا وصف ولا تاريخ ولا وسوم، فالعنوان
     * هو إشارة التوجيه الوحيدة الموجودة فعلاً — ومن ثمّ يأخذ المقياس كله.
     *
     * <a> حقيقي لا <article role="link">: الأخير يكسر النقر بأمر والأوسط
     * وفتح في تبويب جديد وقائمة السياق، وهي سلوكيات متصفّح لا يعوّضها
     * مستمع click يدوي.
     */
    function createArticleCard(article) {
        const a = document.createElement('a');
        a.className = 'article-card rv';
        a.dataset.id = article.id;
        a.href = hrefFor(article.id);

        const tags = (article.tags || []).slice(0, 3);

        // <a> يقبل محتوى تدفّقياً ما لم يكن بداخله عنصر تفاعلي آخر،
        // فتبقى العناوين عناوين حقيقية ويبقى مخطّط المستند سليماً.
        const cover = article.cover
            ? `<div class="article-card-image-wrapper">
                   <img class="article-card-image" src="${escapeAttr(assetUrl(article.cover))}" alt=""
                        loading="lazy" decoding="async">
               </div>`
            : '';

        a.innerHTML = `
            ${cover}
            <div class="article-card-content">
                <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
                <p class="article-card-title-en">${escapeHtml(article.title_en || '')}</p>
                <p class="article-card-description">${escapeHtml(article.description || '')}</p>
                ${metaRow(article)}
                <div class="article-card-footer">
                    <div class="article-card-tags">
                        ${tags.map((t) => `<span class="article-tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;

        return a;
    }

    /**
     * صفّ الميتا. الحقول الغائبة تُنتج عناصر فارغة يُخفيها CSS عبر :empty،
     * فلا يبقى فاصل معلّق ولا شارة فارغة — وهي الحالة الغالبة في البيانات
     * الحالية (date و category فارغان في كل المقالات).
     */
    function metaRow(article) {
        return `
            <div class="article-card-meta">
                <span class="article-card-date">${article.date
                    ? `<time datetime="${escapeAttr(article.date)}">${escapeHtml(formatDate(article.date))}</time>`
                    : ''}</span>
                <span class="article-card-category">${escapeHtml(article.category || '')}</span>
                <span class="article-read-time">${readTime(article.read_time)}</span>
            </div>
        `;
    }

    function showError(container, message) {
        container.innerHTML = `
            <div class="articles-error">
                ${warnIcon()}
                <h2 class="error-title">${T('تعذّر تحميل المقالات', 'Could not load the writing')}</h2>
                <p class="error-message">${escapeHtml(message)}</p>
                <button class="btn btn-secondary" type="button" data-reload>${T('إعادة المحاولة', 'Try again')}</button>
            </div>
        `;
        container.querySelector('[data-reload]')
            ?.addEventListener('click', () => location.reload());
    }

    function showEmpty(container) {
        container.innerHTML = `
            <div class="no-articles">
                ${warnIcon()}
                <h2 class="error-title">${T('لا توجد مقالات بعد', 'Nothing published yet')}</h2>
                <p class="error-message">${T('ستُضاف مقالات قريباً.', 'New writing is on the way.')}</p>
            </div>
        `;
    }

    /* أيقونة SVG بخطّ واحد — لا إيموجي كنظام أيقونات */
    function warnIcon() {
        return `<svg class="error-icon" width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7.5v5"></path><path d="M12 16.5h.01"></path></svg>`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return String(text || '').replace(/"/g, '&quot;');
    }

    /* الفهرس مبنيّ في جافاسكربت فلا يصله مبدّل النصّ الذي يعمل على السمات
       data-en — يُعاد بناؤه عند تبديل اللغة. */
    if (window.I18N) window.I18N.onChange(boot);
})();

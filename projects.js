/**
 * Projects List
 * يقرأ data/projects.json ويبني: شبكة المشاريع + الفلاتر (projects.html)
 * وشبكة المشاريع المختارة (index.html).
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

    /* مطلقة من الجذر: الصفحات صارت تسكن أدلّة فرعية (/projects/<slug>/)،
       والمسار النسبي كان سيطلب /projects/<slug>/data/projects.json. */
    const CONFIG = {
        dataUrl: '/data/projects.json',
        slugsUrl: '/data/slugs.json',
        gridId: 'projectsGrid',
        filtersId: 'projectFilters',
        featuredGridId: 'featuredProjectsGrid',
        errorStateId: 'errorState',
        featuredCount: 1
    };

    let allProjects = [];

    /* خريطة المعرّف ← المسار النظيف، يكتبها البناء في data/slugs.json */
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

    function hrefFor(id) {
        const record = slugMap && slugMap[id];
        if (!record || !record.slug) return `/project-details.html?id=${encodeURIComponent(id)}`;
        return `/projects/${encodeURIComponent(record.slug)}/`;
    }

    /* أغلفة data/ نسبيّة («assets/…») — تُجذَّر كي تصحّ من أي عمق */
    const assetUrl = (p) => (!p || /^(https?:)?\/\//i.test(p) || p.startsWith('/')) ? p : '/' + p;

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        if (document.getElementById(CONFIG.gridId)) loadAllProjects();
        if (document.getElementById(CONFIG.featuredGridId)) loadFeaturedProjects();
    }

    async function fetchProjects() {
        const response = await fetch(CONFIG.dataUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        return data.projects || [];
    }

    /**
     * الأحدث تاريخاً أولاً، ومن دون تاريخ في الآخر.
     * الفارغ يُعزل صراحةً بدل ترك new Date(null) ينتج NaN فيُفسد الفرز صامتاً.
     */
    function orderProjects(projects) {
        return [...projects].sort((a, b) => {
            const ta = a.date ? new Date(a.date).getTime() : -Infinity;
            const tb = b.date ? new Date(b.date).getTime() : -Infinity;
            return tb - ta;
        });
    }

    // ── projects.html ────────────────────────────────────────────────────
    async function loadAllProjects() {
        const container = document.getElementById(CONFIG.gridId);
        // رسالة الخطأ كانت تُعرض ولا تُخفى أبداً، فتبقى معلّقة فوق البطاقات
        // بعد نجاح محاولة تالية (تبديل اللغة يعيد البناء مثلاً).
        const errorState = document.getElementById(CONFIG.errorStateId);
        if (errorState) errorState.hidden = true;

        /* الشبكة والفلاتر مصيَّرتان مسبقاً في البناء بنفس الترميز حرفاً بحرف.
           لا يُعاد بناؤهما هنا — يُوصَل المستمع وحده. العلامة تُنزع فيُعاد
           البناء عند تبديل اللغة. */
        if (container.dataset.prerendered === '1') {
            delete container.dataset.prerendered;
            const filters = document.getElementById(CONFIG.filtersId);
            if (filters) delete filters.dataset.prerendered;
            /* التصيير المسبق عربيّ — انظر التعليق نفسه في js/articles-list.js */
            if (!window.I18N || window.I18N.lang !== 'en') {
                initFilters();
                announce(container.querySelectorAll('.project-card').length);
                return;
            }
        }

        try {
            await fetchSlugs();
            allProjects = orderProjects(await fetchProjects());
            renderGrid(container, allProjects);
            buildFilters(allProjects);
            initFilters();
            announce(allProjects.length);
        } catch (error) {
            console.error('Error loading projects:', error);
            showError();
        }
    }

    /**
     * قارئ الشاشة لا يرى الشبكة تمتلئ ولا تفرغ. المنطقة الحيّة تنطق ما
     * وقع: عدد ما عُرض، أو خلوّ النتيجة، أو تعذّر التحميل.
     */
    function announce(count) {
        const el = document.getElementById('gridStatus');
        if (!el) return;
        if (count === null) {
            el.textContent = T('تعذّر تحميل المشاريع.', 'Could not load projects.');
        } else if (count === 0) {
            el.textContent = T('لا نتائج.', 'No results.');
        } else {
            const n = window.I18N ? window.I18N.num(count) : count;
            el.textContent = T(`عُرض ${n} من المشاريع.`, `Showing ${count} project${count === 1 ? '' : 's'}.`);
        }
    }

    // ── index.html ───────────────────────────────────────────────────────
    async function loadFeaturedProjects() {
        const container = document.getElementById(CONFIG.featuredGridId);
        if (container.dataset.prerendered === '1') {
            delete container.dataset.prerendered;
            if (!window.I18N || window.I18N.lang !== 'en') return;
        }
        try {
            await fetchSlugs();
            const featured = orderProjects(await fetchProjects()).slice(0, CONFIG.featuredCount);
            renderGrid(container, featured);
        } catch (error) {
            console.error('Error loading featured projects:', error);
            container.innerHTML = '';   // الصفحة الرئيسية لا تُظهر خطأً مزعجاً
        }
    }

    function renderGrid(container, projects) {
        container.innerHTML = '';

        if (!projects.length) {
            container.innerHTML = `
                <div class="no-projects">
                    <h2 class="error-title">${T('لا توجد مشاريع بعد', 'Nothing here yet')}</h2>
                    <p class="error-message">${T('ستُضاف مشاريع قريباً.', 'New projects are on the way.')}</p>
                </div>`;
            return;
        }

        projects.forEach((project) => container.appendChild(createProjectCard(project)));
    }

    /**
     * بطاقة مشروع. أسماء الفئات كلها من العقد في §4 — أي تغيير هنا يستلزم
     * تغييراً مطابقاً في css/project.css.
     *
     * البطاقة كلّها قابلة للنقر عبر «الرابط الممدود»: <a> حقيقي («اقرأ
     * المزيد») يمدّ منطقة نقره فوق البطاقة بـ ::after. البديل السابق كان
     * <article role="link" tabindex="0"> ومستمع click يدوي — وهو يكسر
     * النقر بأمر والنقر الأوسط والفتح في تبويب جديد وقائمة السياق ونسخ
     * الرابط، ولا يعوّضها مستمع. ويُلغي أيضاً الحاجة إلى stopPropagation
     * على الأزرار: هي فوق الطبقة الممدودة لا داخل حاوية ملتقِطة.
     */
    function createProjectCard(project) {
        const card = document.createElement('article');
        card.className = 'project-card rv';
        // ‏data-id يقرأه مورف الانتقال: المسار النظيف لا يحمل المعرّف
        card.dataset.id = project.id;
        card.dataset.categories = JSON.stringify(project.categories || []);

        const href = hrefFor(project.id);
        const categories = (project.categories || []).slice(0, 4);
        const latinTitle = isLatin(project.title);
        // ‏last_edited تاريخ آخر مزامنة مع Notion، لا تاريخ نشر. عرضه كأنه
        // تاريخ نشر كان يناقض الترتيب أمام عين القارئ: الفرز يعتمد date
        // وحده ويضع الفارغ في الآخر، فيجلس المشروع بلا تاريخ في الأسفل
        // وهو يعرض أحدث تاريخ في الصفحة. بطاقة بلا تاريخ أصدق من بطاقة
        // بتاريخ خاطئ — و.project-card-meta تخفي الفراغ أصلاً.
        const when = project.date;

        const cover = project.cover
            ? `<div class="project-card-image-wrapper">
                   <img class="project-card-image" src="${escapeAttr(assetUrl(project.cover))}" alt=""
                        loading="lazy" decoding="async">
               </div>`
            : '';

        const preview = project.preview_link
            ? `<a class="project-card-btn project-card-btn-preview"
                  href="${escapeAttr(project.preview_link)}" target="_blank" rel="noopener">
                   ${T('معاينة المشروع', 'Live preview')}
               </a>`
            : '';

        // <bdi> يعزل اتجاه العنوان اللاتيني داخل السطر فقط. وضع dir="ltr"
        // على العنصر نفسه كان يقلب محاذاته إلى اليسار وحده فينفصل عمّا تحته.
        card.innerHTML = `
            ${cover}
            <div class="project-card-content">
                <h3 class="project-card-title">${latinTitle
                    ? `<bdi dir="ltr">${escapeHtml(project.title)}</bdi>`
                    : escapeHtml(project.title)}</h3>
                <p class="project-card-summary">${escapeHtml(project.summary || '')}</p>
                <div class="project-card-meta">
                    <span class="project-card-date">${when
                        ? `<time datetime="${escapeAttr(when)}">${escapeHtml(formatDate(when))}</time>`
                        : ''}</span>
                    <span class="project-card-read">${project.read_time ? readTime(project.read_time) : ''}</span>
                </div>
                <div class="project-card-categories">
                    ${categories.map((c) => `<span class="category-tag">${escapeHtml(c)}</span>`).join('')}
                </div>
                <div class="project-card-actions">
                    <a class="project-card-btn project-card-btn-details project-card-link"
                       href="${href}">${T('اقرأ المزيد', 'Read more')}</a>
                    ${preview}
                </div>
            </div>
        `;

        return card;
    }

    // ── الفلاتر ──────────────────────────────────────────────────────────
    function buildFilters(projects) {
        const container = document.getElementById(CONFIG.filtersId);
        if (!container) return;

        const categories = new Set();
        projects.forEach((p) => (p.categories || []).forEach((c) => categories.add(c)));

        // أسماء التصنيفات تأتي من البيانات ولا تُترجَم — «الكل» وحدها نصّ واجهة
        container.innerHTML =
            `<button class="filter-btn active" type="button" data-filter="all" aria-pressed="true">${T('الكل', 'All')}</button>`;

        [...categories].sort().forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-btn';
            btn.dataset.filter = cat;
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = cat;
            container.appendChild(btn);
        });
    }

    function initFilters() {
        const container = document.getElementById(CONFIG.filtersId);
        if (!container || container.dataset.wired) return;
        container.dataset.wired = '1';

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;

            container.querySelectorAll('.filter-btn').forEach((b) => {
                const on = b === btn;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
            });

            filterProjects(btn.dataset.filter);
        });
    }

    /**
     * الفلترة بفئة .hidden وحدها — لا أنماط display سطرية.
     * النسخة السابقة كانت تضبط card.style.display='flex' بعد كل فلترة،
     * فتتجاوز أي قيمة display في CSS إلى الأبد.
     */
    function filterProjects(filter) {
        const container = document.getElementById(CONFIG.gridId);
        if (!container) return;

        let shown = 0;
        container.querySelectorAll('.project-card').forEach((card) => {
            let categories = [];
            try { categories = JSON.parse(card.dataset.categories); } catch { categories = []; }
            const show = filter === 'all' || categories.includes(filter);
            card.classList.toggle('hidden', !show);
            if (show) shown++;
        });
        announce(shown);
    }

    function showError() {
        const grid = document.getElementById(CONFIG.gridId);
        const errorState = document.getElementById(CONFIG.errorStateId);
        if (grid) grid.innerHTML = '';
        if (errorState) errorState.hidden = false;
        announce(null);
    }

    // ── مساعدات ──────────────────────────────────────────────────────────
    function isLatin(s) {
        return /[A-Za-z]/.test(s || '') && !/[؀-ۿ]/.test(s || '');
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

    /* البطاقات مبنيّة في جافاسكربت فلا يصلها مبدّل النصّ الذي يعمل على
       السمات data-en — تُعاد بناؤها عند تبديل اللغة. */
    if (window.I18N) window.I18N.onChange(boot);
})();

/**
 * Project Details Viewer
 * يقرأ data/projects.json ويعرض مشروعاً واحداً حسب ?id=
 * لا يلمس طبقة البيانات — قراءة فقط.
 */

(function () {
    'use strict';

    /* ── جسر i18n ────────────────────────────────────────────────────────
       كل نصّ واجهة يمرّ من هنا. الاحتياطي يُبقي الصفحة عربية صحيحة لو أخفق
       تحميل js/i18n.js — لا مفاتيح ترجمة عارية. */
    const T = (ar, en) => (window.I18N ? window.I18N.t(ar, en) : ar);
    const readTime = (m, w) => (window.I18N ? window.I18N.readTime(m, w) : `${m || 5} دقائق`);
    const formatDate = (d) => (window.I18N ? window.I18N.date(d) : '');

    /* ── أيقونات المشاركة ────────────────────────────────────────────────
       شعارات العلامات الرسمية مصمتة (fill=currentColor) كي تُعرَف فوراً؛
       أما «نسخ الرابط» فأيقونة خطّية. */
    const LINK_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true"><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l2-2"/></svg>`;
    const X_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" style="fill:currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    const LINKEDIN_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" style="fill:currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
    const WHATSAPP_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" style="fill:currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 005.71 1.447h.006c6.585 0 11.946-5.359 11.949-11.945a11.85 11.85 0 00-3.48-8.404"/></svg>`;

    document.addEventListener('DOMContentLoaded', loadProject);

    /**
     * ترتيب المشاريع: الأحدث تاريخاً أولاً، ومن دون تاريخ في الآخر.
     * (خلافاً للمقالات، حقل date مملوء في بعض المشاريع — لكن ليس كلّها،
     *  فالمقارنة تعزل الفارغ صراحةً بدل ترك NaN يُفسد الفرز صامتاً.)
     */
    function orderProjects(projects) {
        return [...projects].sort((a, b) => {
            const ta = a.date ? new Date(a.date).getTime() : -Infinity;
            const tb = b.date ? new Date(b.date).getTime() : -Infinity;
            return tb - ta;
        });
    }

    async function loadProject() {
        const el = (id) => document.getElementById(id);
        const shell = el('projectShell');
        const loadingEl = el('project-loading');
        const errorEl = el('project-error');

        // الصفحة مصيَّرة مسبقاً ⇒ لا شيء يُجلب ولا شيء يُحقن
        if (shell && shell.dataset.static === '1') return initStatic();

        const projectId = new URLSearchParams(window.location.search).get('id');
        if (!projectId) return showError(loadingEl, errorEl);

        try {
            const response = await fetch('data/projects.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const data = await response.json();
            const ordered = orderProjects(data.projects || []);
            const index = ordered.findIndex((p) => p.id === projectId);
            if (index === -1) return showError(loadingEl, errorEl);

            const project = ordered[index];

            document.title = `${project.title} | ${T('محمد الزبيدي', 'Mohammed Alzobaidi')}`;

            const titleEl = el('project-title');
            if (titleEl) {
                // عناوين المشاريع إنجليزية بينما الصفحة RTL. العزل يجب أن
                // يقع داخل السطر لا على العنصر: dir="ltr" على العنوان نفسه
                // يقلب محاذاته إلى اليسار وحده، فينفصل عن صفّ الميتا وعن
                // بقية الصفحة ويلتصق بعمود الهامش. <bdi> يعزل اتجاه النصّ
                // فيُقرأ يساراً-يميناً، والكتلة تبقى محاذية لجهة البدء.
                if (isLatin(project.title)) {
                    const bdi = document.createElement('bdi');
                    bdi.setAttribute('dir', 'ltr');
                    bdi.textContent = project.title;
                    titleEl.replaceChildren(bdi);
                } else {
                    titleEl.textContent = project.title;
                }
            }

            const dateEl = el('project-date');
            if (dateEl) dateEl.textContent = formatDate(project.date);

            const readTimeEl = el('project-read-time');
            if (readTimeEl && project.read_time) {
                readTimeEl.textContent = readTime(project.read_time);
            }

            // التصنيفات وسوم غير تفاعلية ⇒ نص عادي بفواصل، لا رقائق تُوهم بأنها تُنقر
            const categoriesEl = el('project-categories');
            if (categoriesEl && project.categories && project.categories.length) {
                categoriesEl.innerHTML = project.categories
                    .map((c) => `<span class="category-tag">${escapeHtml(c)}</span>`)
                    .join('');
            }

            const coverEl = el('project-cover');
            if (coverEl && project.cover) {
                coverEl.src = project.cover;
                coverEl.alt = '';
                coverEl.hidden = false;
            }

            const previewWrapper = el('project-preview-wrapper');
            const previewLink = el('project-preview-link');
            if (previewWrapper && previewLink && project.preview_link) {
                previewLink.href = project.preview_link;
                previewWrapper.hidden = false;
            }

            const bodyEl = el('project-body');
            if (bodyEl) {
                bodyEl.innerHTML = sanitizeHtml(project.content_html);
                enhanceProse(bodyEl, project.title);
                renderShareButtons(bodyEl, project.title);
            }

            renderProjectFooter(ordered, index);
            updateMetaTags(project);

            if (loadingEl) loadingEl.hidden = true;
            if (shell) shell.hidden = false;

        } catch (error) {
            console.error('Error loading project:', error);
            showError(loadingEl, errorEl);
        }
    }

    /**
     * محتوى Notion مسطّح بلا فئات ولا يمكن تعديل البيانات — تُضاف هنا الأغلفة
     * التي يحتاجها التخطيط. كتابات المشاريع أكثف من المقالات: جداول عريضة،
     * أكواد، وتضمينات Power BI.
     */
    function enhanceProse(root, pageTitle) {
        // h1 مكرّر لعنوان الصفحة: يُخفى بصرياً والبيانات كما هي
        const firstH1 = root.querySelector('h1');
        if (firstH1 && normalise(firstH1.textContent) === normalise(pageTitle)) {
            firstH1.classList.add('is-duplicate-title');
        }

        // الجداول تُمرَّر أفقياً داخل وعائها لا داخل الصفحة
        root.querySelectorAll('table').forEach((table) => {
            if (table.parentElement !== root) return;
            const scroller = document.createElement('div');
            scroller.className = 'prose-scroll';
            scroller.setAttribute('tabindex', '0');
            scroller.setAttribute('role', 'region');
            scroller.setAttribute('aria-label', T('جدول', 'Table'));
            table.parentNode.insertBefore(scroller, table);
            scroller.appendChild(table);
        });

        // الأكواد الطويلة تُمرَّر أيضاً وتكون محطّ تركيز بلوحة المفاتيح
        root.querySelectorAll('pre').forEach((pre) => {
            pre.setAttribute('tabindex', '0');
            pre.setAttribute('role', 'region');
            pre.setAttribute('aria-label', T('كود', 'Code'));
        });

        // الصور تصبح أشكالاً، ونص alt تعليقاً إن كان ذا معنى.
        // Notion يلفّ الصورة في <p> غالباً، فتبقى حبيسة عمود القراءة ولا
        // تبلغ مسار wide — نستبدل تلك الفقرة بـ <figure> كي تخترق.
        root.querySelectorAll('img').forEach((img) => {
            img.loading = 'lazy';
            img.decoding = 'async';

            const parent = img.parentElement;
            let figure = null;

            if (parent === root) {
                figure = document.createElement('figure');
                root.insertBefore(figure, img);
                figure.appendChild(img);
            } else if (parent && parent.tagName === 'P'
                       && parent.parentElement === root
                       && parent.children.length === 1
                       && !parent.textContent.trim()) {
                figure = document.createElement('figure');
                parent.parentNode.insertBefore(figure, parent);
                figure.appendChild(img);
                parent.remove();
            } else {
                return;   // صورة داخل نصّ جارٍ — تُترك في مكانها
            }

            const alt = (img.getAttribute('alt') || '').trim();
            /* Notion يضع اسم الملف نصّاً بديلاً حين لا تعليق، فكانت أسماء
               مثل «fFlow_Diagram.png» و«image» تُطبع تعليقاتٍ مرئية تحت
               الصور. التعليق يستحقّ جملة، لا اسم ملف. */
            const looksLikeFilename =
                /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(alt) ||
                /^image[\s_-]*\d*$/i.test(alt) ||
                (!/\s/.test(alt) && /[_-]/.test(alt));
            if (alt && alt.length > 3 && !looksLikeFilename) {
                const caption = document.createElement('figcaption');
                caption.textContent = alt;
                figure.appendChild(caption);
            }
        });

        // تضمينات (Power BI وغيرها): نسبة أبعاد ثابتة بدل ارتفاع صفري
        root.querySelectorAll('iframe').forEach((frame) => {
            frame.setAttribute('loading', 'lazy');
            if (!frame.getAttribute('title')) frame.setAttribute('title', T('تضمين تفاعلي', 'Interactive embed'));
        });
    }

    function isLatin(s) {
        return /^[\u0000-\u04FF\s\p{P}\p{S}]*$/u.test(s || '') && /[A-Za-z]/.test(s || '');
    }

    function normalise(s) {
        return (s || '').replace(/[\s‏‎]+/g, ' ')
            .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
            .trim();
    }

    function renderProjectFooter(ordered, index) {
        const host = document.getElementById('projectFooter');
        if (!host) return;

        const prev = ordered[index - 1];
        const next = ordered[index + 1];

        let html = '';
        if (prev || next) {
            html += '<div class="article-nav">';
            if (prev) {
                html += `<a class="article-nav-item prev" href="project-details.html?id=${encodeURIComponent(prev.id)}">
                    <span class="article-nav-label">${T('المشروع السابق', 'Previous project')}</span>
                    <span class="article-nav-title">${escapeHtml(prev.title)}</span></a>`;
            }
            if (next) {
                html += `<a class="article-nav-item next" href="project-details.html?id=${encodeURIComponent(next.id)}">
                    <span class="article-nav-label">${T('المشروع التالي', 'Next project')}</span>
                    <span class="article-nav-title">${escapeHtml(next.title)}</span></a>`;
            }
            html += '</div>';
        }
        html += `<a class="btn btn-secondary article-footer-back" href="projects.html">${T('كل المشاريع', 'All projects')}</a>`;

        host.innerHTML = html;
        host.hidden = false;
    }


    /**
     * وضع الصفحة المصيَّرة مسبقاً.
     *
     * المحتوى كلّه في الترميز أصلاً: لا جلب ولا حقن ولا انتظار. يبقى شيئان
     * لا يستطيع البناء أن يحسمهما لأنهما يتبعان لغة الواجهة التي يختارها
     * القارئ: صياغة التاريخ وزمن القراءة. وما عداهما نصوصُ واجهة تحمل
     * data-en فتتكفّل بها طبقة i18n وحدها.
     */
    function initStatic() {
        const data = readPageData();
        if (data) {
            const dateEl = document.getElementById('project-date');
            if (dateEl && data.date) {
                const t = document.createElement('time');
                t.setAttribute('datetime', data.date);
                t.textContent = formatDate(data.date);
                dateEl.replaceChildren(t);
            }
            const rtEl = document.getElementById('project-read-time');
            if (rtEl && data.readTime) rtEl.textContent = readTime(data.readTime);
        }

        const copyBtn = document.querySelector('[data-copy-link]');
        if (copyBtn && !copyBtn.dataset.wired) {
            copyBtn.dataset.wired = '1';
            copyBtn.addEventListener('click', copyLink);
        }
    }

    function readPageData() {
        const node = document.getElementById('pageData');
        if (!node) return null;
        try { return JSON.parse(node.textContent); } catch { return null; }
    }

    function showError(loadingEl, errorEl) {
        if (loadingEl) loadingEl.hidden = true;
        if (errorEl) errorEl.hidden = false;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderShareButtons(container, title) {
        if (!container) return;
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(title || document.title);

        container.insertAdjacentHTML('beforeend', `
            <div class="share-buttons-container">
                <span class="share-buttons-label">شارك المشروع</span>
                <div class="share-buttons-row">
                    <button class="share-icon-btn" type="button" data-copy-link aria-label="${T('نسخ الرابط', 'Copy link')}">
                        ${LINK_ICON}
                    </button>
                    <a class="share-icon-btn" href="https://twitter.com/intent/tweet?text=${text}&url=${url}"
                       target="_blank" rel="noopener" aria-label="${T('مشاركة على X', 'Share on X')}">
                        ${X_ICON}
                    </a>
                    <a class="share-icon-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}"
                       target="_blank" rel="noopener" aria-label="${T('مشاركة على LinkedIn', 'Share on LinkedIn')}">
                        ${LINKEDIN_ICON}
                    </a>
                    <a class="share-icon-btn" href="https://wa.me/?text=${text}%20${url}"
                       target="_blank" rel="noopener" aria-label="${T('مشاركة على WhatsApp', 'Share on WhatsApp')}">
                        ${WHATSAPP_ICON}
                    </a>
                </div>
            </div>
        `);

        container.querySelector('[data-copy-link]')?.addEventListener('click', copyLink);
    }

    function copyLink() {
        const done = () => showCopyToast();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(done).catch(fallback);
        } else {
            fallback();
        }
        function fallback() {
            const input = document.createElement('input');
            input.value = window.location.href;
            document.body.appendChild(input);
            input.select();
            try { document.execCommand('copy'); } catch { /* لا شيء */ }
            document.body.removeChild(input);
            done();
        }
    }

    function showCopyToast() {
        document.querySelector('.copy-toast')?.remove();
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = T('تم النسخ', 'Link copied');
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('copy-toast-visible'));
        setTimeout(() => {
            toast.classList.remove('copy-toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function updateMetaTags(project) {
        const desc = document.querySelector('meta[name="description"]');
        if (desc && project.summary) desc.content = project.summary;
        setMetaTag('og:title', project.title);
        setMetaTag('og:description', project.summary);
        setMetaTag('og:image', project.cover);
        setMetaTag('og:url', window.location.href);

        /* الوصف والرابط المعياري يتبعان المحتوى أيضاً. بدون canonical تبدو
           كل تنويعة على معامل الاستعلام صفحةً مستقلّة لمحرّك البحث. */
        setNamedMeta('description', project.summary || project.title);
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            canonical.href = `https://alzobaidi.me/${'project-details.html'}?id=` +
                encodeURIComponent(project.id);
        }
    }

    /**
     * تعقيم خفيف لمحتوى Notion قبل الحقن. المصدر أنت نفسك فالخطر منخفض،
     * لكن سمة onerror ملصوقة في Notion — أو رابط javascript: — كانت
     * ستُنفَّذ في نطاق الموقع. DOMParser يحلّل في مستند خامل: لا صور
     * تُطلَب ولا سكربت يعمل أثناء التحليل.
     */
    function sanitizeHtml(html) {
        const doc = new DOMParser().parseFromString(html || '', 'text/html');
        doc.querySelectorAll('script, object, embed').forEach((n) => n.remove());
        doc.querySelectorAll('*').forEach((el) => {
            [...el.attributes].forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim().toLowerCase();
                if (name.startsWith('on')) el.removeAttribute(attr.name);
                else if ((name === 'href' || name === 'src' || name === 'xlink:href')
                         && /^(javascript|data:text\/html|vbscript):/i.test(value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        return doc.body.innerHTML;
    }

    function setNamedMeta(name, content) {
        if (!content) return;
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', name);
            document.head.appendChild(meta);
        }
        meta.content = content;
    }

    function setMetaTag(property, content) {
        if (!content) return;
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('property', property);
            document.head.appendChild(meta);
        }
        meta.content = content;
    }

    /* تبديل اللغة يعيد بناء الصفحة. المولّدان في projects.js و
       articles-list.js يفعلان هذا منذ البداية؛ صفحتا التفاصيل كانتا
       الاستثناء، فيبقى التاريخ ووقت القراءة وتسميات المشاركة وروابط
       السابق/التالي بلغةٍ والواجهة بأخرى. */
    if (window.I18N) window.I18N.onChange(loadProject);

})();

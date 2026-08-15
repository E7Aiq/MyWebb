/**
 * Cover images — مسار محلي، placeholder عند الفشل، ولا أيقونة صورة مكسورة.
 */
(function () {
    'use strict';

    const PLACEHOLDER = 'assets/images/cover-placeholder.svg';

    function shellOf(img) {
        return img.closest('.article-cover-wrapper, .article-card-image-wrapper, .project-card-image-wrapper');
    }

    function markLoaded(img) {
        img.classList.add('is-loaded');
        const shell = shellOf(img);
        if (shell) shell.classList.add('is-loaded');
    }

    /**
     * @param {HTMLImageElement} img
     * @param {string|null|undefined} src
     * @param {{ eager?: boolean, priority?: boolean }} [opts]
     */
    function apply(img, src, opts) {
        if (!img) return;

        const url = (src || '').trim();
        if (!url) {
            img.hidden = true;
            img.removeAttribute('src');
            img.classList.remove('is-loaded');
            const shell = shellOf(img);
            if (shell) shell.classList.remove('is-loaded');
            return;
        }

        img.decoding = 'async';
        if (!img.alt) img.alt = '';

        if (opts && opts.eager) {
            img.loading = 'eager';
            if (opts.priority) img.fetchPriority = 'high';
        } else {
            img.loading = 'lazy';
        }

        img.classList.remove('is-loaded');
        const shell = shellOf(img);
        if (shell) shell.classList.remove('is-loaded');
        delete img.dataset.fallback;

        img.onerror = () => {
            if (img.dataset.fallback === '1') return;
            img.dataset.fallback = '1';
            img.onerror = null;
            img.src = PLACEHOLDER;
        };

        const done = () => {
            markLoaded(img);
            img.dispatchEvent(new CustomEvent('cover:loaded', { bubbles: true }));
        };

        img.addEventListener('load', done, { once: true });
        img.hidden = false;
        img.src = url;

        if (img.complete && img.naturalWidth > 0) done();
    }

    window.COVERS = { PLACEHOLDER, apply, markLoaded };
})();

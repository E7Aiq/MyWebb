/**
 * Article Viewer
 * Loads article from articles.json and displays it
 */

document.addEventListener('DOMContentLoaded', () => {
    loadArticle();
});

/**
 * Main function to load and display article
 */
async function loadArticle() {
    // Get elements
    const titleEl = document.getElementById('article-title');
    const dateEl = document.getElementById('article-date');
    const coverEl = document.getElementById('article-cover');
    const bodyEl = document.getElementById('article-body');
    const categoryEl = document.getElementById('article-category');
    const readTimeEl = document.getElementById('article-read-time');
    const loadingEl = document.getElementById('article-loading');
    const errorEl = document.getElementById('article-error');

    // Get article ID from URL
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) {
        showError(loadingEl, errorEl);
        return;
    }

    try {
        // Fetch articles.json
        const response = await fetch('data/articles.json');
        
        if (!response.ok) {
            throw new Error('Failed to fetch articles');
        }

        const data = await response.json();
        
        // Find the article by ID
        const article = data.articles.find(a => a.id === articleId);

        if (!article) {
            showError(loadingEl, errorEl);
            return;
        }

        // Update page title
        document.title = `${article.title} | محمد الزبيدي`;

        // Inject title
        if (titleEl) {
            titleEl.textContent = article.title;
        }

        // Inject date
        if (dateEl && article.date) {
            dateEl.textContent = formatDate(article.date);
        }

        // Inject category
        if (categoryEl && article.category) {
            categoryEl.textContent = article.category;
        }

        // Inject read time
        if (readTimeEl && article.read_time) {
            readTimeEl.textContent = `${article.read_time} دقائق قراءة`;
        }

        // Inject cover image
        if (coverEl && article.cover) {
            coverEl.src = article.cover;
            coverEl.alt = article.title;
            coverEl.style.display = 'block';
        }

        // Inject HTML content
        if (bodyEl) {
            bodyEl.innerHTML = article.content_html;
        }

        // Render share section
        renderShareSection(bodyEl, article.title);

        // Update meta tags
        updateMetaTags(article);

        // Hide loading, show content
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading article:', error);
        showError(loadingEl, errorEl);
    }
}

/**
 * Format date to Arabic
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    return date.toLocaleDateString('ar-SA', options);
}

/**
 * Show error state
 */
function showError(loadingEl, errorEl) {
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
    if (errorEl) {
        errorEl.style.display = 'block';
    }
}

/**
 * Render share buttons section after article body
 */
function renderShareSection(container, title) {
    if (!container) return;

    const pageUrl = encodeURIComponent(window.location.href);
    const pageTitle = encodeURIComponent(title || document.title);

    const shareHTML = `
        <div class="article-share">
            <span class="article-share-label">شارك المقال:</span>
            <button class="share-btn" onclick="copyArticleLink()" title="نسخ الرابط">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
                </svg>
            </button>
            <a class="share-btn" href="https://twitter.com/intent/tweet?text=${pageTitle}&url=${pageUrl}" target="_blank" rel="noopener" title="مشاركة على X">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-twitter-x" viewBox="0 0 16 16">
                    <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z"/>
                </svg>
            </a>
            <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}" target="_blank" rel="noopener" title="مشاركة على LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.342 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                </svg>
            </a>
            <a class="share-btn" href="https://wa.me/?text=${pageTitle}%20-%20${pageUrl}" target="_blank" rel="noopener" title="مشاركة على WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.049-.197-.099-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
            </a>
        </div>
    `;

    container.insertAdjacentHTML('afterend', shareHTML);
}

/**
 * Copy current page URL to clipboard with toast feedback
 */
function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        showCopyToast();
    }).catch(() => {
        // Fallback for older browsers
        const input = document.createElement('input');
        input.value = window.location.href;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showCopyToast();
    });
}

/**
 * Show "تم النسخ!" toast notification
 */
function showCopyToast() {
    // Remove existing toast if any
    const existing = document.querySelector('.copy-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = 'تم النسخ!';
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('copy-toast-visible');
    });

    setTimeout(() => {
        toast.classList.remove('copy-toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * Update meta tags for SEO and social sharing
 */
function updateMetaTags(article) {
    // Description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && article.description) {
        descMeta.content = article.description;
    }

    // Open Graph
    setMetaTag('og:title', article.title);
    setMetaTag('og:description', article.description);
    setMetaTag('og:image', article.cover);
    setMetaTag('og:url', window.location.href);
}

/**
 * Helper to set meta tag content
 */
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

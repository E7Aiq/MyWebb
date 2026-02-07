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

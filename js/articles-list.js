/**
 * Articles List - Frontend Logic
 * Fetches articles from data/articles.json and displays them
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        dataUrl: 'data/articles.json',
        containerId: 'articles-grid',
        defaultImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop'
    };

    /**
     * Initialize the articles list on page load
     */
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        const container = document.getElementById(CONFIG.containerId);
        
        if (!container) {
            console.error(`Container #${CONFIG.containerId} not found`);
            return;
        }

        // Show loading state
        showLoading(container);

        try {
            const articles = await fetchArticles();
            renderArticles(container, articles);
        } catch (error) {
            console.error('Error loading articles:', error);
            showError(container, 'حدث خطأ في تحميل المقالات');
        }
    }

    /**
     * Fetch articles from JSON file
     */
    async function fetchArticles() {
        const response = await fetch(CONFIG.dataUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.articles || [];
    }

    /**
     * Render articles to the container
     */
    function renderArticles(container, articles) {
        if (!articles || articles.length === 0) {
            showEmpty(container);
            return;
        }

        // Sort: featured first, then by date
        const sortedArticles = [...articles].sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return new Date(b.date) - new Date(a.date);
        });

        // Clear container and add articles
        container.innerHTML = '';
        
        sortedArticles.forEach((article, index) => {
            const card = createArticleCard(article, index);
            container.appendChild(card);
        });

        // Trigger animations
        animateCards();
    }

    /**
     * Create an article card element
     */
    function createArticleCard(article, index) {
        const card = document.createElement('article');
        card.className = `article-card${article.featured ? ' featured' : ''} fade-in`;
        card.dataset.id = article.id;
        card.style.animationDelay = `${index * 0.1}s`;

        const formattedDate = formatDate(article.date);
        const tags = (article.tags || []).slice(0, 3);
        const coverImage = article.cover || CONFIG.defaultImage;

        card.innerHTML = `
            <div class="article-card-image-wrapper">
                <img 
                    src="${coverImage}" 
                    alt="${escapeHtml(article.title)}"
                    class="article-card-image"
                    loading="lazy"
                    onerror="this.src='${CONFIG.defaultImage}'"
                >
            </div>
            <div class="article-card-content">
                <div class="article-card-meta">
                    ${article.category ? `<span class="article-card-category">${escapeHtml(article.category)}</span>` : ''}
                    <span class="article-card-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formattedDate}
                    </span>
                </div>
                <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
                ${article.title_en ? `<p class="article-card-title-en">${escapeHtml(article.title_en)}</p>` : ''}
                <p class="article-card-description">${escapeHtml(article.description || '')}</p>
                <div class="article-card-footer">
                    <div class="article-card-tags">
                        ${tags.map(tag => `<span class="article-tag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                    <span class="article-read-time">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${article.read_time || 5} دقائق
                    </span>
                </div>
            </div>
        `;

        // Add click handler to navigate to article page
        card.addEventListener('click', () => {
            window.location.href = `article.html?id=${article.id}`;
        });

        // Keyboard accessibility
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'link');
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.location.href = `article.html?id=${article.id}`;
            }
        });

        return card;
    }

    /**
     * Show loading state
     */
    function showLoading(container) {
        container.innerHTML = `
            <div class="articles-loading">
                <div class="loading-spinner"></div>
                <p>جاري تحميل المقالات...</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    function showError(container, message) {
        container.innerHTML = `
            <div class="articles-error">
                <div class="error-icon">⚠️</div>
                <h3 class="error-title">عذراً</h3>
                <p class="error-message">${escapeHtml(message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
            </div>
        `;
    }

    /**
     * Show empty state
     */
    function showEmpty(container) {
        container.innerHTML = `
            <div class="no-articles">
                <div class="no-articles-icon">📝</div>
                <h3 class="error-title">لا توجد مقالات حالياً</h3>
                <p class="error-message">سيتم إضافة مقالات قريباً، تابعنا!</p>
            </div>
        `;
    }

    /**
     * Format date to Arabic
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Animate cards on scroll
     */
    function animateCards() {
        const cards = document.querySelectorAll('.article-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        cards.forEach(card => observer.observe(card));
    }

})();

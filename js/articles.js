/**
 * نظام عرض قائمة المقالات
 * يقرأ البيانات من data/articles.json
 */

// متغير لتخزين المقالات
let articlesData = [];

/**
 * تحميل المقالات من ملف JSON
 */
async function loadArticles() {
    try {
        const response = await fetch('data/articles.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        articlesData = data.articles || [];
        
        console.log(`✅ تم تحميل ${articlesData.length} مقال`);
        return articlesData;
        
    } catch (error) {
        console.error('❌ خطأ في تحميل المقالات:', error);
        return [];
    }
}

/**
 * عرض المقالات في الصفحة
 * @param {string} containerId - معرف العنصر الحاوي
 */
async function renderArticles(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }
    
    // عرض حالة التحميل
    container.innerHTML = `
        <div class="articles-loading">
            <div class="loading-spinner"></div>
            <p>جاري تحميل المقالات...</p>
        </div>
    `;
    
    // تحميل المقالات
    const articles = await loadArticles();
    
    // التحقق من وجود مقالات
    if (articles.length === 0) {
        container.innerHTML = `
            <div class="no-articles">
                <div class="no-articles-icon">📝</div>
                <h3 class="error-title">لا توجد مقالات حالياً</h3>
                <p class="error-message">سيتم إضافة مقالات قريباً، تابعنا!</p>
            </div>
        `;
        return;
    }
    
    // ترتيب المقالات: المميزة أولاً، ثم حسب التاريخ
    const sortedArticles = [...articles].sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    // بناء HTML
    container.innerHTML = `
        <div class="articles-grid">
            ${sortedArticles.map(article => createArticleCard(article)).join('')}
        </div>
    `;
    
    // إضافة أحداث النقر
    addCardClickEvents(container);
    
    // تطبيق الأنيميشن
    applyAnimations();
}

/**
 * إنشاء بطاقة مقال
 * @param {Object} article - بيانات المقال
 * @returns {string} - HTML البطاقة
 */
function createArticleCard(article) {
    const formattedDate = formatDate(article.date);
    const defaultImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop';
    
    // تقصير الوسوم لعرض 3 فقط
    const displayTags = (article.tags || []).slice(0, 3);
    
    return `
        <article class="article-card ${article.featured ? 'featured' : ''} fade-in" data-id="${article.id}">
            <div class="article-card-image-wrapper">
                <img 
                    src="${article.cover || defaultImage}" 
                    alt="${article.title}"
                    class="article-card-image"
                    loading="lazy"
                    onerror="this.src='${defaultImage}'"
                >
            </div>
            <div class="article-card-content">
                <div class="article-card-meta">
                    ${article.category ? `<span class="article-card-category">${article.category}</span>` : ''}
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
                <h3 class="article-card-title">${article.title}</h3>
                ${article.title_en ? `<p class="article-card-title-en">${article.title_en}</p>` : ''}
                <p class="article-card-description">${article.description || ''}</p>
                <div class="article-card-footer">
                    <div class="article-card-tags">
                        ${displayTags.map(tag => `<span class="article-tag">${tag}</span>`).join('')}
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
        </article>
    `;
}

/**
 * إضافة أحداث النقر على البطاقات
 * @param {HTMLElement} container - العنصر الحاوي
 */
function addCardClickEvents(container) {
    const cards = container.querySelectorAll('.article-card');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            const articleId = this.dataset.id;
            if (articleId) {
                window.location.href = `article.html?id=${articleId}`;
            }
        });
        
        // إضافة تأثير الكيبورد للوصول
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'link');
        card.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.click();
            }
        });
    });
}

/**
 * عرض المقالات المميزة (للصفحة الرئيسية)
 * @param {string} containerId - معرف العنصر الحاوي
 * @param {number} limit - عدد المقالات المعروضة
 */
async function renderFeaturedArticles(containerId, limit = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const articles = await loadArticles();
    
    // فلترة المقالات المميزة
    const featured = articles
        .filter(a => a.featured)
        .slice(0, limit);
    
    // إذا لم توجد مقالات مميزة، أخذ أحدث المقالات
    const displayArticles = featured.length > 0 
        ? featured 
        : articles.slice(0, limit);
    
    if (displayArticles.length === 0) {
        container.closest('section')?.style.setProperty('display', 'none');
        return;
    }
    
    container.innerHTML = displayArticles.map(article => createArticleCard(article)).join('');
    addCardClickEvents(container);
    applyAnimations();
}

/**
 * تنسيق التاريخ بالعربية
 * @param {string} dateString - التاريخ
 * @returns {string} - التاريخ المنسق
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
 * تطبيق الأنيميشن على العناصر
 */
function applyAnimations() {
    const elements = document.querySelectorAll('.fade-in:not(.animated)');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('animated');
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    elements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
}

// تصدير الدوال للاستخدام الخارجي
window.renderArticles = renderArticles;
window.renderFeaturedArticles = renderFeaturedArticles;
window.loadArticles = loadArticles;

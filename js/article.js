/**
 * نظام عرض المقال الواحد
 * يقرأ المقال حسب الـ ID من URL
 */

/**
 * تحميل وعرض المقال
 */
async function loadArticle() {
    const container = document.getElementById('articleContent');
    if (!container) {
        console.error('Article container not found');
        return;
    }
    
    // الحصول على ID المقال من URL
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');
    
    if (!articleId) {
        showError(container, 'لم يتم تحديد المقال', 'يرجى اختيار مقال من صفحة المقالات');
        return;
    }
    
    // عرض حالة التحميل
    container.innerHTML = `
        <div class="article-loading">
            <div class="loading-spinner"></div>
            <p>جاري تحميل المقال...</p>
        </div>
    `;
    
    try {
        // تحميل البيانات
        const response = await fetch('data/articles.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const articles = data.articles || [];
        
        // البحث عن المقال
        const article = articles.find(a => a.id === articleId);
        
        if (!article) {
            showError(container, 'المقال غير موجود', 'لم نتمكن من العثور على المقال المطلوب');
            return;
        }
        
        // تحديث عنوان الصفحة
        document.title = `${article.title} | محمد الزبيدي`;
        
        // تحديث meta description
        updateMetaDescription(article.description);
        
        // عرض المقال
        renderArticle(container, article, articles);
        
        // تطبيق الأنيميشن
        applyAnimations();
        
        console.log('✅ تم تحميل المقال:', article.title);
        
    } catch (error) {
        console.error('❌ خطأ في تحميل المقال:', error);
        showError(container, 'حدث خطأ', 'تعذر تحميل المقال. يرجى المحاولة لاحقاً.');
    }
}

/**
 * عرض المقال
 * @param {HTMLElement} container - العنصر الحاوي
 * @param {Object} article - بيانات المقال
 * @param {Array} allArticles - جميع المقالات (للتنقل)
 */
function renderArticle(container, article, allArticles) {
    const formattedDate = formatDate(article.date);
    const defaultImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=600&fit=crop';
    
    // الحصول على المقال السابق والتالي
    const currentIndex = allArticles.findIndex(a => a.id === article.id);
    const prevArticle = allArticles[currentIndex + 1]; // الأقدم
    const nextArticle = allArticles[currentIndex - 1]; // الأحدث
    
    container.innerHTML = `
        <article class="article-page">
            <!-- رأس المقال -->
            <header class="article-header fade-in">
                <div class="article-header-meta">
                    ${article.category ? `<span class="article-header-category">${article.category}</span>` : ''}
                    <span class="article-header-date">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formattedDate}
                    </span>
                    <span class="article-header-read-time">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${article.read_time || 5} دقائق قراءة
                    </span>
                </div>
                <h1 class="article-title">${article.title}</h1>
                ${article.title_en ? `<p class="article-title-en">${article.title_en}</p>` : ''}
                ${article.description ? `<p class="article-description">${article.description}</p>` : ''}
            </header>
            
            <!-- صورة الغلاف -->
            ${article.cover ? `
                <img 
                    src="${article.cover}" 
                    alt="${article.title}"
                    class="article-cover slide-up"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            ` : ''}
            
            <!-- محتوى المقال -->
            <div class="article-content slide-up">
                ${renderContent(article.content)}
                
                <!-- الوسوم -->
                ${article.tags && article.tags.length > 0 ? `
                    <div class="article-tags-section">
                        ${article.tags.map(tag => `<span class="article-tag">#${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                <!-- أزرار المشاركة -->
                <div class="article-share">
                    <span class="article-share-label">شارك المقال:</span>
                    <button class="share-btn" onclick="shareOnTwitter()" title="شارك على X" aria-label="شارك على X">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </button>
                    <button class="share-btn" onclick="shareOnLinkedIn()" title="شارك على LinkedIn" aria-label="شارك على LinkedIn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                    </button>
                    <button class="share-btn" onclick="copyArticleLink()" title="نسخ الرابط" aria-label="نسخ الرابط">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- التنقل بين المقالات -->
            <nav class="article-navigation">
                ${prevArticle ? `
                    <a href="article.html?id=${prevArticle.id}" class="article-nav-item prev">
                        <span class="article-nav-label">← المقال السابق</span>
                        <span class="article-nav-title">${prevArticle.title}</span>
                    </a>
                ` : '<div></div>'}
                ${nextArticle ? `
                    <a href="article.html?id=${nextArticle.id}" class="article-nav-item next">
                        <span class="article-nav-label">المقال التالي →</span>
                        <span class="article-nav-title">${nextArticle.title}</span>
                    </a>
                ` : '<div></div>'}
            </nav>
        </article>
    `;
}

/**
 * تحويل المحتوى إلى HTML
 * @param {Array} content - مصفوفة المحتوى
 * @returns {string} - HTML
 */
function renderContent(content) {
    if (!content || !Array.isArray(content)) return '<p>لا يوجد محتوى متاح.</p>';
    
    let html = '';
    let inList = false;
    let listType = '';
    
    content.forEach((block, index) => {
        // التعامل مع القوائم
        if (block.type === 'bullet' || block.type === 'number') {
            if (!inList) {
                inList = true;
                listType = block.type === 'bullet' ? 'ul' : 'ol';
                html += `<${listType}>`;
            }
            html += `<li>${block.content}</li>`;
            
            // التحقق إذا العنصر التالي ليس من القائمة
            const nextBlock = content[index + 1];
            if (!nextBlock || (nextBlock.type !== 'bullet' && nextBlock.type !== 'number')) {
                html += `</${listType}>`;
                inList = false;
            }
            return;
        }
        
        // إغلاق القائمة إذا كانت مفتوحة
        if (inList) {
            html += `</${listType}>`;
            inList = false;
        }
        
        // معالجة أنواع المحتوى الأخرى
        switch (block.type) {
            case 'paragraph':
                html += `<p>${block.content}</p>`;
                break;
                
            case 'heading_1':
            case 'heading_2':
                html += `<h2>${block.content}</h2>`;
                break;
                
            case 'heading_3':
                html += `<h3>${block.content}</h3>`;
                break;
                
            case 'code':
                html += `
                    <pre><code class="language-${block.language || 'plaintext'}">${escapeHtml(block.content)}</code></pre>
                `;
                break;
                
            case 'quote':
                html += `<blockquote>${block.content}</blockquote>`;
                break;
                
            case 'callout':
                html += `
                    <div class="article-callout">
                        <span class="article-callout-icon">${block.icon || '💡'}</span>
                        <div class="article-callout-content">${block.content}</div>
                    </div>
                `;
                break;
                
            case 'image':
                html += `
                    <img src="${block.url}" alt="${block.caption || ''}" loading="lazy">
                    ${block.caption ? `<p class="image-caption">${block.caption}</p>` : ''}
                `;
                break;
                
            case 'divider':
                html += '<hr class="article-divider">';
                break;
                
            default:
                // تجاهل الأنواع غير المدعومة
                break;
        }
    });
    
    return html;
}

/**
 * تنسيق التاريخ
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
 * تحويل الرموز الخاصة لـ HTML entities
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * عرض رسالة خطأ
 */
function showError(container, title, message) {
    container.innerHTML = `
        <div class="article-error">
            <div class="error-icon">😕</div>
            <h3 class="error-title">${title}</h3>
            <p class="error-message">${message}</p>
            <a href="articles.html" class="btn btn-primary">عرض جميع المقالات</a>
        </div>
    `;
}

/**
 * تحديث meta description
 */
function updateMetaDescription(description) {
    if (!description) return;
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', description);
    } else {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        metaDesc.content = description;
        document.head.appendChild(metaDesc);
    }
}

/**
 * تطبيق الأنيميشن
 */
function applyAnimations() {
    const elements = document.querySelectorAll('.fade-in, .slide-up');
    
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = el.classList.contains('slide-up') ? 'translateY(30px)' : 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 150);
    });
}

// ==================== دوال المشاركة ====================

/**
 * مشاركة على X (Twitter)
 */
function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank', 'width=550,height=420');
}

/**
 * مشاركة على LinkedIn
 */
function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=550,height=420');
}

/**
 * نسخ رابط المقال
 */
function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => {
            // عرض رسالة نجاح
            showToast('تم نسخ الرابط! 📋');
        })
        .catch(err => {
            console.error('فشل نسخ الرابط:', err);
            // fallback للمتصفحات القديمة
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('تم نسخ الرابط! 📋');
        });
}

/**
 * عرض رسالة Toast
 */
function showToast(message) {
    // إزالة Toast سابق إن وجد
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();
    
    // إنشاء Toast جديد
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--accent-primary);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        animation: toastIn 0.3s ease;
    `;
    
    // إضافة الأنيميشن
    const style = document.createElement('style');
    style.textContent = `
        @keyframes toastIn {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // إزالة بعد 3 ثواني
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', loadArticle);

// تصدير الدوال
window.shareOnTwitter = shareOnTwitter;
window.shareOnLinkedIn = shareOnLinkedIn;
window.copyArticleLink = copyArticleLink;

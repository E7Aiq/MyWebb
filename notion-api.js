// Notion Embed Configuration
const NOTION_EMBED_URL = "PUT_NOTION_PUBLIC_URL_HERE";

/**
 * Render Notion embed in specified container
 * @param {string} containerId - ID of the container element
 */
function renderNotionEmbed(containerId) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container with ID "${containerId}" not found`);
        return;
    }
    
    // Check if URL is configured
    if (NOTION_EMBED_URL === "PUT_NOTION_PUBLIC_URL_HERE") {
        showFallback(container);
        return;
    }
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.className = 'notion-embed';
    iframe.src = NOTION_EMBED_URL;
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'مقالات محمد الزبيدي');
    
    // Handle iframe load
    iframe.onload = () => {
        // Remove loading skeleton
        const loadingElement = container.querySelector('.notion-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    };
    
    // Handle iframe error
    iframe.onerror = () => {
        showFallback(container);
    };
    
    // Append iframe to container
    container.appendChild(iframe);
    
    // Set timeout fallback
    setTimeout(() => {
        const loadingElement = container.querySelector('.notion-loading');
        if (loadingElement && loadingElement.style.display !== 'none') {
            showFallback(container);
        }
    }, 10000); // 10 seconds timeout
}

/**
 * Show fallback message when embed fails
 * @param {HTMLElement} container - Container element
 */
function showFallback(container) {
    container.innerHTML = `
        <div class="notion-fallback">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted); margin-bottom: 1rem;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                لم يتم تكوين رابط Notion بعد، أو حدث خطأ في التحميل
            </p>
            <p style="color: var(--text-muted); font-size: 0.875rem;">
                يمكنك زيارة صفحة المقالات مباشرة عبر الرابط أدناه
            </p>
            <a href="${NOTION_EMBED_URL !== 'PUT_NOTION_PUBLIC_URL_HERE' ? NOTION_EMBED_URL : '#'}" 
               class="btn btn-primary" 
               target="_blank" 
               rel="noopener"
               style="margin-top: 1.5rem; ${NOTION_EMBED_URL === 'PUT_NOTION_PUBLIC_URL_HERE' ? 'pointer-events: none; opacity: 0.5;' : ''}">
                فتح المقالات في نافذة جديدة
            </a>
        </div>
    `;
}

/**
 * Initialize Notion embed with custom configuration
 * @param {Object} config - Configuration object
 * @param {string} config.url - Notion public URL
 * @param {string} config.containerId - Container element ID
 */
function initNotionEmbed(config) {
    if (config.url) {
        NOTION_EMBED_URL = config.url;
    }
    
    renderNotionEmbed(config.containerId);
}

// Export functions
window.renderNotionEmbed = renderNotionEmbed;
window.initNotionEmbed = initNotionEmbed;
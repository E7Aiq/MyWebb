/**
 * Project Details Viewer
 * Loads project from data/projects.json and displays full content.
 * URL format: project-details.html?id=<project_id>
 */

document.addEventListener('DOMContentLoaded', () => {
    loadProject();
});

/**
 * Main function to load and display project details
 */
async function loadProject() {
    // Get elements
    const titleEl = document.getElementById('project-title');
    const dateEl = document.getElementById('project-date');
    const coverEl = document.getElementById('project-cover');
    const bodyEl = document.getElementById('project-body');
    const categoriesEl = document.getElementById('project-categories');
    const readTimeEl = document.getElementById('project-read-time');
    const previewWrapper = document.getElementById('project-preview-wrapper');
    const previewLink = document.getElementById('project-preview-link');
    const loadingEl = document.getElementById('project-loading');
    const errorEl = document.getElementById('project-error');

    // Get project ID from URL
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');

    if (!projectId) {
        showError(loadingEl, errorEl);
        return;
    }

    try {
        // Fetch projects.json
        const response = await fetch('data/projects.json');

        if (!response.ok) {
            throw new Error('Failed to fetch projects');
        }

        const data = await response.json();

        // Find the project by ID
        const project = data.projects.find(p => p.id === projectId);

        if (!project) {
            showError(loadingEl, errorEl);
            return;
        }

        // Update page title
        document.title = `${project.title} | محمد الزبيدي`;

        // Inject title
        if (titleEl) {
            titleEl.textContent = project.title;
        }

        // Inject date
        if (dateEl && project.date) {
            dateEl.textContent = formatDate(project.date);
        }

        // Inject read time
        if (readTimeEl && project.read_time) {
            readTimeEl.textContent = `${project.read_time} دقائق قراءة`;
        }

        // Inject categories
        if (categoriesEl && project.categories && project.categories.length > 0) {
            categoriesEl.innerHTML = project.categories
                .map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`)
                .join('');
        }

        // Inject cover image
        if (coverEl && project.cover) {
            coverEl.src = project.cover;
            coverEl.alt = project.title;
            coverEl.style.display = 'block';
        }

        // Inject preview link
        if (previewWrapper && previewLink && project.preview_link) {
            previewLink.href = project.preview_link;
            previewWrapper.style.display = 'flex';
        }

        // Inject HTML content
        if (bodyEl) {
            bodyEl.innerHTML = project.content_html;
        }

        // Update meta tags
        updateMetaTags(project);

        // Hide loading, show content
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading project:', error);
        showError(loadingEl, errorEl);
    }
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
function updateMetaTags(project) {
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && project.summary) {
        descMeta.content = project.summary;
    }

    setMetaTag('og:title', project.title);
    setMetaTag('og:description', project.summary);
    setMetaTag('og:image', project.cover);
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

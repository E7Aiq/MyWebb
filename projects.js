/**
 * Projects List - Frontend Logic
 * Fetches projects from data/projects.json and displays them.
 * Also handles the featured projects grid on the homepage.
 */

(function () {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        dataUrl: 'data/projects.json',
        gridId: 'projectsGrid',
        filtersId: 'projectFilters',
        featuredGridId: 'featuredProjectsGrid',
        errorStateId: 'errorState',
        defaultImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
    };

    let allProjects = [];
    let currentFilter = 'all';

    // ============================================
    // INITIALIZATION
    // ============================================

    document.addEventListener('DOMContentLoaded', () => {
        const projectsGrid = document.getElementById(CONFIG.gridId);
        const featuredGrid = document.getElementById(CONFIG.featuredGridId);

        if (projectsGrid) {
            // We are on projects.html
            loadAllProjects();
        }

        if (featuredGrid) {
            // We are on index.html
            loadFeaturedProjects();
        }
    });

    // ============================================
    // DATA FETCHING
    // ============================================

    async function fetchProjects() {
        const response = await fetch(CONFIG.dataUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.projects || [];
    }

    // ============================================
    // PROJECTS PAGE (projects.html)
    // ============================================

    async function loadAllProjects() {
        const container = document.getElementById(CONFIG.gridId);
        if (!container) return;

        try {
            allProjects = await fetchProjects();

            // Sort by date descending
            allProjects.sort((a, b) => new Date(b.date) - new Date(a.date));

            renderProjectsGrid(container, allProjects);
            buildDynamicFilters(allProjects);
            initializeFilters();

        } catch (error) {
            console.error('❌ Error loading projects:', error);
            showError();
        }
    }

    function renderProjectsGrid(container, projects) {
        container.innerHTML = '';

        if (!projects || projects.length === 0) {
            container.innerHTML = `
                <div class="no-projects">
                    <div class="no-projects-icon">📂</div>
                    <h3 class="error-title">لا توجد مشاريع حالياً</h3>
                    <p class="error-message">سيتم إضافة مشاريع قريباً، تابعنا!</p>
                </div>
            `;
            return;
        }

        projects.forEach((project, index) => {
            const card = createProjectCard(project, index);
            container.appendChild(card);
        });

        animateCards();
    }

    // ============================================
    // FEATURED PROJECTS (index.html)
    // ============================================

    async function loadFeaturedProjects() {
        const container = document.getElementById(CONFIG.featuredGridId);
        if (!container) return;

        try {
            const projects = await fetchProjects();
            // Show latest 3 projects on homepage
            const featured = projects
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 3);

            renderProjectsGrid(container, featured);
        } catch (error) {
            console.error('Error loading featured projects:', error);
        }
    }

    // ============================================
    // PROJECT CARD
    // ============================================

    function createProjectCard(project, index) {
        const card = document.createElement('article');
        card.className = 'project-card fade-in';
        card.dataset.categories = JSON.stringify(project.categories || []);
        card.style.animationDelay = `${index * 0.1}s`;

        const coverImage = project.cover || CONFIG.defaultImage;
        const formattedDate = formatDate(project.date);
        const categories = (project.categories || []).slice(0, 4);
        const summary = escapeHtml(project.summary || '');

        // Preview link button
        const previewBtnHtml = project.preview_link ? `
            <a href="${escapeHtml(project.preview_link)}" class="project-card-btn project-card-btn-preview" target="_blank" rel="noopener" onclick="event.stopPropagation();">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                معاينة المشروع
            </a>
        ` : '';

        card.innerHTML = `
            <div class="project-card-image-wrapper">
                <img
                    src="${coverImage}"
                    alt="${escapeHtml(project.title)}"
                    class="project-card-image"
                    loading="lazy"
                    onerror="this.src='${CONFIG.defaultImage}'"
                >
            </div>
            <div class="project-card-content">
                <div class="project-card-meta">
                    <span class="project-card-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formattedDate}
                    </span>
                </div>
                <h3 class="project-card-title">${escapeHtml(project.title)}</h3>
                <p class="project-card-summary">${summary}</p>
                <div class="project-card-categories">
                    ${categories.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('')}
                </div>
                <div class="project-card-actions">
                    <a href="project-details.html?id=${project.id}" class="project-card-btn project-card-btn-details" onclick="event.stopPropagation();">
                        اقرأ المزيد
                    </a>
                    ${previewBtnHtml}
                </div>
            </div>
        `;

        // Card click navigates to details
        card.addEventListener('click', () => {
            window.location.href = `project-details.html?id=${project.id}`;
        });

        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'link');
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.location.href = `project-details.html?id=${project.id}`;
            }
        });

        return card;
    }

    // ============================================
    // DYNAMIC FILTERS
    // ============================================

    function buildDynamicFilters(projects) {
        const filtersContainer = document.getElementById(CONFIG.filtersId);
        if (!filtersContainer) return;

        // Collect all unique categories
        const categoriesSet = new Set();
        projects.forEach(p => {
            (p.categories || []).forEach(cat => categoriesSet.add(cat));
        });

        // Keep "الكل" button, then add one button per category
        filtersContainer.innerHTML = '<button class="filter-btn active" data-filter="all">الكل</button>';

        [...categoriesSet].sort().forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.filter = cat;
            btn.textContent = cat;
            filtersContainer.appendChild(btn);
        });
    }

    function initializeFilters() {
        const filtersContainer = document.getElementById(CONFIG.filtersId);
        if (!filtersContainer) return;

        filtersContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;

            // Update active state
            filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.dataset.filter;
            filterProjects(currentFilter);
        });
    }

    function filterProjects(filter) {
        const container = document.getElementById(CONFIG.gridId);
        if (!container) return;

        const cards = container.querySelectorAll('.project-card');

        cards.forEach(card => {
            let categories = [];
            try {
                categories = JSON.parse(card.dataset.categories);
            } catch (e) { categories = []; }

            if (filter === 'all' || categories.includes(filter)) {
                card.classList.remove('hidden');
                card.style.display = 'flex';
            } else {
                card.classList.add('hidden');
                setTimeout(() => {
                    if (card.classList.contains('hidden')) {
                        card.style.display = 'none';
                    }
                }, 300);
            }
        });
    }

    // ============================================
    // HELPERS
    // ============================================

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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError() {
        const errorState = document.getElementById(CONFIG.errorStateId);
        const projectsGrid = document.getElementById(CONFIG.gridId);

        if (projectsGrid) projectsGrid.innerHTML = '';
        if (errorState) errorState.style.display = 'block';
    }

    function animateCards() {
        const cards = document.querySelectorAll('.project-card');
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

let allProjects = [];
let currentFilter = 'all';

// Fetch projects from JSON file
async function fetchProjects() {
    try {
        const response = await fetch('data/projects.json');
        if (!response.ok) {
            throw new Error('Failed to fetch projects');
        }
        const data = await response.json();
        allProjects = data;
        return data;
    } catch (error) {
        console.error('Error fetching projects:', error);
        showError();
        return [];
    }
}

// Create project card HTML
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card fade-in';
    card.setAttribute('data-tools', JSON.stringify(project.tools));
    
    const titleEnHtml = project.title_en ? 
        `<p class="project-title-en">${project.title_en}</p>` : '';
    
    const metricHtml = project.metric_value ? `
        <div class="project-metric">
            <div class="metric-value">${project.metric_value}</div>
            <div class="metric-label">${project.metric_label_ar}</div>
            ${project.metric_note_ar ? `<div class="metric-note">${project.metric_note_ar}</div>` : ''}
        </div>
    ` : '';
    
    const linksHtml = (project.github_url || project.live_url) ? `
        <div class="project-links">
            ${project.github_url ? `<a href="${project.github_url}" class="project-link" target="_blank" rel="noopener">GitHub</a>` : ''}
            ${project.live_url ? `<a href="${project.live_url}" class="project-link" target="_blank" rel="noopener">عرض المشروع</a>` : ''}
        </div>
    ` : '';
    
    card.innerHTML = `
        <img src="${project.image}" alt="${project.title_ar}" class="project-image" loading="lazy">
        <div class="project-content">
            <h3 class="project-title">${project.title_ar}</h3>
            ${titleEnHtml}
            <p class="project-description">${project.description_ar}</p>
            <div class="project-tools">
                ${project.tools.map(tool => `<span class="tool-tag">${tool}</span>`).join('')}
            </div>
            ${metricHtml}
            ${linksHtml}
        </div>
    `;
    
    return card;
}

// Render projects to grid
function renderProjects(projects, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد مشاريع متاحة حالياً</p>';
        return;
    }
    
    projects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

// Load featured projects (for homepage)
async function loadFeaturedProjects() {
    const projects = await fetchProjects();
    const featured = projects.filter(p => p.featured === true).slice(0, 3);
    renderProjects(featured, 'featuredProjectsGrid');
}

// Load all projects (for projects page)
async function loadAllProjects() {
    const loadingState = document.querySelector('#projectsGrid .loading-state');
    try {
        const projects = await fetchProjects();
        renderProjects(projects, 'projectsGrid');
    } finally {
        // Always hide loading spinner
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }
}

// Filter projects by tool
function filterProjects(tool) {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    const cards = container.querySelectorAll('.project-card');
    
    cards.forEach(card => {
        const tools = JSON.parse(card.getAttribute('data-tools'));
        
        if (tool === 'all' || tools.includes(tool)) {
            card.classList.remove('hidden');
            setTimeout(() => {
                card.style.display = 'flex';
            }, 10);
        } else {
            card.classList.add('hidden');
            setTimeout(() => {
                card.style.display = 'none';
            }, 300);
        }
    });
}

// Initialize filter buttons
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Get filter value and apply
            const filter = button.getAttribute('data-filter');
            currentFilter = filter;
            filterProjects(filter);
        });
    });
}

// Show error state
function showError() {
    const errorState = document.getElementById('errorState');
    const projectsGrid = document.getElementById('projectsGrid');
    
    if (projectsGrid) {
        projectsGrid.innerHTML = '';
    }
    
    if (errorState) {
        errorState.style.display = 'block';
    }
}

// Export functions for use in HTML
window.loadFeaturedProjects = loadFeaturedProjects;
window.loadAllProjects = loadAllProjects;
window.initializeFilters = initializeFilters;
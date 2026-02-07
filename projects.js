let allProjects = [];
let currentFilter = 'all';

// 1. بيانات احتياطية تعمل فوراً في حال فشل تحميل الملف الخارجي
const fallbackProjects = [
    {
        "title_ar": "تحليل مبيعات المتجر",
        "title_en": "Store Sales Analysis",
        "description_ar": "لوحة معلومات تفاعلية لتحليل أداء المبيعات وتحديد المنتجات الأكثر مبيعاً باستخدام Power BI.",
        "image": "assets/images/projects/project-1.jpg",
        "tools": ["Power BI", "Excel"],
        "metric_value": "15%",
        "metric_label_ar": "زيادة في الأرباح",
        "featured": true
    },
    {
        "title_ar": "نظام إدارة المخزون",
        "title_en": "Inventory Management System",
        "description_ar": "تطبيق بلغة بايثون لإدارة المخزون وتوقع الطلب المستقبلي بناءً على البيانات التاريخية.",
        "image": "assets/images/projects/project-2.jpg",
        "tools": ["Python", "SQL"],
        "metric_value": "30+",
        "metric_label_ar": "ساعة توفير شهرياً",
        "featured": true
    },
    {
        "title_ar": "تحليل بيانات العملاء",
        "title_en": "Customer Segmentation",
        "description_ar": "تحليل سلوك العملاء وتقسيمهم إلى فئات مستهدفة للحملات التسويقية.",
        "image": "assets/images/projects/project-3.jpg",
        "tools": ["SQL", "Tableau"],
        "featured": false
    }
];

// 2. دالة جلب البيانات المعدلة
async function fetchProjects() {
    try {
        const response = await fetch('data/projects.json');
        
        // إذا فشل العثور على الملف، نستخدم البيانات الاحتياطية
        if (!response.ok) {
            console.warn('تعذر تحميل ملف JSON، سيتم استخدام البيانات الاحتياطية.');
            allProjects = fallbackProjects;
            return fallbackProjects;
        }

        const data = await response.json();
        allProjects = data;
        return data;

    } catch (error) {
        console.error('حدث خطأ أثناء جلب البيانات، جاري استخدام البيانات الاحتياطية:', error);
        // في حالة الخطأ (مثل تشغيل الملف محلياً بدون سيرفر)، نعرض البيانات الاحتياطية
        allProjects = fallbackProjects;
        return fallbackProjects;
    }
}

// Create project card HTML
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card fade-in';
    card.setAttribute('data-tools', JSON.stringify(project.tools || []));
    
    // استخدام صورة افتراضية إذا لم توجد صورة
    const imageSrc = project.image || 'https://via.placeholder.com/400x300?text=Project+Image';

    const titleEnHtml = project.title_en ? 
        `<p class="project-title-en">${project.title_en}</p>` : '';
    
    const metricHtml = project.metric_value ? `
        <div class="project-metric">
            <div class="metric-value">${project.metric_value}</div>
            <div class="metric-label">${project.metric_label_ar}</div>
        </div>
    ` : '';
    
    const linksHtml = (project.github_url || project.live_url) ? `
        <div class="project-links">
            ${project.github_url ? `<a href="${project.github_url}" class="project-link" target="_blank">GitHub</a>` : ''}
            ${project.live_url ? `<a href="${project.live_url}" class="project-link" target="_blank">عرض المشروع</a>` : ''}
        </div>
    ` : '';
    
    card.innerHTML = `
        <img src="${imageSrc}" alt="${project.title_ar}" class="project-image" loading="lazy">
        <div class="project-content">
            <h3 class="project-title">${project.title_ar}</h3>
            ${titleEnHtml}
            <p class="project-description">${project.description_ar}</p>
            <div class="project-tools">
                ${(project.tools || []).map(tool => `<span class="tool-tag">${tool}</span>`).join('')}
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
    
    // إزالة أي محتوى سابق (بما في ذلك أيقونة التحميل)
    container.innerHTML = '';
    
    if (!projects || projects.length === 0) {
        container.innerHTML = '<p class="no-projects">لا توجد مشاريع لعرضها حالياً</p>';
        return;
    }
    
    projects.forEach(project => {
        const card = createProjectCard(project);
        container.appendChild(card);
    });
}

// Load featured projects
async function loadFeaturedProjects() {
    const projects = await fetchProjects();
    const featured = projects.filter(p => p.featured === true).slice(0, 3);
    renderProjects(featured, 'featuredProjectsGrid');
}

// Load all projects
async function loadAllProjects() {
    // محاولة إخفاء التحميل بشكل صريح إذا كان موجوداً كعنصر منفصل
    const loadingState = document.querySelector('.loading-state');
    
    try {
        const projects = await fetchProjects();
        renderProjects(projects, 'projectsGrid');
    } catch (e) {
        console.error(e);
        showError();
    } finally {
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }
}

// Filter projects
function filterProjects(tool) {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    const cards = container.querySelectorAll('.project-card');
    
    cards.forEach(card => {
        // حماية ضد البيانات الناقصة
        let tools = [];
        try {
            tools = JSON.parse(card.getAttribute('data-tools'));
        } catch(e) { tools = []; }
        
        if (tool === 'all' || tools.includes(tool)) {
            card.classList.remove('hidden');
            card.style.display = 'flex';
        } else {
            card.classList.add('hidden');
            setTimeout(() => {
                card.style.display = 'none';
            }, 300); // نفس مدة الـ animation في CSS
        }
    });
}

// Initialize filters
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const filter = button.getAttribute('data-filter');
            currentFilter = filter;
            filterProjects(filter);
        });
    });
}

function showError() {
    const errorState = document.getElementById('errorState');
    const projectsGrid = document.getElementById('projectsGrid');
    
    if (projectsGrid) projectsGrid.innerHTML = '';
    if (errorState) errorState.style.display = 'block';
}

// تصدير الدوال لاستخدامها في HTML
window.loadFeaturedProjects = loadFeaturedProjects;
window.loadAllProjects = loadAllProjects;
window.initializeFilters = initializeFilters;
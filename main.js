// Mobile Navigation Toggle
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    const links = navLinks.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', () => {
            mobileToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileToggle.contains(e.target) && !navLinks.contains(e.target)) {
            mobileToggle.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

// Active Navigation Link Highlighting
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinksElements = document.querySelectorAll('.nav-link');
    
    navLinksElements.forEach(link => {
        link.classList.remove('active');
        const linkHref = link.getAttribute('href');
        
        if (linkHref === currentPage || 
            (currentPage === '' && linkHref === 'index.html') ||
            linkHref.includes(currentPage)) {
            link.classList.add('active');
        }
    });
}

// Smooth Scroll for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar Background on Scroll
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
    } else {
        navbar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    }
    
    lastScroll = currentScroll;
});

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', () => {
    setActiveNavLink();
    loadFeaturedProjects(); // Ensure projects load correctly
});

// Utility: Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle External Links
document.querySelectorAll('a[target="_blank"]').forEach(link => {
    if (!link.hasAttribute('rel')) {
        link.setAttribute('rel', 'noopener noreferrer');
    }
});

// Fix for infinite loading in projects section
function loadFeaturedProjects() {
    const featuredProjectsGrid = document.getElementById('featuredProjectsGrid');

    if (featuredProjectsGrid) {
        // Simulate loading projects
        setTimeout(() => {
            featuredProjectsGrid.innerHTML = `
                <div class="project-card">مشروع 1</div>
                <div class="project-card">مشروع 2</div>
                <div class="project-card">مشروع 3</div>
            `;
        }, 1000); // Simulate a 1-second delay for loading
    }
}
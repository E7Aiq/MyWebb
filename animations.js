// Intersection Observer for Scroll Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const animateOnScroll = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            
            // For staggered animations
            if (entry.target.classList.contains('stagger-parent')) {
                const children = entry.target.querySelectorAll('.stagger-child');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.classList.add('animate');
                    }, index * 100);
                });
            }
        }
    });
}, observerOptions);

// Observe all elements with animation classes
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.fade-in, .slide-up, .slide-left, .slide-right, .scale-in');
    
    animatedElements.forEach(element => {
        animateOnScroll.observe(element);
    });
}

// Stagger animation for multiple elements
function staggerAnimation(selector, delay = 100) {
    const elements = document.querySelectorAll(selector);
    
    elements.forEach((element, index) => {
        element.style.animationDelay = `${index * delay}ms`;
    });
}

// Apply stagger to skill cards and project cards
document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    
    // Stagger skill cards
    staggerAnimation('.skill-card', 150);
    
    // Observe project cards when they're loaded
    const projectObserver = new MutationObserver(() => {
        staggerAnimation('.project-card', 100);
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            if (!card.classList.contains('observed')) {
                animateOnScroll.observe(card);
                card.classList.add('observed');
            }
        });
    });
    
    const projectsGrid = document.getElementById('projectsGrid') || document.getElementById('featuredProjectsGrid');
    if (projectsGrid) {
        projectObserver.observe(projectsGrid, {
            childList: true,
            subtree: true
        });
    }
});

// Parallax effect for hero section (subtle)
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroImage = document.querySelector('.hero-image');
    
    if (heroImage && scrolled < window.innerHeight) {
        heroImage.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
});

// Add entrance animation to page
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease-in';
        document.body.style.opacity = '1';
    }, 100);
});
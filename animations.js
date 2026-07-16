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
    
    // Stagger skill cards (70ms — ضمن نطاق 30–80ms؛ 150ms يبدو بطيئاً)
    staggerAnimation('.skill-card', 70);
    
    // Observe project cards when they're loaded
    const projectObserver = new MutationObserver(() => {
        staggerAnimation('.project-card', 70);
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

// (أُزيل بارالاكس التمرير: كان غير مُقيّد بـ rAF ويتعارض مع أنيميشن
//  float على نفس العنصر — العمق الآن يأتي من الكانفس + float + meshPulse)

// Add entrance animation to page
document.addEventListener('DOMContentLoaded', () => {
    // احترام تفضيل تقليل الحركة: لا تعتيم للصفحة إطلاقاً
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.body.style.opacity = '0';

    setTimeout(() => {
        // ease-out لا ease-in: ease-in يؤخّر اللحظة التي يراقبها المستخدم
        document.body.style.transition = 'opacity 0.4s var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))';
        document.body.style.opacity = '1';
    }, 100);
});
/**
 * Effects — ما تبقّى بعد التقليم.
 *
 * أُلغي من هذا الملف بالكامل: كانفس الهيرو، كشف العنوان كلمة-كلمة، توهّج
 * المؤشر داخل البطاقات، الأزرار المغناطيسية، لمعة العناوين، توهّجات
 * الأقسام، ميلان البطاقات ثلاثي الأبعاد، موجة اللمس، والخط المنزلق في
 * التنقّل (صار .nav-link.active::after في CSS خالصاً).
 *
 * الباقي حركتان مقصودتان فقط:
 *   ١. كشف صورة الغلاف — إضافة أنيميشن، لا إعادة ظهور.
 *   ٢. شريط تقدّم القراءة.
 */

(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('DOMContentLoaded', () => {
        initCoverReveal();
        initReadingProgress();
    });

    /**
     * الغلاف ظاهر افتراضاً في CSS. هذه الدالة تضيف أنيميشن دخول فقط،
     * فلا يمكن لغيابها أو لإخفاقها أن يُخفي الصورة — عكس ما كان.
     */
    function initCoverReveal() {
        if (prefersReduced) return;

        const cover = document.getElementById('article-cover')
                   || document.getElementById('project-cover');
        if (!cover) return;

        const reveal = () => cover.classList.add('cover-in');
        if (cover.complete && cover.naturalWidth > 0) reveal();
        cover.addEventListener('load', reveal, { once: true });
    }

    /**
     * شريط التقدّم — نفس الخط التوقيعي، يمتلئ من اليمين (RTL).
     * يقيس تقدّم المتن نفسه لا الصفحة كلها، فلا يبلغ ١٠٠٪ قبل نهاية القراءة.
     */
    function initReadingProgress() {
        const body = document.getElementById('article-body')
                  || document.getElementById('project-body');
        if (!body) return;

        const bar = document.createElement('div');
        bar.className = 'reading-progress';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML = '<div class="reading-progress-fill"></div>'
                      + '<div class="reading-progress-head"></div>';
        document.body.appendChild(bar);

        const fill = bar.querySelector('.reading-progress-fill');
        let ticking = false;

        /**
         * نقطة القراءة هي منتصف النافذة، والتقدّم هو نسبة ما قطعته من المتن.
         *
         *   تبدأ التتبّع حين تبلغ نقطة القراءة أعلى المتن  ⇒ scrollY = start − vh/2
         *   وتنتهي حين تبلغ أسفله                          ⇒ scrollY = start + H − vh/2
         *   والمسافة بينهما = H، أي ارتفاع المتن نفسه.
         *
         * كان المقام H − vh/2 لا H، فيصغر بمقدار نصف نافذة: بلغ الشريط
         * ١٠٠٪ عند ٧٥٪ من التمرير وبقي ممتلئاً وربعُ المقال لم يُقرأ بعد.
         * التحقّق السابق فحص الطرف الأخير وحده — وهو يعطي 1.0 في الحالتين —
         * فمرّ الخطأ. القياس الصحيح يفحص المنتصف أيضاً.
         */
        function update() {
            ticking = false;
            const height = body.offsetHeight;
            if (height <= 0) return;
            const start = body.getBoundingClientRect().top + window.scrollY;
            const half = window.innerHeight * 0.5;
            const progress = Math.min(Math.max((window.scrollY - start + half) / height, 0), 1);
            fill.style.transform = `scaleX(${progress.toFixed(4)})`;
        }

        function schedule() {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });
        /* التبويب المخفيّ يعلّق requestAnimationFrame، فيبقى ticking مرفوعاً
           ولا يتحرّك الشريط بعد العودة حتى حدث تمرير جديد. الاستماع لتغيّر
           الظهور يفكّ القفل ويعيد الرسم فور العودة. */
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) { ticking = false; update(); }
        });
        update();
    }
})();

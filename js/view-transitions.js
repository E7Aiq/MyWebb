/**
 * View Transitions — المورف المشترك للصورة: بطاقة القائمة ⇆ غلاف التفاصيل.
 *
 * يتبع النمط الرسمي (Chrome cross-document view transitions):
 * بدل تسمية كل صورة تسميةً دائمة — وهي تجعل كل بطاقة «مجموعة انتقال» مستقلّة
 * فتزدحم الحركة وتبدو رديئة — يُسمّى العنصرُ المنقور وحده لحظة المغادرة
 * (pageswap)، وصورةُ البطل المطابقة لحظة الوصول (pagereveal)، ثم تُنزع
 * التسمية فور انتهاء الانتقال. فمجموعة واحدة تتحرّك، لا شبكة كاملة.
 *
 * التحدّي الخاصّ بهذا الموقع: غلاف التفاصيل يُجلب من JSON، فالبطل فارغ
 * لحظة التقاط «الحالة الجديدة» — فلا صورة يتوسّع إليها المورف. الحلّ:
 * نمرّر رابط الغلاف (وهو مخبَّأ أصلاً في كاش المتصفّح لأنه ظهر في البطاقة)
 * عبر sessionStorage، ونُظهر البطل في pagereveal قبل الالتقاط. ومع
 * التهيئة المسبقة (Speculation Rules) يكون البطل جاهزاً قبل النقر أصلاً.
 *
 * تحسين تدريجي بحت: بلا دعم أو تحت prefers-reduced-motion، تتنقّل الصفحات
 * عادةً بلا أي أثر (الحدثان لا يُطلقان انتقالاً، والقواعد تُبطَل في style.css).
 */
(function () {
  'use strict';

  // لا داعي لإرفاق مستمعات لن تُطلق انتقالاً أبداً.
  if (!('startViewTransition' in document)) return;

  var KEY = 'vt:cover';   // {name, src} للزوج النشط، يعبر من المغادرة إلى الوصول

  function slug(id) {
    return String(id || '').replace(/[^A-Za-z0-9_-]/g, '-');
  }

  // هل يشير الرابط إلى صفحة تفاصيل؟ يعيد {hero, name, id} أو null.
  // الاسم يحمل معرّف العنصر فيتطابق طرفا المورف عبر المستندين.
  function detailTarget(url) {
    if (!url) return null;
    try {
      var u = new URL(url, location.href);
      var id = new URLSearchParams(u.search).get('id');
      if (!id) return null;
      if (u.pathname.endsWith('project-details.html')) {
        return { hero: 'project-cover', shell: 'projectShell', load: 'project-loading', name: 'vt-proj-' + slug(id), id: id };
      }
      if (u.pathname.endsWith('article.html')) {
        return { hero: 'article-cover', shell: 'articleShell', load: 'article-loading', name: 'vt-art-' + slug(id), id: id };
      }
    } catch (e) { /* رابط غير صالح */ }
    return null;
  }

  // صورة البطاقة في صفحة القائمة/الرئيسية المطابقة للمعرّف. بطاقة المشروع
  // رابطها منفصل عن صورتها (نصعد إلى .project-card)، وبطاقة/صدارة المقال
  // هي نفسها <a> يحوي صورته.
  function listImage(id) {
    var links = document.querySelectorAll('a[href*="' + id + '"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var img = a.querySelector('.article-card-image, .article-lead-cover');
      if (img) return img;
      var card = a.closest('.project-card');
      if (card) {
        var pi = card.querySelector('.project-card-image');
        if (pi) return pi;
      }
    }
    return null;
  }

  // ── المغادرة: سمِّ البطاقة المنقورة وحدها، وخبّئ غلافها للوصول ─────────
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var t = detailTarget(e.activation && e.activation.entry && e.activation.entry.url);
    if (!t) return;

    var img = listImage(t.id);
    if (!img) return;

    img.style.viewTransitionName = t.name;
    img.style.setProperty('view-transition-class', 'morph');   // يعزل تنسيق المورف عن الجذر
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ name: t.name, src: img.currentSrc || img.src }));
    } catch (err) { /* التخزين ممتلئ أو محجوب — التهيئة المسبقة تكفي */ }

    // المستند المغادر يُتلف بعد الانتقال المتقاطع، فالتنظيف احتياطيّ لا أكثر.
    e.viewTransition.finished.finally(function () {
      img.style.viewTransitionName = '';
      img.style.removeProperty('view-transition-class');
    });
  });

  // ── الوصول: أظهر البطل ثم سمّه قبل الالتقاط ──────────────────────────
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var t = detailTarget(location.href);
    if (!t) return;

    var stash = null;
    try { stash = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (err) { /* تجاهل */ }
    if (!stash || stash.name !== t.name) return;   // لم نأتِ من نقرة بطاقة مطابقة ⇒ تلاشٍ عاديّ
    try { sessionStorage.removeItem(KEY); } catch (err2) { /* تجاهل */ }

    var hero = document.getElementById(t.hero);
    if (!hero) return;

    // إن لم تكن التهيئة المسبقة قد ملأت البطل بعد: املأه من الرابط المخبَّأ
    // واكشف الهيكل والدوّارة، كي تلتقط «الحالة الجديدة» صورةً حقيقية. عمليات
    // تكرارية آمنة إن سبقها محمّل التفاصيل.
    if (hero.hidden || !hero.getAttribute('src')) {
      // فكّ تزامنيّ: الغلاف محلّي ومخبَّأ من البطاقة، فيُرسم في إطار الالتقاط
      // نفسه بدل صندوق رماديّ يتوسّع ثم تقفز الصورة فوقه.
      hero.decoding = 'sync';
      if (stash.src) hero.src = stash.src;
      hero.hidden = false;
      var shell = document.getElementById(t.shell);
      if (shell) shell.hidden = false;
      var load = document.getElementById(t.load);
      if (load) load.hidden = true;
    }

    hero.style.viewTransitionName = t.name;
    hero.style.setProperty('view-transition-class', 'morph');   // يطابق فئة البطاقة
    e.viewTransition.ready.finally(function () {
      hero.style.viewTransitionName = '';
      hero.style.removeProperty('view-transition-class');
    });
  });
})();

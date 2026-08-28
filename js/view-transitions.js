/**
 * View Transitions — المورف المشترك للصورة: بطاقة القائمة ⇆ غلاف التفاصيل.
 *
 * يتبع النمط الرسمي (Chrome cross-document view transitions):
 * بدل تسمية كل صورة تسميةً دائمة — وهي تجعل كل بطاقة «مجموعة انتقال» مستقلّة
 * فتزدحم الحركة وتبدو رديئة — يُسمّى العنصرُ المنقور وحده لحظة المغادرة
 * (pageswap)، وصورةُ البطل المطابقة لحظة الوصول (pagereveal)، ثم تُنزع
 * التسمية فور انتهاء الانتقال. فمجموعة واحدة تتحرّك، لا شبكة كاملة.
 *
 * منذ الانتقال إلى المسارات النظيفة (/articles/<slug>/) لم يعد المعرّف في
 * الرابط، فصار طرفا المورف يتعارفان بـ data-id: على البطاقة في القائمة،
 * وعلى هيكل المقال/المشروع في صفحة التفاصيل. المسار وحده لا يكفي لأن
 * المعرّف هو ما يضمن أن الصورتين لعنصرٍ واحد لا لعنصرين متشابهين.
 *
 * صفحات التفاصيل صارت مصيَّرة مسبقاً، فالبطل موجودٌ في الترميز عند الوصول
 * ولا يحتاج تمرير الرابط عبر sessionStorage كما كان.
 *
 * تحسين تدريجي بحت: بلا دعم أو تحت prefers-reduced-motion، تتنقّل الصفحات
 * عادةً بلا أي أثر (الحدثان لا يُطلقان انتقالاً، والقواعد تُبطَل في style.css).
 */
(function () {
  'use strict';

  // لا داعي لإرفاق مستمعات لن تُطلق انتقالاً أبداً.
  if (!('startViewTransition' in document)) return;

  function slug(id) {
    return String(id || '').replace(/[^A-Za-z0-9_-]/g, '-');
  }

  var KINDS = {
    articles: { hero: 'article-cover', shell: 'articleShell', prefix: 'vt-art-' },
    projects: { hero: 'project-cover', shell: 'projectShell', prefix: 'vt-proj-' }
  };

  // هل يشير الرابط إلى صفحة تفاصيل؟ يعيد وصف النوع أو null.
  function detailKind(url) {
    if (!url) return null;
    try {
      var u = new URL(url, location.href);
      var m = u.pathname.match(/^\/(articles|projects)\/[^/]+\/?$/);
      if (m) return Object.assign({ path: u.pathname }, KINDS[m[1]]);
    } catch (e) { /* رابط غير صالح */ }
    return null;
  }

  // البطاقة المقصودة في صفحة القائمة/الرئيسية: يُبحث عنها بالمسار، ومنها
  // يُقرأ المعرّف وتُلتقط الصورة. بطاقة المشروع رابطها منفصل عن صورتها
  // (نصعد إلى .project-card)، وبطاقة/صدارة المقال هي نفسها <a> يحوي صورته.
  function sourceFor(path) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href;
      try { href = new URL(a.getAttribute('href'), location.href).pathname; } catch (e) { continue; }
      if (href !== path) continue;

      var host = a.closest('.project-card') || a;
      var img = host.querySelector('.article-card-image, .article-lead-cover, .project-card-image');
      var id = host.dataset ? host.dataset.id : null;
      if (img && id) return { img: img, id: id };
    }
    return null;
  }

  // ── المغادرة: سمِّ البطاقة المنقورة وحدها ────────────────────────────
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var t = detailKind(e.activation && e.activation.entry && e.activation.entry.url);
    if (!t) return;

    var src = sourceFor(t.path);
    if (!src) return;

    var name = t.prefix + slug(src.id);
    src.img.style.viewTransitionName = name;
    src.img.style.setProperty('view-transition-class', 'morph');   // يعزل تنسيق المورف عن الجذر

    // المستند المغادر يُتلف بعد الانتقال المتقاطع، فالتنظيف احتياطيّ لا أكثر.
    e.viewTransition.finished.finally(function () {
      src.img.style.viewTransitionName = '';
      src.img.style.removeProperty('view-transition-class');
    });
  });

  // ── الوصول: سمِّ البطل المطابق قبل الالتقاط ──────────────────────────
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var t = detailKind(location.href);
    if (!t) return;

    var shell = document.getElementById(t.shell);
    var hero = document.getElementById(t.hero);
    if (!shell || !hero || !shell.dataset.id) return;
    if (hero.hidden || !hero.getAttribute('src')) return;

    hero.style.viewTransitionName = t.prefix + slug(shell.dataset.id);
    hero.style.setProperty('view-transition-class', 'morph');   // يطابق فئة البطاقة
    e.viewTransition.ready.finally(function () {
      hero.style.viewTransitionName = '';
      hero.style.removeProperty('view-transition-class');
    });
  });
})();

/* Views Engineer — トップ・人類初の記録・作品一覧・プロフィールの共通スクリプト */
(function () {
  var d = document;
  if (/[?&]nofx=1/.test(location.search)) d.body.classList.add('nofx');
  var y = d.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // 公開から30日以内の作品に NEW を出す（日付は台帳から。手で外す作業をなくす）
  var now = Date.now();
  d.querySelectorAll('[data-added]').forEach(function (el) {
    var t = Date.parse(el.getAttribute('data-added'));
    if (t && now - t < 30 * 864e5 && now - t > -864e5) el.classList.add('is-new');
  });

  // どの入口が押されたかを数える（GoatCounter のイベント）
  d.querySelectorAll('[data-start]').forEach(function (a) {
    a.addEventListener('click', function () {
      try {
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({ path: 'start/' + a.dataset.start, title: '入口: ' + a.dataset.start, event: true });
        }
      } catch (e) {}
    });
  });

  // いまいる段に印をつける（#で始まるナビだけ）
  var links = [].slice.call(d.querySelectorAll('[data-spy] a[href^="#"], #siteNav a[href^="#"]'));
  if ('IntersectionObserver' in window && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        var a = byId[e.target.id];
        if (a) {
          a.classList.add('on');
          if (a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollLeft = a.offsetLeft - 16;
        }
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) { var el = d.getElementById(id); if (el) io.observe(el); });
  }

  // 訪問者数（GoatCounter の合計）
  var v = d.getElementById('visitorCount');
  if (v && window.fetch) {
    fetch('https://viewsengineer.goatcounter.com/counter/TOTAL.json', { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.count) v.textContent = j.count; })
      .catch(function () {});
  }
})();

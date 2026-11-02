// Меню: на телефоне открывается кнопкой «Меню», подменю «Экраны» и «Декор» — по нажатию.
(function () {
  var nav = document.getElementById('nav');
  if (!nav) return;
  var toggle = document.querySelector('.menu-toggle');
  var subBtns = nav.querySelectorAll('.nav-btn');

  function setSub(btn, open) {
    btn.setAttribute('aria-expanded', String(open));
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
  }
  function closeSubs(except) {
    subBtns.forEach(function (b) { if (b !== except) setSub(b, false); });
  }
  function closeMenu() {
    closeSubs();
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) closeSubs();
  });
  subBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      closeSubs(b);
      setSub(b, b.getAttribute('aria-expanded') !== 'true');
    });
  });
  // Переход по ссылке-якорю на этой же странице: меню закрываем, иначе оно закрывает форму.
  nav.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('header')) closeSubs();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = nav.querySelector('.nav-btn[aria-expanded="true"]');
    closeSubs();
    if (open) open.focus();
  });
})();

(function () {
  var cards = document.querySelectorAll('.card');
  var panels = document.querySelectorAll('.panel');
  var form = document.getElementById('form');

  function showPanel(id, scroll) {
    panels.forEach(function (p) { p.hidden = p.id !== id; });
    cards.forEach(function (c) {
      c.setAttribute('aria-selected', String(c.dataset.panel === id));
    });
    if (scroll) document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  cards.forEach(function (c) {
    c.addEventListener('click', function () { showPanel(c.dataset.panel, true); });
  });

  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('[data-mat-text]').forEach(function (b) {
        b.hidden = b.dataset.matText !== t.dataset.mat;
      });
    });
  });

  document.querySelectorAll('[data-ask]').forEach(function (b) {
    b.addEventListener('click', function () {
      var opt = Array.prototype.find.call(form.item.options, function (o) { return o.text === b.dataset.ask; });
      if (opt) form.item.value = opt.value;
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = 'Имя: ' + form.name.value + '\nКонтакт: ' + form.contact.value +
      '\nИнтересует: ' + form.item.value + '\n\n' + form.msg.value;
    location.href = 'mailto:woodirex@gmail.com?subject=' +
      encodeURIComponent('Заявка с сайта: ' + form.item.value) +
      '&body=' + encodeURIComponent(body);
  });
})();

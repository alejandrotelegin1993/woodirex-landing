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

// Плашка cookies: выбор хранится в браузере, сторонние скрипты — только после «Принять».
(function () {
  var KEY = 'woodirex-cookies';

  // Счётчики (GA4, Google Ads, Метрика — задача #20) добавлять функциями в этот список.
  // Пока он пуст, cookies сайт не ставит и плашку не показывает. Вместе со счётчиками
  // вернуть в politika.html раздел о cookies и кнопку #cookie-reset.
  var counters = [];
  if (!counters.length) return;
  function loadCounters() { counters.forEach(function (load) { load(); }); }

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* без хранилища плашка покажется снова */ }
  }

  function show() {
    if (document.getElementById('cookie-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'cookie-bar';
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Согласие на cookies');
    bar.innerHTML = '<p>Cookies для статистики посещений. ' +
      '<a href="politika.html#cookies">Подробнее</a></p>' +
      '<div class="cookie-btns"><button class="btn" type="button" data-v="accepted">Принять</button>' +
      '<button class="btn ghost" type="button" data-v="declined">Отказаться</button></div>';
    document.body.appendChild(bar);
    // Отступ снизу, чтобы плашка не закрывала конец страницы: форму, кнопки, подвал.
    document.body.style.paddingBottom = bar.offsetHeight + 'px';
    bar.addEventListener('click', function (e) {
      var v = e.target.getAttribute('data-v');
      if (!v) return;
      var wasAccepted = read() === 'accepted';
      save(v);
      bar.remove();
      document.body.style.paddingBottom = '';
      if (v === 'accepted') loadCounters();
      else if (wasAccepted) location.reload(); // уже загруженные счётчики выгружаем перезагрузкой
    });
  }

  var choice = read();
  if (choice === 'accepted') loadCounters();
  else if (choice !== 'declined') show();

  var reset = document.getElementById('cookie-reset');
  if (reset) reset.addEventListener('click', show);
})();

// Галерея: фото целиком поверх страницы, листание стрелками. Без JS ссылка просто открывает фото.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.gallery a'));
  if (!links.length || !window.HTMLDialogElement) return;
  var box = document.createElement('dialog');
  box.className = 'lightbox';
  box.innerHTML = '<img alt=""><button class="lb-close" type="button" aria-label="Закрыть">×</button>' +
    '<button class="lb-prev" type="button" aria-label="Предыдущее фото">‹</button>' +
    '<button class="lb-next" type="button" aria-label="Следующее фото">›</button>';
  document.body.appendChild(box);
  var img = box.querySelector('img');
  var cur = 0;

  function show(i) {
    cur = (i + links.length) % links.length;
    img.src = links[cur].href;
    img.alt = links[cur].querySelector('img').alt;
  }
  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      show(i);
      box.showModal();
    });
  });
  box.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1); });
  box.querySelector('.lb-close').addEventListener('click', function () { box.close(); });
  // нажатие мимо фото и кнопок закрывает
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  if (links.length < 2) box.querySelectorAll('.lb-prev, .lb-next').forEach(function (b) { b.hidden = true; });
})();

(function () {
  var form = document.getElementById('form');
  if (!form) return;

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

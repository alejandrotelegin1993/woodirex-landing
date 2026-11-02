// Настройки калькулятора: все цифры только здесь. Ставки в BYN без НДС.
// ratePerSqMeter: ставка за м² для экранов выше limitsMm.height; null → «считаем индивидуально».
var CALC_SETTINGS = {
  materials: [
    { id: 'mdf',   label: 'МДФ',           ratePerMeter: 160, ratePerSqMeter: null },
    { id: 'metal', label: 'Металл',        ratePerMeter: 180, ratePerSqMeter: null },
    { id: 'wood',  label: 'Массив дерева', ratePerMeter: 190, ratePerSqMeter: null }
  ],
  limitsMm: { length: 1500, height: 650, depth: 250 },
  maxLengthPerMeterMm: 2000, // длиннее limitsMm.length и до этой длины: по п. м, возможно две секции
  minLengthMm: 800,
  centimetersBelowMm: { length: 300, height: 150 }, // меньше этого похоже на ввод в сантиметрах
  vatPercent: 20
};

// Расчёт цены экрана: входные данные → результат, страницу не трогает.
// Считаем в целых (мм, копейки), рубли округляем вверх.
function calcScreenPrice(input, settings) {
  function ceilDiv(n, d) { return (n - n % d) / d + (n % d > 0 ? 1 : 0); }
  var material = settings.materials.filter(function (m) { return m.id === input.material; })[0];
  var l = input.lengthMm, h = input.heightMm, d = input.depthMm;
  var valid = [l, h, d].every(function (v) { return typeof v === 'number' && isFinite(v) && v > 0; });
  if (!material || !valid) return { status: 'empty' };

  var cm = settings.centimetersBelowMm;
  if (l < cm.length || h < cm.height) return { status: 'centimeters' };

  // Правила по порядку, срабатывает первое; границы включительно.
  var lim = settings.limitsMm;
  if (d > lim.depth) return { status: 'oversize', reason: 'depth' };
  if (l > settings.maxLengthPerMeterMm) return { status: 'oversize', reason: 'length' };
  function priced(basis, withoutVat, extra) {
    var r = { status: 'ok', basis: basis, withoutVat: withoutVat,
      withVat: ceilDiv(withoutVat * (100 + settings.vatPercent), 100),
      raisedToMin: false, longScreen: false };
    for (var k in extra) r[k] = extra[k];
    return r;
  }

  if (h > lim.height) {
    // Площадь фасада: длина × высота, без минимальной длины.
    var rateSq = material.ratePerSqMeter;
    if (!(rateSq > 0)) return { status: 'oversize', basis: 'area' };
    return priced('area', ceilDiv(Math.ceil(l) * Math.ceil(h) * rateSq, 1000000)); // мм² × BYN/м² → BYN
  }

  var calcLengthMm = Math.max(Math.ceil(l), settings.minLengthMm);
  var kopecks = calcLengthMm * material.ratePerMeter / 10; // мм × BYN/м → копейки
  return priced('meter', ceilDiv(kopecks, 100), {
    raisedToMin: l < settings.minLengthMm, longScreen: l > lim.length
  });
}

var CALC_BLOCK_START = 'Расчёт с калькулятора:';
var CALC_BLOCK_END = 'Источник: калькулятор';
var CALC_LONG_SCREEN_NOTE = 'Длинный экран, возможно из двух секций, уточним';

// Текст заявки из результата расчёта: один для почты, копирования и Viber.
// Текст есть только у расчёта с ценой или «индивидуально», остальное не отправляем.
function calcRequestText(input, result, settings) {
  if (result.status !== 'ok' && result.status !== 'oversize') return '';
  var material = settings.materials.filter(function (m) { return m.id === input.material; })[0];
  var lines = [
    CALC_BLOCK_START,
    'Изделие: экран для батареи',
    'Материал: ' + material.label,
    'Размер (Д×В×Г): ' + input.lengthMm + '×' + input.heightMm + '×' + input.depthMm + ' мм'
  ];
  if (result.reason === 'depth') lines.push('Расчёт: глубина больше ' + settings.limitsMm.depth + ' мм');
  else if (result.reason === 'length') lines.push('Расчёт: длина больше ' + settings.maxLengthPerMeterMm + ' мм');
  else if (result.basis === 'area') lines.push('Расчёт: габаритный экран, по квадратному метру');
  else if (result.longScreen) lines.push('Расчёт: длинный экран, по погонному метру', CALC_LONG_SCREEN_NOTE);
  else lines.push('Расчёт: стандартный размер, по погонному метру');
  if (result.raisedToMin) lines.push('Длина посчитана как ' + settings.minLengthMm + ' мм');
  lines.push(result.status === 'ok'
    ? 'Цена: от ' + result.withVat + ' BYN с НДС, ' + result.withoutVat + ' BYN без НДС'
    : 'Цена: считаем индивидуально');
  lines.push(CALC_BLOCK_END);
  return lines.join('\n');
}

// Вставляет блок расчёта в сообщение: текст человека не трогает,
// прежний блок расчёта заменяет, а не дублирует.
function mergeCalcBlock(message, block) {
  // Ищем последний блок: свой текст человека стоит перед ним.
  var start = message.lastIndexOf(CALC_BLOCK_START);
  if (start >= 0) {
    var end = message.indexOf(CALC_BLOCK_END, start);
    // Последнюю строку блока стёрли руками: заменяем до конца сообщения.
    var tail = end < 0 ? '' : message.slice(end + CALC_BLOCK_END.length);
    return message.slice(0, start) + block + tail;
  }
  var userText = message.replace(/\s+$/, '');
  return userText ? userText + '\n\n' + block : block;
}

// Число миллиметров из поля: пробелы убираем, запятая как точка; не число → NaN.
function readMm(field) {
  var v = field.value.replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

// Корзины: одна цена «от», покраска и замер входят. Ставка в BYN без НДС.
var BASKET_SETTINGS = {
  fromWithoutVat: 250,
  versions: [
    { id: 'protect',    label: 'защитная' },
    { id: 'antivandal', label: 'антивандальная с крышкой', priceOnRequest: true }
  ],
  vatPercent: CALC_SETTINGS.vatPercent
};

function basketPrice(settings) {
  var withoutVat = settings.fromWithoutVat;
  return { withoutVat: withoutVat, withVat: Math.ceil(withoutVat * (100 + settings.vatPercent) / 100) };
}

// Текст заявки на корзину. Пустой, если нет ни размеров блока, ни модели, ни замера.
function basketRequestText(input, settings) {
  var sizes = [input.lengthMm, input.depthMm, input.heightMm];
  var hasSizes = sizes.every(function (v) { return typeof v === 'number' && isFinite(v) && v > 0; });
  var model = input.model.trim();
  if (!hasSizes && !model && !input.measure) return '';
  var version = settings.versions.filter(function (v) { return v.id === input.version; })[0] || settings.versions[0];
  var ral = input.ral.trim();
  var p = basketPrice(settings);
  var lines = [CALC_BLOCK_START, 'Изделие: корзина для кондиционера'];
  if (hasSizes) lines.push('Размер блока (Д×Г×В): ' + sizes.join('×') + ' мм');
  if (model) lines.push('Модель кондиционера: ' + model);
  if (input.measure) lines.push('Нужен замер');
  lines.push(
    'Исполнение: ' + version.label + (version.priceOnRequest ? ', стоимость уточним' : ''),
    'Цвет: ' + (!ral ? 'подберём под фасад' : /^\d/.test(ral) ? 'RAL ' + ral : ral),
    'Цена: от ' + p.withVat + ' BYN с НДС, ' + p.withoutVat + ' BYN без НДС',
    CALC_BLOCK_END
  );
  return lines.join('\n');
}

(function () {
  var S = CALC_SETTINGS;
  var form = document.getElementById('calc-form');
  if (!form) return; // страница без калькулятора
  var price = document.getElementById('calc-price');
  var priceSub = document.getElementById('calc-price-sub');
  var minText = 'Экран короче ' + S.minLengthMm + ' мм считается как ' + S.minLengthMm + ' мм.';

  // Начальный материал: data-material на секции #calc, неизвестный или пустой → первый.
  var start = document.getElementById('calc').dataset.material;
  if (!S.materials.some(function (m) { return m.id === start; })) start = S.materials[0].id;

  S.materials.forEach(function (m) {
    var label = document.createElement('label');
    var input = document.createElement('input');
    var span = document.createElement('span');
    input.type = 'radio'; input.name = 'material'; input.value = m.id; input.checked = m.id === start;
    span.textContent = m.label;
    label.appendChild(input); label.appendChild(span);
    document.getElementById('calc-materials').appendChild(label);
  });
  document.getElementById('calc-min-note').textContent = minText;

  var send = document.getElementById('calc-send');
  var requestText = '';

  function update() {
    var input = {
      material: form.material.value,
      lengthMm: readMm(form.len),
      heightMm: readMm(form.height),
      depthMm: readMm(form.depth)
    };
    var r = calcScreenPrice(input, S);
    requestText = calcRequestText(input, r, S);
    send.disabled = !requestText;

    if (r.status === 'ok') {
      price.textContent = 'от ' + r.withVat + ' BYN с НДС';
      priceSub.textContent = r.withoutVat + ' BYN без НДС' +
        (r.basis === 'area' ? '. Габаритный экран, посчитан по площади.' : '') +
        (r.longScreen ? '. ' + CALC_LONG_SCREEN_NOTE + '.' : '') +
        (r.raisedToMin ? '. ' + minText : '');
    } else if (r.status === 'oversize') {
      price.textContent = 'Считаем индивидуально';
      priceSub.textContent = 'Отправьте размеры, рассчитаем стоимость по заявке.';
    } else if (r.status === 'centimeters') {
      price.textContent = 'Похоже, размер в сантиметрах?';
      priceSub.textContent = 'Введите размеры в миллиметрах.';
    } else {
      price.textContent = 'Цена появится здесь';
      priceSub.textContent = 'Введите длину, высоту и глубину экрана.';
    }
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  send.addEventListener('click', function () {
    if (!requestText) return;
    var lead = document.getElementById('form');
    lead.item.value = 'Экраны для батарей';
    lead.msg.value = mergeCalcBlock(lead.msg.value, requestText);
    lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  update();
})();

(function () {
  var S = BASKET_SETTINGS;
  var form = document.getElementById('basket-form');
  if (!form) return; // страница без расчёта корзины
  var p = basketPrice(S);
  var priceSub = document.getElementById('basket-price-sub');
  var send = document.getElementById('basket-send');
  var requestText = '';
  document.getElementById('basket-price').textContent = 'от ' + p.withVat + ' BYN с НДС';

  function update() {
    var input = {
      lengthMm: readMm(form.len),
      depthMm: readMm(form.depth),
      heightMm: readMm(form.height),
      model: form.model.value,
      measure: form.measure.checked,
      version: form.version.value,
      ral: form.ral.value
    };
    var version = S.versions.filter(function (v) { return v.id === input.version; })[0];
    requestText = basketRequestText(input, S);
    send.disabled = !requestText;
    priceSub.textContent = p.withoutVat + ' BYN без НДС' +
      (version && version.priceOnRequest ? '. Антивандальное исполнение — стоимость уточним.' : '');
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  send.addEventListener('click', function () {
    if (!requestText) return;
    var lead = document.getElementById('form');
    lead.item.value = 'Корзины для кондиционеров';
    lead.msg.value = mergeCalcBlock(lead.msg.value, requestText);
    lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  update();
})();

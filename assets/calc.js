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

  function readMm(field) {
    var v = field.value.replace(/\s/g, '').replace(',', '.');
    return /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
  }

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

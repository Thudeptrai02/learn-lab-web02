// ====== GOOGLE FORM AUTO-FILL ======
let _gfEntryMap = [];
let _gfAutoFillState = { running: false, total: 0, done: 0, errors: 0, stop: false };

function parseFormId(url) {
  if (!url) return null;
  const m = url.match(/\/d\/e\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchFormHTML(fid) {
  try {
    const r = await fetch(`https://docs.google.com/forms/d/e/${fid}/viewform`, { mode: 'cors' });
    if (r.ok) return await r.text();
  } catch(e) {}
  const proxies = [
    `https://api.allorigins.win/raw?url=https://docs.google.com/forms/d/e/${fid}/viewform`,
    `https://corsproxy.io/?url=https://docs.google.com/forms/d/e/${fid}/viewform`,
  ];
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.text();
    } catch(e) {}
  }
  return null;
}

function parseFormHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const entries = doc.querySelectorAll('[name^="entry."]');
  const questions = doc.querySelectorAll('.freebirdFormviewerComponentsQuestionBaseTitle');
  const qlist = [];
  entries.forEach((el, i) => {
    const name = el.getAttribute('name');
    const qText = questions[i] ? questions[i].textContent.trim() : 'Câu hỏi ' + (i+1);
    if (name && !qlist.some(x => x.id === name)) qlist.push({ id: name.replace('entry.',''), text: qText });
  });
  return qlist.length > 0 ? qlist : null;
}

async function detectGoogleForm() {
  const url = document.getElementById('gf-url').value.trim();
  if (!url) { showToast('Vui lòng nhập link Google Form', 'error'); return; }
  const fid = parseFormId(url);
  if (!fid) { showToast('Không nhận dạng được Form ID. Link phải dạng: docs.google.com/forms/d/e/.../viewform', 'error'); return; }
  _gfEntryMap = [];
  const status = document.getElementById('gf-status');
  const mappingDiv = document.getElementById('gf-mapping');
  const tbody = document.getElementById('gf-map-tbody');
  status.innerHTML = '⏳ Đang dò cấu trúc form...';
  const html = await fetchFormHTML(fid);
  if (html) {
    const qlist = parseFormHTML(html);
    if (qlist) {
      // Luôn hiện entry codes dù có data variables hay không
      showEntryCodesPopup(qlist);
      const dataVars = getDataVariables();
      if (dataVars.length > 0) {
        buildMappingTable(qlist, tbody, status, mappingDiv, url);
      } else {
        status.innerHTML = '✅ Đã dò được <b>' + qlist.length + '</b> câu hỏi. Entry codes hiện bên dưới.';
        mappingDiv.style.display = 'none';
      }
      return;
    }
  }
  status.innerHTML = '⚠️ Không đọc được form. Nhập Entry ID thủ công.';
  showManualEntry(tbody, status, mappingDiv, url, fid);
  const ds = document.getElementById('gf-date-start');
  const de = document.getElementById('gf-date-end');
  if (!ds.value) { const d = new Date(); d.setDate(d.getDate()-60); ds.value = d.toISOString().split('T')[0]; }
  if (!de.value) { de.value = new Date().toISOString().split('T')[0]; }
}

function showEntryCodesPopup(qlist) {
  var old = document.getElementById('gf-entry-block');
  if (old) old.remove();

  var block = document.createElement('div');
  block.id = 'gf-entry-block';
  block.style.cssText = 'margin-top:.5rem;padding:.65rem .75rem;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--radius);font-size:.75rem';

  var flatRow1 = qlist.map(function(q) { return 'entry.' + q.id; }).join('\t');
  var mappingRef = qlist.map(function(q, i) { return (i+1) + '. entry.' + q.id + '  ← ' + q.text; }).join('\n');

  block.innerHTML =
    '<div style="font-weight:600;margin-bottom:.35rem;color:#15803d">📋 Entry codes — copy dán vào Hàng 1 của tab SPSS_Data:</div>' +
    '<div style="display:flex;gap:.35rem;align-items:start;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:200px">' +
    '<textarea id="gf-entry-flat" readonly style="width:100%;font-family:monospace;font-size:.7rem;padding:.35rem;border:1px solid var(--gray-300);border-radius:4px;background:#fff;resize:none;overflow:hidden" rows="1" onfocus="this.select()">' + flatRow1 + '</textarea>' +
    '<div style="margin-top:.15rem;color:#15803d;font-size:.65rem">⬆️ Select all → Copy (Ctrl+C) → Paste vào Hàng 1 Sheets (tự động chia cột)</div>' +
    '</div>' +
    '<button class="btn btn-sm" onclick="var t=document.getElementById(\'gf-entry-flat\');t.select();navigator.clipboard.writeText(t.value);showToast(\'✅ Đã copy entry codes\',\'success\')" style="background:#15803d;color:#fff;white-space:nowrap;font-size:.7rem;padding:.35rem .6rem">📋 Copy</button>' +
    '</div>' +
    '<details style="margin-top:.35rem;font-size:.7rem">' +
    '<summary style="cursor:pointer;color:#6b7280">📖 Xem mapping câu hỏi ⇢ entry code</summary>' +
    '<pre style="margin:.25rem 0 0;padding:.35rem;background:#fff;border:1px solid var(--gray-200);border-radius:4px;font-size:.65rem;line-height:1.5;overflow-x:auto">' + mappingRef + '</pre>' +
    '</details>';

  var mappingDiv = document.getElementById('gf-mapping');
  mappingDiv.parentNode.insertBefore(block, mappingDiv.nextSibling);
}

function showManualEntry(tbody, status, mappingDiv, url, fid) {
  const dataVars = getDataVariables();
  if (dataVars.length === 0) { status.innerHTML = '❌ Chưa có dữ liệu. Hãy tạo/import dữ liệu trước.'; return; }
  let h = '';
  dataVars.forEach(v => {
    h += `<tr>
      <td style="padding:.3rem .5rem;font-weight:600">${v.constructLabel||v.construct||''} — ${v.name}</td>
      <td style="padding:.3rem .5rem"><input type="text" class="gf-qtext" value="${v.label||v.name}" style="width:100%;padding:.2rem;border:1px solid var(--gray-300);border-radius:4px;font-size:.75rem"></td>
      <td style="padding:.3rem .5rem"><input type="text" class="gf-entry" placeholder="entry.XXXXX" style="width:120px;padding:.2rem;border:1px solid var(--gray-300);border-radius:4px;font-size:.75rem"></td>
    </tr>`;
  });
  tbody.innerHTML = h;
  mappingDiv.style.display = 'block';
  status.innerHTML = '✏️ Nhập Entry ID cho từng biến. Mở form → F12 → tìm "entry." trong HTML để lấy ID.';
  document.getElementById('gf-badge').style.display = 'inline-block';
  document.getElementById('gf-badge').textContent = dataVars.length + ' biến';
}

function buildMappingTable(qlist, tbody, status, mappingDiv, url) {
  const dataVars = getDataVariables();
  if (dataVars.length === 0) { status.innerHTML = '❌ Chưa có dữ liệu. Hãy tạo/import trước.'; return; }
  let h = '';
  const used = new Set();
  dataVars.forEach((v, idx) => {
    const q = qlist[idx] || qlist[qlist.length-1] || { id: '', text: '' };
    used.add(q.id);
    h += `<tr>
      <td style="padding:.3rem .5rem;font-weight:600">${v.constructLabel||v.construct||''} — ${v.name}</td>
      <td style="padding:.3rem .5rem;color:var(--gray-700)">${q.text}</td>
      <td style="padding:.3rem .5rem"><code style="font-size:.7rem;color:var(--primary)">${q.id}</code>
    </tr>`;
  });
  qlist.forEach(q => {
    if (!used.has(q.id)) {
      h += `<tr style="opacity:.5">
        <td style="padding:.3rem .5rem;color:var(--gray-400)" colspan="2">⚠️ Không ghép — <em>${q.text}</em></td>
        <td style="padding:.3rem .5rem"><code style="font-size:.7rem">${q.id}</code></td>
      </tr>`;
    }
  });
  tbody.innerHTML = h;
  mappingDiv.style.display = 'block';
  _gfEntryMap = dataVars.map((v, i) => ({
    varName: v.name,
    entryId: qlist[i] ? qlist[i].id : '',
    question: qlist[i] ? qlist[i].text : (v.label || v.name),
    constructLabel: v.constructLabel || v.construct || ''
  }));
  document.getElementById('gf-badge').style.display = 'inline-block';
  document.getElementById('gf-badge').textContent = dataVars.length + ' biến → ' + qlist.length + ' câu hỏi';
  status.innerHTML = '✅ Tự động ghép <b>' + Math.min(dataVars.length, qlist.length) + '</b> biến với câu hỏi. Kiểm tra lại bên dưới:';
}

function getDataVariables() {
  if (generatedData && variables.length > 0) return variables.filter(v => v.type !== 'demographic' && v.construct);
  return variables.filter(v => v.type !== 'demographic' && v.construct);
}

function generatePrefilledLinks() {
  if (!generatedData) { showToast('Chưa có dữ liệu. Hãy tạo/import trước.', 'error'); return; }
  const url = document.getElementById('gf-url').value.trim();
  const fid = parseFormId(url);
  if (!fid) { showToast('Link Google Form không hợp lệ', 'error'); return; }

  const entryInputs = document.querySelectorAll('.gf-entry');
  if (entryInputs.length > 0) {
    const qtextInputs = document.querySelectorAll('.gf-qtext');
    _gfEntryMap = [];
    const dataVars = getDataVariables();
    entryInputs.forEach((inp, i) => {
      const entryId = inp.value.trim();
      const qText = qtextInputs[i] ? qtextInputs[i].value.trim() : (dataVars[i]?.label || '');
      if (entryId) {
        _gfEntryMap.push({ varName: dataVars[i]?.name || '', entryId, question: qText, constructLabel: dataVars[i]?.constructLabel || '' });
      }
    });
  }

  if (_gfEntryMap.length === 0) { showToast('Chưa có mapping. Bấm "Dò câu hỏi" trước.', 'error'); return; }

  const { rawRows, colNames } = generatedData;
  const noisePct = parseFloat(document.getElementById('gf-noise').value) || 5;
  const dateStart = new Date(document.getElementById('gf-date-start').value || Date.now() - 60*24*60*60000);
  const dateEnd = new Date(document.getElementById('gf-date-end').value || Date.now());
  const dateRange = dateEnd - dateStart;

  const base = `https://docs.google.com/forms/d/e/${fid}/viewform`;
  const results = [];

  rawRows.forEach((row, ri) => {
    const hasNoise = Math.random() * 100 < noisePct;
    const noiseType = hasNoise ? (Math.random() < 0.4 ? 'straightline' : Math.random() < 0.6 ? 'random' : 'empty') : 'clean';

    const ts = new Date(dateStart.getTime() + Math.random() * dateRange);
    let dow = ts.getDay();
    if (dow === 0) ts.setDate(ts.getDate() + 1);
    if (dow === 6) ts.setDate(ts.getDate() + 2);
    ts.setHours(7 + Math.floor(Math.random() * 13));
    ts.setMinutes(Math.floor(Math.random() * 60));
    ts.setSeconds(Math.floor(Math.random() * 60));

    const params = [];
    let flag = '✅ Sạch';
    _gfEntryMap.forEach(m => {
      let val = row[m.varName];
      if (val === null || val === undefined) val = '';
      if (hasNoise) {
        if (noiseType === 'straightline') {
          val = 3;
        } else if (noiseType === 'random') {
          val = Math.floor(Math.random() * 5) + 1;
        } else if (noiseType === 'empty') {
          val = '';
        }
      }
      if (m.entryId) params.push(m.entryId + '=' + encodeURIComponent(val));
    });

    if (hasNoise) flag = '⚠️ Nhiễu (' + noiseType + ')';

    results.push({
      STT: ri + 1,
      'Timestamp': ts.toLocaleString('vi-VN'),
      'Pre-filled Link': base + '?' + params.join('&') + '&fbzx=-1',
      'Trạng thái': flag,
      'Loại nhiễu': hasNoise ? noiseType : '',
      ...(() => { const o = {}; _gfEntryMap.forEach(m => { o[m.question || m.varName] = row[m.varName]; }); return o; })()
    });
  });

  const resultDiv = document.getElementById('gf-result');
  const nTotal = results.length;
  const nNoise = results.filter(r => r['Trạng thái'] !== '✅ Sạch').length;
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<div style="padding:.5rem;background:${nNoise>0?'#fefce8':'#f0fdf4'};border-radius:var(--radius);font-size:.8rem">
    ✅ Tạo <b>${nTotal}</b> pre-filled links. ${nNoise > 0 ? `⚠️ <b>${nNoise}</b> response có nhiễu (${noisePct}%).` : ''}
    <span style="color:var(--gray-400);margin-left:.5rem">Bấm "Tải Excel tracking" để tải về.</span>
  </div>`;
  resultDiv.innerHTML += `<div style="margin-top:.35rem;display:flex;gap:.5rem;flex-wrap:wrap">
    <button class="btn btn-outline btn-sm" onclick="openFormBatch(5)" style="font-size:.75rem">🔗 Mở 5 link</button>
    <button class="btn btn-outline btn-sm" onclick="openFormBatch(10)" style="font-size:.75rem">🔗 Mở 10 link</button>
    <button class="btn btn-outline btn-sm" onclick="openFormBatch(20)" style="font-size:.75rem">🔗 Mở 20 link</button>
  </div>`;

  window._gfResults = results;
  document.getElementById('btn-gf-dl').disabled = false;
  document.getElementById('btn-gf-dl').style.display = 'inline-flex';
  showToast('✅ Đã tạo ' + nTotal + ' pre-filled links', 'success');
}

function openFormBatch(count) {
  if (!window._gfResults || window._gfResults.length === 0) return;
  const toOpen = window._gfResults.slice(0, count);
  alert('Mở ' + toOpen.length + ' link trong tab mới. Cho phép popup nếu bị chặn.');
  toOpen.forEach((r, i) => {
    setTimeout(() => {
      window.open(r['Pre-filled Link'], '_blank');
    }, i * 1500);
  });
}

function downloadGFTracking() {
  if (!window._gfResults || window._gfResults.length === 0) { showToast('Chưa có kết quả', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(window._gfResults);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Form Responses');
  const filename = 'GoogleForm_Tracking_' + new Date().toISOString().split('T')[0] + '.xlsx';
  XLSX.writeFile(wb, filename);
  showToast('✅ Đã tải: ' + filename, 'success');
}

async function autoFillForm() {
  const url = document.getElementById('gf-url').value.trim();
  const fid = parseFormId(url);
  if (!fid) { showToast('Link Google Form không hợp lệ', 'error'); return; }
  if (!generatedData || !generatedData.rawRows || generatedData.rawRows.length === 0) { showToast('Chưa có dữ liệu. Hãy tạo/import trước.', 'error'); return; }
  if (_gfAutoFillState.running) { showToast('Đang chạy...', 'info'); return; }

  const progressDiv = document.getElementById('gf-progress');
  progressDiv.style.display = 'block';
  progressDiv.innerHTML = '⏳ Đang dò cấu trúc form...';

  const html = await fetchFormHTML(fid);
  if (html) {
    const qlist = parseFormHTML(html);
    if (qlist) { startScheduledFill(fid, qlist, progressDiv); return; }
  }
  progressDiv.innerHTML = '⚠️ Không đọc được form. Cần Entry ID thủ công.';
  showToast('Dùng 🔍 Dò câu hỏi để nhập Entry ID thủ công trước.', 'info');
  const dataVars = getDataVariables();
  const qlist = dataVars.map((v, i) => ({ id: '', text: v.label || v.name }));
  startScheduledFill(fid, qlist, progressDiv);
}

function generateSchedule() {
  const ds = document.getElementById('gf-date-start').value;
  const de = document.getElementById('gf-date-end').value;
  const hStart = parseInt(document.getElementById('gf-hour-start').value);
  const hEnd = parseInt(document.getElementById('gf-hour-end').value);
  const rateMin = parseInt(document.getElementById('gf-rate-min').value) || 2;
  const rateMax = parseInt(document.getElementById('gf-rate-max').value) || 5;

  if (!ds || !de) return [];

  const start = new Date(ds);
  const end = new Date(de);
  const schedule = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0,10);
    for (let h = hStart; h <= hEnd; h++) {
      const count = rateMin + Math.floor(Math.random() * (rateMax - rateMin + 1));
      for (let i = 0; i < count; i++) {
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);
        const ts = new Date(`${dayStr}T${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`);
        schedule.push(ts);
      }
    }
  }
  return schedule;
}

function updateFillSummary() {
  const sched = generateSchedule();
  const el = document.getElementById('gf-summary');
  if (sched.length === 0) { el.textContent = ''; return; }
  el.textContent = `⏱ ${sched.length} response · ${sched[0].toLocaleDateString('vi-VN')} → ${sched[sched.length-1].toLocaleDateString('vi-VN')}`;
}

function startScheduledFill(fid, qlist, progressDiv) {
  const schedule = generateSchedule();
  if (schedule.length === 0) { showToast('Vui lòng chọn khoảng ngày hợp lệ', 'error'); return; }

  const noisePct = parseFloat(document.getElementById('gf-noise').value) || 5;
  const state = _gfAutoFillState;
  const dataVars = getDataVariables();
  const fillBtn = document.getElementById('btn-gf-fill');
  const rawRows = generatedData.rawRows;

  const mapping = [];
  dataVars.forEach((v, i) => {
    const q = qlist[i] || qlist[qlist.length-1] || { id: '', text: '' };
    const isTimestamp = /thời gian|ngày.*khảo sát|time|date|timestamp|ngày giờ/i.test(q.text) || /thời gian|ngày.*khảo sát/i.test(v.label || v.name);
    mapping.push({ varName: v.name, entryId: q.id, question: q.text, isTimestamp });
  });

  state.running = true;
  state.total = schedule.length;
  state.done = 0;
  state.errors = 0;
  state.stop = false;

  fillBtn.textContent = '⏹ Dừng';
  fillBtn.style.background = '#6b7280';
  fillBtn.onclick = () => { state.stop = true; };

  const results = [];
  let idx = 0;
  const noiseTypes = ['straightline', 'random', 'empty'];

  function submitNext() {
    if (state.stop || idx >= schedule.length) {
      finishFill(results);
      return;
    }

    const ts = schedule[idx];
    const row = rawRows[idx % rawRows.length];
    const hasNoise = Math.random() * 100 < noisePct;
    const noiseType = hasNoise ? noiseTypes[Math.floor(Math.random() * noiseTypes.length)] : 'clean';
    const entries = [];

    mapping.forEach(m => {
      let val = row[m.varName];
      if (m.isTimestamp) {
        val = ts.toLocaleString('vi-VN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } else if (val === null || val === undefined) val = '';
      if (hasNoise && !m.isTimestamp) {
        if (noiseType === 'straightline') val = 3;
        else if (noiseType === 'random') val = Math.floor(Math.random() * 5) + 1;
        else if (noiseType === 'empty') val = '';
      }
      const eid = m.entryId || (idx + 1);
      if (eid) entries.push({ id: eid, value: val });
    });

    const actionUrl = `https://docs.google.com/forms/d/e/${fid}/formResponse`;
    const iframe = document.createElement('iframe');
    iframe.name = 'gf-' + idx + '-' + Date.now();
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.target = iframe.name;
    form.style.display = 'none';

    entries.forEach(e => {
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'entry.' + e.id;
      inp.value = String(e.value);
      form.appendChild(inp);
    });

    const fbzx = document.createElement('input');
    fbzx.type = 'hidden'; fbzx.name = 'fbzx'; fbzx.value = '-1';
    form.appendChild(fbzx);

    document.body.appendChild(form);
    form.submit();

    results.push({ STT: idx + 1, 'Thời gian': ts.toLocaleString('vi-VN'), 'Trạng thái': hasNoise ? '⚠️ Nhiễu (' + noiseType + ')' : '✅ Sạch', 'Loại nhiễu': hasNoise ? noiseType : '' });

    state.done++;
    if (hasNoise) state.errors++;
    const speed = document.getElementById('gf-speed').value;
    const delay = speed === 'random' ? 4000 + Math.random() * 6000 : parseInt(speed) || 50;
    const remaining = delay > 0 ? Math.round((state.total - state.done) * delay / 1000) + 's' : '<1s';
    progressDiv.innerHTML = `<div style="display:flex;align-items:center;gap:.5rem">
      <div style="flex:1;height:6px;background:var(--gray-200);border-radius:3px;overflow:hidden">
        <div style="width:${(state.done/state.total*100).toFixed(1)}%;height:100%;background:${state.errors>0?'#d97706':'#10b981'};border-radius:3px;transition:width .3s"></div>
      </div>
      <span style="font-weight:600;white-space:nowrap">${state.done}/${state.total}</span>
      <span style="color:var(--gray-400);font-size:.75rem">⏳ ${remaining} · ${ts.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span>
    </div>`;

    setTimeout(() => {
      try { if (form.parentNode) form.parentNode.removeChild(form); if (iframe.parentNode) iframe.parentNode.removeChild(iframe); } catch(e) {}
    }, 500);

    setTimeout(submitNext, delay);
  }

  function finishFill(results) {
    state.running = false;
    fillBtn.textContent = '🚀 Tự động điền form';
    fillBtn.style.background = '#dc2626';
    fillBtn.onclick = autoFillForm;
    window._gfResults = results;
    document.getElementById('btn-gf-dl').disabled = false;

    const msg = state.stop ? '🛑 Đã dừng' : '✅ Hoàn thành';
    progressDiv.innerHTML += `<div style="margin-top:.25rem;font-weight:600;color:${state.errors>0?'#d97706':'#10b981'}">
      ${msg}: ${state.done}/${state.total} response${state.errors>0?', ⚠️ '+state.errors+' có nhiễu':''}</div>`;
    showToast(msg, state.errors > 0 ? 'info' : 'success');
  }

  submitNext();
}

function generateFormScript() {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = { label: v.constructLabel || v.construct, role: v.role || '', items: [] };
      constructs[v.construct].items.push({ name: v.name, label: v.label || v.name, type: v.type });
    }
  });
  const demos = variables.filter(v => v.type === 'demographic');

  const cKeys = Object.keys(constructs);
  if (cKeys.length === 0 && demos.length === 0) { showToast('Chưa có nhân tố nào. Hãy xây dựng mô hình trước.', 'error'); return; }

  const roleLabels = { independent:'Biến độc lập', dependent:'Biến phụ thuộc', mediating:'Biến trung gian', moderating:'Biến điều tiết' };

  // Xác định thứ tự cột: construct items → demos → timestamp
  var colOrder = [];
  cKeys.forEach(function(k) { constructs[k].items.forEach(function(it) { colOrder.push(it.name); }); });
  demos.forEach(function(d) { colOrder.push(d.name); });

  // Lấy dữ liệu từ generatedData (nếu có) và chuyển thành mảng 2 chiều
  var dataRows2d = [];
  if (generatedData && generatedData.rawRows && generatedData.rawRows.length > 0) {
    var maxSample = generatedData.rawRows.length;
    var startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    for (var ri = 0; ri < maxSample; ri++) {
      var row = generatedData.rawRows[ri];
      var rowVals = [];
      colOrder.forEach(function(vname) {
        var v = row[vname];
        rowVals.push(v === null || v === undefined ? '' : String(v));
      });
      // Thêm timestamp (giả lập ngày trong 60 ngày qua, giờ hành chính)
      var ts = new Date(startDate.getTime() + ri * Math.random() * 86400000);
      ts.setHours(8 + Math.floor(Math.random() * 10));
      ts.setMinutes(Math.floor(Math.random() * 60));
      rowVals.push(ts.toLocaleDateString('vi-VN') + ' ' + ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      dataRows2d.push(rowVals);
    }
  }
  var hasData = dataRows2d.length > 0;
  var dataJson = hasData ? JSON.stringify(dataRows2d) : 'null';

  let script = `// === Google Form Generator - Script tạo form từ model ===
// 📋 HƯỚNG DẪN:
// 1. Vào https://script.google.com → + New project
// 2. Paste code này → File > Save (Ctrl+S)
// 3. Chọn hàm "createSurveyForm" trong dropdown ▶ Run
// 4. Lần đầu: chọn tài khoản → Review Permissions → Allow
// 5. View > Logs để xem link Google Form

function onOpen() {
  try {
    const ui = FormApp.getUi();
    ui.createMenu('📋 Khảo sát')
      .addItem('🚀 Tạo Form từ Model', 'createSurveyForm')
      .addToUi();
  } catch(e) {
    // Chạy dạng standalone — bỏ qua UI menu
  }
}

function createSurveyForm() {
  const form = FormApp.create('Khảo sát - ${cKeys.map(k=>constructs[k].label).join(' & ') || 'Nghiên cứu'}');
  form.setDescription('Vui lòng trả lời các câu hỏi dưới đây theo thang điểm từ 1 (Hoàn toàn không đồng ý) đến 5 (Hoàn toàn đồng ý).');
  form.setCollectEmail(false);
  form.setShowLinkToRespondAgain(false);
  form.setLimitOneResponsePerUser(false);

  // === PHẦN GIỚI THIỆU ===
  const intro = form.addPageBreakItem();
  intro.setTitle('Giới thiệu');
  intro.setHelpText('Cảm ơn bạn đã tham gia khảo sát. Dữ liệu chỉ sử dụng cho mục đích nghiên cứu.');
`;

  cKeys.forEach((k, ki) => {
    const c = constructs[k];
    const items = c.items;
    script += `
  // === ${c.label} (${roleLabels[c.role] || 'Không xác định'}) ===
  const section${ki} = form.addPageBreakItem();
  section${ki}.setTitle('${c.label}');
  section${ki}.setHelpText('${roleLabels[c.role] || ''} • Đánh giá từ 1 (Rất không đồng ý) đến 5 (Rất đồng ý)');`;
    items.forEach((item, ii) => {
      const qText = (item.label !== item.name ? item.label + ' (' + item.name + ')' : item.name).replace(/'/g, "\\'");
      script += `
  // ${item.name}
  const q${ki}_${ii} = form.addMultipleChoiceItem();
  q${ki}_${ii}.setTitle('${qText}');
  q${ki}_${ii}.setRequired(true);
  q${ki}_${ii}.setChoices([
    q${ki}_${ii}.createChoice('1 - Rất không đồng ý'),
    q${ki}_${ii}.createChoice('2 - Không đồng ý'),
    q${ki}_${ii}.createChoice('3 - Trung lập'),
    q${ki}_${ii}.createChoice('4 - Đồng ý'),
    q${ki}_${ii}.createChoice('5 - Rất đồng ý')
  ]);`;
    });
  });

  if (demos.length > 0) {
    script += `
  // === THÔNG TIN NHÂN KHẨU HỌC ===
  const sectionDemo = form.addPageBreakItem();
  sectionDemo.setTitle('Thông tin nhân khẩu học');
  sectionDemo.setHelpText('Vui lòng cung cấp một số thông tin cơ bản về bạn.');`;
    demos.forEach((d, di) => {
      const dLabel = (d.label && d.label !== d.name ? d.label : d.name).replace(/'/g, "\\'");
      if (d.customValues && d.customValues.length > 0) {
        script += `
  // ${d.name}
  const d${di} = form.addMultipleChoiceItem();
  d${di}.setTitle('${dLabel}');
  d${di}.setRequired(false);
  d${di}.setChoices([${d.customValues.map((cv,ci) => `\n    d${di}.createChoice('${(ci+1)}. ${cv.replace(/'/g, "\\'")}')`).join(',')}
  ]);`;
      } else {
        script += `
  // ${d.name}
  const d${di} = form.addTextItem();
  d${di}.setTitle('${dLabel}');
  d${di}.setRequired(false);`;
      }
    });
  }

  const tsLabel = 'Thời gian tham gia khảo sát';
  script += `
  // === THỜI GIAN THAM GIA ===
  const tsItem = form.addTextItem();
  tsItem.setTitle('${tsLabel}');
  tsItem.setHelpText('Vui lòng nhập thời gian bạn thực hiện khảo sát này (DD/MM/YYYY HH:MM)');
  tsItem.setRequired(false);`;

  script += `
  // === KẾT THÚC ===
  const end = form.addPageBreakItem();
  end.setTitle('Kết thúc');
  end.setHelpText('Cảm ơn bạn đã hoàn thành khảo sát!');

  // === TẠO FILE SPREADSHEET "MỒI" CHỨA ENTRY ID ===
  const allItems = form.getItems();
  var entryIds = [];
  var questionTitles = [];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE || item.getType() === FormApp.ItemType.TEXT) {
      entryIds.push(item.getId());
      questionTitles.push(item.getTitle());
      Logger.log('Entry ID for "' + item.getTitle() + '": ' + item.getId());
    }
  }

  if (entryIds.length > 0) {
    var sheetName = 'Bo_Chay_SPSS_' + new Date().toISOString().slice(0,10);
    var ss = SpreadsheetApp.create(sheetName);
    var sheet = ss.getActiveSheet();
    sheet.setName('SPSS_Data');

    // Hàng 1: entry.xxxx
    var headerRow = entryIds.map(function(id) { return 'entry.' + id; });
    sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

    // Hàng 2: tên câu hỏi
    sheet.getRange(2, 1, 1, questionTitles.length).setValues([questionTitles]);

    // Format Hàng 1 in đậm
    sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
    sheet.getRange(2, 1, 1, questionTitles.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headerRow.length).setBackground('#f0fdf4');
    sheet.getRange(2, 1, 1, questionTitles.length).setBackground('#f8fafc');

    // Auto resize cột
    for (var c = 1; c <= headerRow.length; c++) {
      sheet.autoResizeColumn(c);
    }

    // Hàng 3+: dữ liệu mẫu (nếu có)
    var sampleData = ${dataJson};
    if (sampleData && sampleData.length > 0) {
      var numRows = sampleData.length;
      var dataRange = sheet.getRange(3, 1, numRows, sampleData[0].length);
      dataRange.setValues(sampleData.slice(0, numRows));
      Logger.log('Đã điền ' + numRows + ' dòng dữ liệu mẫu từ Hàng 3.');
    }

    Logger.log('=== FILE "MỒI" ĐÃ TẠO ===');
    Logger.log('Sheet URL: ' + ss.getUrl());
    Logger.log('Hàng 1: entry.xxxx đã được điền sẵn.');
    Logger.log('Hàng 2: tên câu hỏi.');
    Logger.log('Hàng 3+: dữ liệu mẫu (nếu có).');
    Logger.log('👉 Dán dữ liệu SPSS thật vào thay thế Hàng 3 trở xuống.');
  }

  Logger.log('Form URL: ' + form.getPublishedUrl());
  Logger.log('Edit URL: ' + form.getEditUrl());
}
`;

  const instructions = `
📋 HƯỚNG DẪN CHẠY SCRIPT:

1️⃣ Copy toàn bộ script bên dưới
2️⃣ Vào https://script.google.com
3️⃣ Bấm "+ New project" (Tạo dự án mới)
4️⃣ Xoá code mặc định → Paste script vào
5️⃣ File > Save (Ctrl+S) để lưu project
6️⃣ Chọn hàm "createSurveyForm" trong dropdown ▶ Run
7️⃣ Lần đầu: chọn tài khoản → Review Permissions → Allow
8️⃣ Sau khi chạy: View → Logs để xem link Google Form

⚠️ Yêu cầu: Tài khoản Google, kết nối Internet.
`;
  const fullContent = instructions + '\n' + script;
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) {
    const resultDiv = document.getElementById('gf-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div style="padding:.5rem;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius)">
      <div style="font-size:.85rem;font-weight:600;margin-bottom:.35rem">📋 Google Apps Script</div>
      <div style="font-size:.75rem;background:#fefce8;padding:.5rem;border-radius:4px;margin-bottom:.35rem;white-space:pre-line;color:#92400e">${instructions.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      <textarea style="width:100%;height:350px;font-family:monospace;font-size:.75rem;padding:.5rem;border:1px solid var(--gray-300);border-radius:4px" readonly>${script.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.querySelector('#gf-result textarea').value);showToast('✅ Đã copy script!','success')" style="margin-top:.35rem;font-size:.8rem">📋 Copy script</button>
    </div>`;
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Form Script</title>
  <style>
    body{font-family:system-ui,sans-serif;font-size:14px;padding:1rem;background:#f9fafb;color:#1f2937;line-height:1.5}
    .instructions{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:.75rem 1rem;margin-bottom:1rem;font-size:13px}
    .instructions h2{margin:0 0 .5rem;font-size:15px;color:#92400e}
    .instructions ol{margin:0;padding-left:1.2rem}
    .instructions li{margin-bottom:.25rem}
    .instructions code{background:#fef3c7;padding:1px 4px;border-radius:3px;font-size:12px}
    pre{background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.4;margin:0}
    #copy-btn{position:fixed;top:12px;right:12px;padding:8px 18px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;z-index:99;box-shadow:0 2px 8px rgba(79,70,229,0.3)}
    #copy-btn:hover{background:#4338ca}
  </style></head><body>
  <button id="copy-btn" onclick="copyAll()">📋 Copy script</button>
  <div class="instructions">
    <h2>📋 HƯỚNG DẪN CHẠY SCRIPT</h2>
    <ol>
      <li><b>Copy</b> toàn bộ script (bấm nút Copy góc phải)</li>
      <li>Vào <a href="https://script.google.com" target="_blank">script.google.com</a> → <b>+ New project</b></li>
      <li>Xoá code mặc định → <b>Paste</b> script → <b>File > Save (Ctrl+S)</b></li>
      <li>Chọn hàm <code>createSurveyForm</code> trong dropdown ▶ <b>Run</b></li>
      <li>Lần đầu: chọn tài khoản → <b>Review Permissions → Allow</b></li>
      <li>Sau khi chạy: <b>View → Logs</b> để xem link Google Form</li>
    </ol>
    <p style="margin:.5rem 0 0;font-size:12px">⚠️ Yêu cầu: Tài khoản Google, kết nối Internet.</p>
  </div>
  <pre id="script-code">${script.replace(/</g,'&lt;')}</pre>
  <script>
    function copyAll() {
      const text = document.getElementById('script-code').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = '✅ Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => { btn.textContent = '📋 Copy script'; btn.style.background = '#4f46e5'; }, 2000);
      }).catch(() => alert('Copy thủ công: bôi đen script → Ctrl+C'));
    }
  <\/script>
</body></html>`);
  win.document.close();
}

function generateTimestampScript() {
  const ds = document.getElementById('gf-date-start').value;
  const de = document.getElementById('gf-date-end').value;
  const hStart = parseInt(document.getElementById('gf-hour-start').value) || 7;
  const hEnd = parseInt(document.getElementById('gf-hour-end').value) || 23;
  const rateMin = parseInt(document.getElementById('gf-rate-min').value) || 2;
  const rateMax = parseInt(document.getElementById('gf-rate-max').value) || 5;

  const script = `// === Fake Timestamp Script ===
// 🕒 Script này sửa cột Timestamp (cột A) trong Google Sheet
// chứa responses của Google Form thành timestamp giả,
// rải rác theo khung giờ và khoảng ngày bạn đã cài trong tool.
//
// 📋 HƯỚNG DẪN:
// 1. Mở Google Sheet chứa responses (Tools → Script editor)
// 2. Paste code này → Save (Ctrl+S)
// 3. Chọn hàm "fakeTimestamps" → Run
// 4. Lần đầu: chọn tài khoản → Review Permissions → Allow
// 5. Sheet sẽ tự động cập nhật cột Timestamp

function fakeTimestamps() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('Sheet phải có ít nhất 2 dòng (header + 1 response).');
    return;
  }

  // Parameters (từ tool)
  var DATE_START = new Date('${ds || '2024-01-01'}');
  var DATE_END = new Date('${de || '2024-12-31'}');
  var HOUR_START = ${hStart};
  var HOUR_END = ${hEnd};
  var RATE_MIN = ${rateMin};
  var RATE_MAX = ${rateMax};

  // Generate schedule
  var schedule = [];
  var d = new Date(DATE_START);
  while (d <= DATE_END) {
    var dayStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    for (var h = HOUR_START; h <= HOUR_END; h++) {
      var count = RATE_MIN + Math.floor(Math.random() * (RATE_MAX - RATE_MIN + 1));
      for (var i = 0; i < count; i++) {
        var minute = Math.floor(Math.random() * 60);
        var second = Math.floor(Math.random() * 60);
        var ts = new Date(dayStr + 'T' + (h < 10 ? '0' : '') + h + ':' +
          (minute < 10 ? '0' : '') + minute + ':' + (second < 10 ? '0' : '') + second);
        schedule.push(ts);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  // Sort schedule ascending
  schedule.sort(function(a, b) { return a - b; });

  // Responses start from row 2 (row 1 = header)
  var totalRows = data.length - 1;
  if (schedule.length < totalRows) {
    SpreadsheetApp.getUi().alert('⚠️ Chỉ có ' + schedule.length + ' mốc thời gian nhưng có ' + totalRows + ' responses.\\n\\nTăng khoảng ngày hoặc Đơn/giờ để có đủ mốc.');
    return;
  }

  // Assign fake timestamps to column A
  var timeZone = Session.getScriptTimeZone();
  for (var i = 0; i < totalRows; i++) {
    var fakeTs = schedule[i];
    var row = i + 2;
    sheet.getRange(row, 1).setValue(fakeTs);
    sheet.getRange(row, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  }

  SpreadsheetApp.getUi().alert('✅ Đã fake ' + totalRows + ' timestamp thành công!\\n' +
    'Khoảng: ' + Utilities.formatDate(schedule[0], timeZone, 'dd/MM/yyyy') + ' → ' +
    Utilities.formatDate(schedule[totalRows-1], timeZone, 'dd/MM/yyyy'));
}`;

  document.getElementById('gf-result').style.display = 'block';
  document.getElementById('gf-result').innerHTML = `
    <div style="font-size:.85rem;font-weight:600;margin-bottom:.35rem">🕒 Script fake timestamp — chạy trên Google Sheet</div>
    <div style="font-size:.75rem;background:#fefce8;padding:.5rem;border-radius:4px;margin-bottom:.35rem;white-space:pre-line;color:#92400e">
📋 HƯỚNG DẪN:
1️⃣ Mở Google Sheet chứa responses
2️⃣ Extensions → Apps Script → + New project
3️⃣ Paste script → Save (Ctrl+S)
4️⃣ Chọn hàm "fakeTimestamps" → Run
5️⃣ Lần đầu: chọn tài khoản → Review Permissions → Allow
    </div>
    <textarea style="width:100%;height:250px;font-family:monospace;font-size:.75rem;padding:.5rem;border:1px solid var(--gray-300);border-radius:4px" readonly>${script.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
    <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.querySelector('#gf-result textarea').value);showToast('✅ Đã copy script!','success')" style="margin-top:.35rem">📋 Copy script</button>`;
}

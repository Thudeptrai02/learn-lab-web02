// ====== STATE ======
let variables = [];
let generatedData = null;
let _regressionResults = null;
let _dataSnapshot = null;
let _changedCells = {};
let _dataVersion = 0;
let modelNodePositions = {};

// ====== TAB SWITCHING ======
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab-btn[onclick*="'${name}'"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

// ====== TOGGLE COLLAPSIBLE SECTIONS ======
function toggleAdvForm() {
  const body = document.getElementById('adv-form-body');
  const arrow = document.getElementById('adv-form-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▶' : '▼';
}

function toggleQualityTargets() {
  const body = document.getElementById('q-targets-body');
  const arrow = document.getElementById('q-targets-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▶' : '▼';
}

function toggleDemoPanel() {
  const body = document.getElementById('demo-body');
  const arrow = document.getElementById('demo-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▶' : '▼';
  renderDemoList();
}

// ====== TOAST ======
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ====== IMPORT/EXPORT MODEL ======
function exportModel() {
  if (variables.length === 0) { showToast('Chưa có nhân tố nào để xuất', 'error'); return; }
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = { label: v.constructLabel || v.construct, role: v.role || 'independent', items: [] };
      constructs[v.construct].items.push({ name: v.name, label: v.label, loading: v.loading || 0.8 });
    }
  });
  const model = { version: 1, constructs: Object.keys(constructs).map(k => ({ ...constructs[k], items: undefined, itemCount: constructs[k].items.length, itemLabels: constructs[k].items.map(i => i.label), loadings: constructs[k].items.map(i => i.loading), name: k })) };
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `model_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Đã xuất mô hình!', 'success');
}

function importModel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const model = JSON.parse(e.target.result);
      if (!model.constructs || !Array.isArray(model.constructs)) throw new Error('Invalid format');
      if (variables.length > 0 && !confirm('Thay thế mô hình hiện tại bằng mô hình đã nhập?')) return;
      variables = [];
      generatedData = null; _regressionResults = null;
      const labels5 = ['Rất không đồng ý','Không đồng ý','Trung lập','Đồng ý','Rất đồng ý'];
      model.constructs.forEach(c => {
        const nItems = c.itemCount || c.items?.length || 4;
        for (let i = 1; i <= nItems; i++) {
          const itemLabel = c.itemLabels?.[i-1] || `${c.label} - câu hỏi ${i}`;
          variables.push({
            name: c.name + i, label: itemLabel, type: 'likert5', scale: 5, labels: labels5,
            construct: c.name, constructLabel: c.label, role: c.role || 'independent',
            loading: c.loadings?.[i-1] || 0.8
          });
        }
      });
      renderModelStructure();
      updateDownloadButtons();
      updatePreview(null);
      document.getElementById('gen-status').textContent = `✅ Đã nhập mô hình "${file.name}" (${variables.length} biến)`;
      showToast('Đã nhập mô hình thành công!', 'success');
    } catch (err) {
      showToast('❌ Lỗi đọc file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
  if (location.protocol === 'file:') {
    showToast('⚠️ Đang chạy từ file:// — nên dùng live server để AI hoạt động ổn định.', 'warn');
    const banner = document.createElement('div');
    banner.id = 'file-protocol-banner';
    banner.style.cssText = 'background:#fef3c7;color:#92400e;text-align:center;padding:.35rem .75rem;font-size:.75rem;border-bottom:1px solid #fde68a';
    banner.innerHTML = '⚠️ Đang chạy từ <code>file://</code> — AI và xuất báo cáo có thể không hoạt động. Dùng <strong>npm install -g serve && serve .</strong> để chạy live server.';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('input', function() {
      document.getElementById('ai-send-btn').disabled = !this.value.trim();
    });
  }

  document.getElementById('import-var-tbody').addEventListener('change', e => {
    const sel = e.target.closest('select[data-var]');
    if (sel) assignImportVar(sel.dataset.var, sel.value);
  });

  const hourOpts = (sel, def) => {
    for (let i = 0; i < 24; i++) {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = String(i).padStart(2, '0') + ':00';
      if (i === def) o.selected = true;
      sel.appendChild(o);
    }
  };
  hourOpts(document.getElementById('gf-hour-start'), 7);
  hourOpts(document.getElementById('gf-hour-end'), 23);

  const ds = document.getElementById('gf-date-start');
  const de = document.getElementById('gf-date-end');
  if (ds && de) {
    ds.value = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    de.value = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  }

  ['gf-date-start', 'gf-date-end', 'gf-hour-start', 'gf-hour-end', 'gf-rate-min', 'gf-rate-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateFillSummary);
  });
  updateFillSummary();

  if (typeof addDemoPctRow === 'function') {
    setTimeout(() => {
      addDemoPctRow();
      const table = document.getElementById('demo-pct-table');
      if (table) {
        table.addEventListener('change', function(e) {
          const input = e.target;
          if (input.type === 'number' && input.closest('tr')) {
            clampAndSuggestDemoPct(input);
          }
        });
        table.addEventListener('input', function(e) {
          const input = e.target;
          if (input.type === 'number' && input.closest('tr')) {
            updateDemoPctTotalDisplay();
          }
        });
      }
      updateDemoPctTotalDisplay();
    }, 100);
  }
});

/* ---- Adjust functions for quality report buttons ---- */
function adjustAlpha(constructKey, delta) {
  showToast('adjustAlpha: '+constructKey+' '+delta,'success');
  try {
  if (!generatedData?.rawRows) { showToast('adjustAlpha: no rawRows','error'); return; }
  const constructs = generatedData.constructs || {};
  const items = constructs[constructKey];
  if (!items || !items.length) { showToast('adjustAlpha: no items for '+constructKey,'error'); return; }
  const colHeaders = generatedData.colNames || [];
  const idxMap = items.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (idxMap.length < 2) { showToast('adjustAlpha: <2 items mapped','error'); return; }
  const nRows = generatedData.rawRows.length;
  const scaleMin = 1, scaleMax = 7;
  const rowMeans = generatedData.rawRows.map(r => {
    const vals = idxMap.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });
  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const mean = rowMeans[r];
    if (mean === 0) continue;
    const step = delta > 0 ? 1 : -1;
    idxMap.forEach(ci => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const dir = val >= mean ? 1 : -1;
      const oldVal = val;
      val = Math.round(val + step * dir);
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  const qc = document.getElementById('qualityContent');
  if (qc) {
    const c = generatedData?.constructs || {};
    showQualityReport(generatedData.rawRows || [], c, (generatedData.rawRows || []).length);
  }
  if (typeof showImportData === 'function') showImportData();
  } catch(e) { showToast('adjustAlpha: '+e.message,'error'); console.error(e); }
}
function adjustConstructLoading(constructKey, delta) {
  showToast('adjustLoading: '+constructKey+' '+delta,'success');
  try {
  if (!generatedData?.rawRows) return;
  const constructs = generatedData.constructs || {};
  const items = constructs[constructKey];
  if (!items || !items.length) return;
  const colHeaders = generatedData.colNames || [];
  const idxMap = items.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (idxMap.length < 2) return;
  const nRows = generatedData.rawRows.length;
  const composites = generatedData.rawRows.map(r => {
    const vals = idxMap.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });
  const scaleMin = 1, scaleMax = 7;
  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const comp = composites[r];
    if (comp === 0) continue;
    idxMap.forEach(ci => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const oldVal = val;
      if (delta > 0) { val += val < comp ? 1 : -1; }
      else { val += val <= comp ? -1 : 1; }
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  const qc = document.getElementById('qualityContent');
  if (qc) showQualityReport(generatedData.rawRows || [], generatedData.constructs || {}, (generatedData.rawRows || []).length);
  if (typeof showImportData === 'function') showImportData();
  } catch(e) { showToast('adjustLoading: '+e.message,'error'); console.error(e); }
}
function adjustRSq(delta) {
  showToast('adjustRSq: '+delta,'success');
  try {
  if (!generatedData?.rawRows) return;
  const regInfo = generatedData?.regressionInput || generatedData?.lastRegression;
  if (!regInfo) {
    const cs = generatedData.constructs || {};
    const keys = Object.keys(cs);
    if (keys.length < 2) return;
    adjustRSqByKeys(keys[0], keys[keys.length - 1], delta);
  } else {
    adjustRSqByKeys(regInfo.ivKey, regInfo.dvKey, delta);
  }
  } catch(e) { showToast('adjustRSq: '+e.message,'error'); console.error(e); }
}
function adjustRSqByKeys(ivKey, dvKey, delta) {
  try {
  const constructs = generatedData.constructs || {};
  const ivItems = constructs[ivKey] || [];
  const dvItems = constructs[dvKey] || [];
  const colHeaders = generatedData.colNames || [];
  const ivIdx = ivItems.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  const dvIdx = dvItems.map(item => colHeaders.indexOf(item.name || item)).filter(i => i >= 0);
  if (!ivIdx.length || !dvIdx.length) return;
  const nRows = generatedData.rawRows.length;
  const scaleMin = 1, scaleMax = 7;
  const ivComposites = generatedData.rawRows.map(r => {
    const vals = ivIdx.map(i => Number(r[colHeaders[i]])).filter(v => !isNaN(v) && v > 0);
    return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
  });
  for (let r = 0; r < nRows; r++) {
    const row = generatedData.rawRows[r];
    const iv = ivComposites[r];
    if (iv === 0) continue;
    dvIdx.forEach(ci => {
      const colName = colHeaders[ci];
      let val = Number(row[colName]);
      if (isNaN(val) || val <= 0) return;
      const oldVal = val;
      if (delta > 0) { val += val < iv ? 1 : val > iv ? -1 : 0; }
      else { if (val <= iv) val = Math.max(scaleMin, val - 1); else val = Math.min(scaleMax, val + 1); }
      val = Math.max(scaleMin, Math.min(scaleMax, val));
      if (val !== oldVal) {
        row[colName] = val;
        if (!window._changedCells) window._changedCells = {};
        if (!window._changedCells[r]) window._changedCells[r] = {};
        window._changedCells[r][colName] = { oldVal: oldVal, newVal: val };
      }
    });
  }
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  const qc = document.getElementById('qualityContent');
  if (qc) showQualityReport(generatedData.rawRows || [], generatedData.constructs || {}, (generatedData.rawRows || []).length);
  if (typeof showImportData === 'function') showImportData();
  } catch(e) { showToast('adjustRSqByKeys: '+e.message,'error'); console.error(e); }
}

/* ---- Document-level delegation for adjust buttons ---- */
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-adjust]');
  if (!btn) return;
  const type = btn.dataset.adjust;
  const key = btn.dataset.key;
  const delta = parseFloat(btn.dataset.delta);
  if (isNaN(delta)) return;
  showToast('Click: '+type+' '+key+' '+delta,'success');
  if (type === 'alpha') adjustAlpha(key, delta);
  else if (type === 'loading') adjustConstructLoading(key, delta);
  else if (type === 'rsq') adjustRSq(delta);
});

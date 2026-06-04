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

/* ---- Adjust functions using AI engine ---- */
function _adjustRefresh(constructsFromVariables) {
  if (generatedData.constructQualities) delete generatedData.constructQualities;
  if (generatedData.regressionCache) delete generatedData.regressionCache;
  showQualityReport(generatedData.rawRows, constructsFromVariables, generatedData.rawRows.length);
  if (typeof showImportData === 'function') showImportData();
}
function _buildConstructsFromVars() {
  const cs = {};
  variables.forEach(v => { if (v.construct) { if (!cs[v.construct]) cs[v.construct] = []; cs[v.construct].push(v); } });
  return cs;
}
function _snapshotAndDiff(newRows) {
  window._changedCells = {};
  const oldRows = window.__adjustSnapshot;
  if (!oldRows) return;
  newRows.forEach((row, ri) => {
    const old = oldRows[ri];
    if (!old) return;
    generatedData.colNames.forEach(c => {
      if (JSON.stringify(old[c]) !== JSON.stringify(row[c])) {
        if (!window._changedCells[ri]) window._changedCells[ri] = {};
        window._changedCells[ri][c] = { oldVal: old[c], newVal: row[c] };
      }
    });
  });
  window.__adjustSnapshot = null;
}

function adjustAlpha(constructKey, delta) {
  try {
    if (!generatedData?.rawRows) { showToast('adjustAlpha: chưa có dữ liệu','error'); return; }
    const items = variables.filter(v => v.construct === constructKey).map(v => v.name);
    if (items.length < 2) { showToast('Cần ≥2 items để tính alpha','error'); return; }
    const rows = generatedData.rawRows;
    const validRows = [];
    for (let i = 0; i < rows.length; i++) if (items.every(n => typeof rows[i][n] === 'number' && !isNaN(rows[i][n]))) validRows.push(i);
    const m = validRows.length;
    if (m < 5) { showToast('Quá ít mẫu hợp lệ','error'); return; }
    const scores = items.map(n => validRows.map(i => rows[i][n]));
    const means = scores.map(v => v.reduce((a,b)=>a+b,0)/m);
    const vars = scores.map((v,i) => v.reduce((a,b)=>a+(b-means[i])**2,0)/m);
    const sumVar = vars.reduce((a,b)=>a+b,0);
    let totalVar = 0;
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++)
      totalVar += scores[i].reduce((a,b,ri) => a+(b-means[i])*(scores[j][ri]-means[j]),0)/m;
    const currentAlpha = totalVar > 0 ? (items.length/(items.length-1)) * (1 - sumVar/totalVar) : 0;
    if (currentAlpha <= 0) { showToast('Không thể tính alpha','error'); return; }
    const targetAlpha = Math.min(0.98, Math.max(0.30, currentAlpha + delta));
    window.__adjustSnapshot = rows.map(r => ({...r}));
    aiAdjustAlphaDirect(constructKey, targetAlpha);
    _snapshotAndDiff(rows);
    const cs = _buildConstructsFromVars();
    _adjustRefresh(cs);
    const cnt = Object.values(window._changedCells || {}).reduce((s,cols) => s+Object.keys(cols).length, 0);
    showToast('α ' + constructKey + ': ' + currentAlpha.toFixed(3) + ' → ' + targetAlpha.toFixed(3) + ' (đã sửa ' + cnt + ' ô)', 'success');
  } catch(e) { showToast('adjustAlpha: '+e.message,'error'); console.error(e); }
}

function adjustConstructLoading(constructKey, delta) {
  try {
    if (!generatedData?.rawRows) { showToast('adjustLoading: chưa có dữ liệu','error'); return; }
    const items = variables.filter(v => v.construct === constructKey).map(v => v.name);
    if (items.length < 2) return;
    const rows = generatedData.rawRows;
    const validRows = [];
    for (let i = 0; i < rows.length; i++) if (items.every(n => typeof rows[i][n] === 'number' && !isNaN(rows[i][n]))) validRows.push(i);
    const m = validRows.length;
    if (m < 5) return;
    const scores = items.map(n => validRows.map(i => rows[i][n]));
    const means = scores.map(v => v.reduce((a,b)=>a+b,0)/m);
    const vars = scores.map((v,i) => v.reduce((a,b)=>a+(b-means[i])**2,0)/m);
    const sumVar = vars.reduce((a,b)=>a+b,0);
    let totalVar = 0;
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++)
      totalVar += scores[i].reduce((a,b,ri) => a+(b-means[i])*(scores[j][ri]-means[j]),0)/m;
    const currentAlpha = totalVar > 0 ? (items.length/(items.length-1)) * (1 - sumVar/totalVar) : 0;
    if (currentAlpha <= 0) { showToast('Không thể tính alpha cho loading','error'); return; }
    const alphaDelta = delta * 0.5;
    const targetAlpha = Math.min(0.98, Math.max(0.30, currentAlpha + alphaDelta));
    window.__adjustSnapshot = rows.map(r => ({...r}));
    aiAdjustAlphaDirect(constructKey, targetAlpha);
    _snapshotAndDiff(rows);
    const cs = _buildConstructsFromVars();
    _adjustRefresh(cs);
    const cnt = Object.values(window._changedCells || {}).reduce((s,cols) => s+Object.keys(cols).length, 0);
    showToast('Loading ' + constructKey + ': đã điều chỉnh (sửa ' + cnt + ' ô)', 'success');
  } catch(e) { showToast('adjustLoading: '+e.message,'error'); console.error(e); }
}

function adjustRSq(delta) {
  try {
    if (!generatedData?.rawRows) { showToast('adjustRSq: chưa có dữ liệu','error'); return; }
    const regInfo = generatedData?.regressionInput || generatedData?.lastRegression;
    let dvKey;
    if (regInfo?.dvKey) {
      dvKey = regInfo.dvKey;
    } else {
      const allVars = variables.filter(v => v.construct);
      const allCons = [...new Set(allVars.map(v => v.construct))];
      const dvs = allCons.filter(k => allVars.find(v => v.construct === k)?.role === 'dependent');
      dvKey = dvs.length > 0 ? dvs[0] : allCons[allCons.length - 1];
    }
    if (!dvKey) { showToast('Không xác định được biến phụ thuộc','error'); return; }
    adjustRSqByKey(dvKey, delta);
  } catch(e) { showToast('adjustRSq: '+e.message,'error'); console.error(e); }
}
function adjustRSqByKey(dvKey, delta) {
  try {
    if (!generatedData?.rawRows) return;
    const rows = generatedData.rawRows;
    const allVars = variables.filter(v => v.construct);
    const predictors = [...new Set(allVars.map(v => v.construct))]
      .filter(k => k !== dvKey && allVars.find(v => v.construct === k)?.role !== 'moderating');
    if (predictors.length === 0) { showToast('Không có biến độc lập','error'); return; }
    const comp = {};
    [...predictors, dvKey].forEach(k => {
      const its = variables.filter(v => v.construct === k).map(v => v.name);
      comp[k] = rows.map(r => {
        let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}}); return c>0?s/c:null;
      });
    });
    const valid = [];
    for (let i = 0; i < rows.length; i++)
      if (comp[dvKey][i] !== null && predictors.every(p => comp[p][i] !== null)) valid.push(i);
    const n = valid.length;
    if (n < 10) { showToast('Quá ít mẫu','error'); return; }
    const y = valid.map(i => comp[dvKey][i]);
    const yMean = y.reduce((a,b)=>a+b,0)/n;
    const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/n) || 1;
    const Z = predictors.map(p => {
      const x = valid.map(i => comp[p][i]);
      const m = x.reduce((a,b)=>a+b,0)/n;
      const s = Math.sqrt(x.reduce((a,b)=>a+(b-m)**2,0)/n) || 1;
      return x.map(v => (v - m) / s);
    });
    const zY = y.map(v => (v - yMean) / ySd);
    const k = predictors.length;
    const ZtZinv = matInverse(Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>{
      let s=0; for(let ri=0; ri<n; ri++) s += Z[i][ri] * Z[j][ri]; return s/n;
    }));
    if (!ZtZinv) { showToast('Không thể tính R²','error'); return; }
    const Zty = predictors.map((_,i)=>{let s=0;for(let ri=0;ri<n;ri++)s+=Z[i][ri]*zY[ri];return s/n;});
    const beta = ZtZinv.map(r => r.reduce((a,v,j) => a+v*Zty[j], 0));
    const currentR2 = Math.max(0.01, Math.min(0.99, beta.reduce((a,b,j) => a+b*Zty[j], 0)));
    const targetR2 = Math.min(0.95, Math.max(0.03, currentR2 + delta));
    window.__adjustSnapshot = rows.map(r => ({...r}));
    aiSetRSquaredDirect(dvKey, targetR2);
    _snapshotAndDiff(rows);
    const cs = _buildConstructsFromVars();
    _adjustRefresh(cs);
    const cnt = Object.values(window._changedCells || {}).reduce((s,cols) => s+Object.keys(cols).length, 0);
    showToast('R² ' + dvKey + ': ' + currentR2.toFixed(3) + ' → ' + targetR2.toFixed(3) + ' (sửa ' + cnt + ' ô)', 'success');
  } catch(e) { showToast('adjustRSq: '+e.message,'error'); console.error(e); }
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

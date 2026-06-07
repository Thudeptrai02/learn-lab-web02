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
    if (el) el.addEventListener('change', function() {});
  });

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

// ====== MODEL STRUCTURE BUILDER (visual canvas) ======
function renderModelStructure() {
  const container = document.getElementById('model-container');
  const badge = document.getElementById('model-badge');
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });
  const keys = Object.keys(constructs);
  badge.textContent = `${keys.length} nhân tố`;
  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Chưa có nhân tố nào. Thêm nhân tố để xây dựng mô hình.</p></div>';
    return;
  }

  const roleColors = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };
  const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };
  const roleOrder = { independent:0, mediating:1, dependent:2, moderating:3 };
  const sortedKeys = [...keys].sort((a,b) => (roleOrder[constructs[a][0]?.role]||0) - (roleOrder[constructs[b][0]?.role]||0));

  const cw = Math.max(640, container.clientWidth || 780);
  const colX = { independent: 24, mediating: Math.round(cw*0.34), dependent: Math.round(cw*0.64) };
  const colCount = { independent:0, dependent:0, mediating:0 };
  sortedKeys.forEach(k => {
    const r = constructs[k][0]?.role || 'independent';
    if (r === 'moderating') return;
    colCount[r] = (colCount[r]||0) + 1;
  });
  const colIdx = { independent:0, dependent:0, mediating:0 };
  const rowH = 128;
  const usedH = Math.max(3, Math.max(colCount.independent||0, colCount.dependent||0, colCount.mediating||0)) * rowH + 60;
  const ch = Math.max(340, usedH, sortedKeys.length * 70 + 80);

  let nodesHtml = '', edgeList = [];

  sortedKeys.forEach(k => {
    const items = constructs[k];
    const v0 = items[0];
    const role = v0.role || 'independent';
    const rc = roleColors[role] || '#666';
    const rl = roleLabels[role] || '';

    let x, y;
    if (modelNodePositions[k]) {
      x = modelNodePositions[k].x; y = modelNodePositions[k].y;
    } else if (role === 'moderating') {
      x = 24; y = ch - 70;
    } else {
      const ci = colIdx[role]++; const total = colCount[role]||1;
      const areaH = ch - 80; const rowGap = Math.min(rowH, Math.max(70, (areaH - 50) / total));
      x = (colX[role]||24); y = 30 + ci * rowGap;
    }

    const label = v0.constructLabel || '';
    const itemNames = items.map(v => v.name).join(', ');
    const itemCount = items.length;

    nodesHtml += `<div class="model-node" data-construct="${k}" style="position:absolute;left:${x}px;top:${y}px;width:224px;background:#fff;border-radius:12px;border:2px solid ${rc};box-shadow:0 4px 16px ${rc}22;z-index:10;cursor:grab;user-select:none">
      <div style="padding:.5rem .7rem;background:${rc}0d;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:.3rem;min-width:0">
          <strong style="font-size:.85rem;color:#1f2937;white-space:nowrap">${k}</strong>
          ${label ? `<span style="font-size:.7rem;color:var(--gray-400);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70px">${label}</span>` : ''}
          <span style="font-size:.6rem;font-weight:600;color:#fff;background:${rc};padding:.08rem .45rem;border-radius:999px">${rl}</span>
        </div>
        <div style="display:flex;gap:.2rem;flex-shrink:0">
          <button class="model-btn" onclick="editModelNode('${k}')" title="Sửa thang đo" style="font-size:.7rem;padding:2px 6px;border:1px solid var(--gray-200);border-radius:6px;background:#fff;cursor:pointer;line-height:1">✏️</button>
          <button class="model-btn" onclick="addModelItem('${k}')" title="Thêm item" style="font-size:.7rem;padding:2px 6px;border:1px solid var(--gray-200);border-radius:6px;background:#fff;cursor:pointer;line-height:1">➕</button>
          <button class="model-btn" onclick="removeModelConstruct('${k}')" title="Xóa nhân tố" style="font-size:.7rem;padding:2px 6px;border:1px solid var(--gray-200);border-radius:6px;background:#fff;cursor:pointer;line-height:1">🗑️</button>
        </div>
      </div>
      <div style="padding:.35rem .7rem .5rem;font-size:.7rem" ondblclick="editModelNode('${k}')">
        <div style="color:var(--gray-500)">${itemCount} biến</div>
        ${role === 'dependent' && _regressionResults ? `<div style="margin-top:.2rem;font-size:.75rem;font-weight:700;color:#059669">R² = ${_regressionResults.rSquared.toFixed(3)}</div>` : ''}
        <div style="color:var(--gray-400);margin-top:.1rem;font-size:.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemNames}</div>
      </div>
    </div>`;

    if (role === 'independent') {
      sortedKeys.forEach(tk => {
        const tr = constructs[tk][0]?.role || '';
        const target = tk;
        const pred = k;
        let regInfo = { beta: null, pValue: 1, sig: true, label: 'β' };
        if (_regressionResults && _regressionResults.paths[pred]) {
          const r = _regressionResults.paths[pred];
          regInfo = { beta: r.stdBeta, pValue: r.pValue, sig: r.sig, label: '' };
        }
        const label = regInfo.beta !== null
          ? `β=${regInfo.beta.toFixed(3)}${regInfo.sig ? (regInfo.pValue<0.001?'***':regInfo.pValue<0.01?'**':'*') : ' ns'}`
          : 'β';
        if (tr === 'dependent') edgeList.push({ from:k, to:target, color:'#2563eb', label, ...regInfo });
        if (tr === 'mediating') edgeList.push({ from:k, to:target, color:'#2563eb', label, ...regInfo });
      });
    }
    if (role === 'mediating') {
      sortedKeys.forEach(tk => {
        if ((constructs[tk][0]?.role||'') === 'dependent') {
          const pred = k;
          let regInfo = { beta: null, pValue: 1, sig: true, label: 'b' };
          if (_regressionResults && _regressionResults.paths[pred]) {
            const r = _regressionResults.paths[pred];
            regInfo = { beta: r.stdBeta, pValue: r.pValue, sig: r.sig, label: '' };
          }
          const label = regInfo.beta !== null
            ? `β=${regInfo.beta.toFixed(3)}${regInfo.sig ? (regInfo.pValue<0.001?'***':regInfo.pValue<0.01?'**':'*') : ' ns'}`
            : 'b';
          edgeList.push({ from:k, to:tk, color:'#d97706', label, ...regInfo });
        }
      });
    }
    if (role === 'moderating') {
      sortedKeys.forEach(tk => {
        if ((constructs[tk][0]?.role||'') === 'dependent') {
          edgeList.push({ from:k, to:tk, color:'#7c3aed', label:'Mod', beta:null, pValue:1, sig:true });
        }
      });
    }
  });

  const defs = `<marker id="arr-blue" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#2563eb"/></marker>
    <marker id="arr-blue-dim" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#93c5fd"/></marker>
    <marker id="arr-amber" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#d97706"/></marker>
    <marker id="arr-amber-dim" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24"/></marker>`;

  let legendHtml = '';
  if (_regressionResults) {
    legendHtml = `<div style="position:absolute;bottom:8px;right:12px;z-index:15;background:#fff;border:1px solid var(--gray-200);border-radius:8px;padding:.4rem .7rem;font-size:.65rem;display:flex;gap:.6rem;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
      <span><span style="display:inline-block;width:18px;height:2px;background:#2563eb;vertical-align:middle;margin-right:3px"></span> p&lt;0.05</span>
      <span><span style="display:inline-block;width:18px;height:1px;border-top:2px dashed #93c5fd;vertical-align:middle;margin-right:3px"></span> Không ý nghĩa</span>
      <span>β: <span style="font-weight:600">***</span> p&lt;0.001 &nbsp;<span style="font-weight:600">**</span> p&lt;0.01 &nbsp;<span style="font-weight:600">*</span> p&lt;0.05 &nbsp;<span style="font-weight:600;color:#9ca3af">ns</span> không ý nghĩa</span>
    </div>`;
  }

  container.innerHTML = `<div id="model-canvas" style="position:relative;min-height:340px;height:${ch}px;background:#f8fafc;border-radius:12px;border:1px solid var(--gray-200);overflow:hidden">
    <svg id="model-arrows" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5"><defs>${defs}</defs></svg>
    ${nodesHtml}
    ${legendHtml}
  </div>`;

  requestAnimationFrame(() => { drawModelArrows(edgeList); });
  attachModelDrag();
}

function getModelNodeRect(key) {
  const el = document.querySelector(`.model-node[data-construct="${key}"]`);
  const canvas = document.getElementById('model-canvas');
  if (!el||!canvas) return null;
  const cr = canvas.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  return { left:er.left-cr.left, top:er.top-cr.top, width:er.width, height:er.height, right:er.right-cr.left, bottom:er.bottom-cr.top };
}

function drawModelArrows(edgeList) {
  const svg = document.getElementById('model-arrows');
  if (!svg || !edgeList) return;
  let html = '';
  edgeList.forEach(e => {
    const src = getModelNodeRect(e.from);
    const tgt = getModelNodeRect(e.to);
    if (!src || !tgt) return;
    const x1 = src.right, y1 = src.top + src.height/2;
    const x2 = tgt.left, y2 = tgt.top + tgt.height/2;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
    const cp = (y1 + y2) / 2 + Math.sin((x2-x1)/200)*10;

    const absBeta = Math.abs(e.beta || 0.15);
    const sig = e.sig !== undefined ? e.sig : true;
    const strokeWidth = Math.max(1.5, Math.min(5, absBeta * 7));
    const dash = sig ? '' : '6,4';
    const opacity = sig ? 0.8 : 0.35;

    const isBlue = e.color === '#2563eb';
    const arrowId = isBlue ? (sig ? 'arr-blue' : 'arr-blue-dim') : (sig ? 'arr-amber' : 'arr-amber-dim');
    const strokeColor = isBlue ? (sig ? '#2563eb' : '#93c5fd') : (sig ? '#d97706' : '#fbbf24');

    html += `<path d="M ${x1} ${y1} C ${x1+dx} ${cp}, ${x2-dx} ${cp}, ${x2} ${y2}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" opacity="${opacity}" marker-end="url(#${arrowId})"/>`;

    const mx = (x1+x2)/2, my = cp - 14;
    const labelColor = sig ? strokeColor : '#9ca3af';
    html += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="10" font-weight="600" fill="${labelColor}" opacity="0.9">${e.label || ''}</text>`;
  });
  svg.innerHTML = svg.innerHTML.split('>')[0] + '>' + html;
}

let _dragState = null;
function attachModelDrag() {
  const canvas = document.getElementById('model-canvas');
  if (!canvas) return;
  canvas.querySelectorAll('.model-node').forEach(node => {
    node.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      const key = node.dataset.construct;
      const rect = node.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      _dragState = { key, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
      node.style.cursor = 'grabbing';
      node.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
      e.preventDefault();
    });
  });
}

document.addEventListener('mousemove', e => {
  if (!_dragState) return;
  const node = document.querySelector(`.model-node[data-construct="${_dragState.key}"]`);
  const canvas = document.getElementById('model-canvas');
  if (!node||!canvas) return;
  const cr = canvas.getBoundingClientRect();
  let x = e.clientX - cr.left - _dragState.ox;
  let y = e.clientY - cr.top - _dragState.oy;
  x = Math.max(0, Math.min(cr.width - node.offsetWidth, x));
  y = Math.max(0, Math.min(cr.height - node.offsetHeight, y));
  node.style.left = x + 'px'; node.style.top = y + 'px';
  const constructs = {}; variables.forEach(v => { if(v.construct){if(!constructs[v.construct])constructs[v.construct]=[];constructs[v.construct].push(v);} });
  const keys = Object.keys(constructs); const edges = [];
  keys.forEach(sk => {
    const sr = constructs[sk][0]?.role||'';
    function buildRegEdge(from, to, defaultLabel, color) {
      let beta=null, pValue=1, sig=true;
      if (_regressionResults && _regressionResults.paths[from]) {
        const r = _regressionResults.paths[from];
        beta = r.stdBeta; pValue = r.pValue; sig = r.sig;
      }
      const label = beta !== null
        ? `β=${beta.toFixed(3)}${sig ? (pValue<0.001?'***':pValue<0.01?'**':'*') : ' ns'}`
        : defaultLabel;
      edges.push({ from:sk, to:tk, color, label, beta, pValue, sig });
    }
    if (sr==='independent') {
      keys.forEach(tk=>{
        const tr=constructs[tk][0]?.role||'';
        if (tr==='dependent') buildRegEdge(sk, tk, 'β', '#2563eb');
        if (tr==='mediating') buildRegEdge(sk, tk, 'a', '#2563eb');
      });
    }
    if (sr==='mediating') {
      keys.forEach(tk=>{
        if ((constructs[tk][0]?.role||'')==='dependent') buildRegEdge(sk, tk, 'b', '#d97706');
      });
    }
  });
  drawModelArrows(edges);
});

document.addEventListener('mouseup', () => {
  if (!_dragState) return;
  const node = document.querySelector(`.model-node[data-construct="${_dragState.key}"]`);
  if (node) { node.style.cursor = 'grab'; node.style.boxShadow = ''; }
  if (node) { modelNodePositions[_dragState.key] = { x: parseInt(node.style.left), y: parseInt(node.style.top) }; }
  _dragState = null;
});

function editModelNode(key) {
  const items = variables.filter(v => v.construct === key);
  if (items.length === 0) return;
  const v0 = items[0];
  const modal = document.getElementById('scale-editor-modal');
  document.getElementById('scale-editor-title').textContent = `✏️ Thang đo: ${key} (${v0.constructLabel||key})`;
  const tbody = document.getElementById('scale-editor-body');
  let h = '';
  items.forEach((v, i) => {
    h += `<tr>
      <td style="padding:.25rem;font-size:.8rem">${v.name}</td>
      <td style="padding:.25rem"><input type="text" value="${v.label||''}" data-field="label" data-idx="${i}" data-key="${key}" style="width:100%;font-size:.8rem;padding:.2rem .4rem;border:1px solid var(--gray-200);border-radius:4px"></td>
      <td style="padding:.25rem"><input type="number" value="${v.loading||0.75}" data-field="loading" data-idx="${i}" data-key="${key}" step="0.05" min="0.4" max="0.95" style="width:60px;font-size:.8rem;padding:.2rem .4rem;border:1px solid var(--gray-200);border-radius:4px"></td>
      <td style="padding:.25rem;text-align:center"><button class="btn btn-danger btn-sm" onclick="removeModelItem('${key}',${i})" style="font-size:.65rem;padding:.1rem .4rem" ${items.length <= 2 ? 'disabled title="Cần ít nhất 2 items"' : ''}>✕</button></td>
    </tr>`;
  });
  tbody.innerHTML = h;
  document.getElementById('scale-editor-save').onclick = () => {
    const inputs = tbody.querySelectorAll('input[data-field]');
    inputs.forEach(inp => {
      const idx = parseInt(inp.dataset.idx); const field = inp.dataset.field; const val = field==='loading'?parseFloat(inp.value)||0.75:inp.value;
      let found=0; variables.forEach(v=>{if(v.construct===key){if(found===idx)v[field]=val;found++;}});
    });
    modelNodePositions = {}; renderModelStructure();
    document.getElementById('gen-status').textContent = `✅ Đã cập nhật thang đo "${key}"`;
    modal.style.display = 'none';
  };
  modal.style.display = 'flex';
}

function addModelConstruct() {
  const name = document.getElementById('mc-name').value.trim().toUpperCase();
  const label = document.getElementById('mc-label').value.trim();
  const role = document.getElementById('mc-role').value;
  const nItems = parseInt(document.getElementById('mc-items').value) || 4;
  if (!name) { showToast('Vui lòng nhập tên nhân tố', 'error'); return; }
  if (variables.some(v => v.construct === name)) { showToast(`Nhân tố "${name}" đã tồn tại`, 'error'); return; }
  const labels5 = ['Rất không đồng ý','Không đồng ý','Trung lập','Đồng ý','Rất đồng ý'];
  for (let i = 1; i <= nItems; i++) {
    variables.push({
      name: name + i, label: `${label || name} - câu hỏi ${i}`,
      type: 'likert5', scale: 5, labels: labels5,
      construct: name, constructLabel: label || name, role, loading: 0.8
    });
  }
  document.getElementById('mc-name').value = '';
  document.getElementById('mc-label').value = '';
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderModelStructure();
  document.getElementById('gen-status').textContent = `✅ Đã thêm nhân tố "${name}" (${nItems} items)`;
}

function updateModelItem(idx, constructKey, field, value) {
  let found = 0;
  variables.forEach(v => {
    if (v.construct === constructKey) {
      if (found === idx) { v[field] = value; }
      found++;
    }
  });
}

function removeModelConstruct(constructKey) {
  if (!confirm(`Xóa nhân tố "${constructKey}" và tất cả items?`)) return;
  variables = variables.filter(v => v.construct !== constructKey);
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderModelStructure();
}

function addModelItem(constructKey) {
  const items = variables.filter(v => v.construct === constructKey);
  if (items.length === 0) return;
  const t = items[0];
  const num = items.length + 1;
  const idx = variables.lastIndexOf(items[items.length-1]) + 1;
  variables.splice(idx, 0, {
    name: constructKey + num, label: `${t.constructLabel || constructKey} - câu hỏi ${num}`,
    type: t.type, scale: t.scale, labels: t.labels,
    construct: constructKey, constructLabel: t.constructLabel, role: t.role, loading: t.loading || 0.8
  });
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderModelStructure();
}

function removeModelItem(constructKey, itemIdx) {
  const items = variables.filter(v => v.construct === constructKey);
  if (items.length <= 2) { showToast('Cần ít nhất 2 items cho mỗi nhân tố', 'error'); return; }
  const target = items[itemIdx];
  if (!target) return;
  variables = variables.filter(v => !(v.name === target.name && v.construct === constructKey));
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderModelStructure();
  showToast(`Đã xóa ${target.name}`, 'success');
}

// ====== TEMPLATES (mẫu nhanh) ======
const TEMPLATES = {
  '3iv': { label:'3 IV → 1 DV', constructs:[{name:'CL',label:'Chất lượng cảm nhận',role:'independent',items:4},{name:'GC',label:'Giá cả cảm nhận',role:'independent',items:4},{name:'DV',label:'Dịch vụ khách hàng',role:'independent',items:4},{name:'HL',label:'Sự hài lòng',role:'dependent',items:4}] },
  '4iv': { label:'4 IV → 1 DV', constructs:[{name:'CL',label:'Chất lượng sản phẩm',role:'independent',items:4},{name:'GC',label:'Giá cả',role:'independent',items:3},{name:'DV',label:'Dịch vụ',role:'independent',items:3},{name:'TT',label:'Thương hiệu',role:'independent',items:3},{name:'HL',label:'Sự hài lòng',role:'dependent',items:4}] },
  'med': { label:'IV → Trung gian → DV', constructs:[{name:'CL',label:'Chất lượng cảm nhận',role:'independent',items:4},{name:'DV',label:'Dịch vụ',role:'independent',items:4},{name:'NT',label:'Niềm tin',role:'mediating',items:3},{name:'YD',label:'Ý định mua lại',role:'dependent',items:3}] },
  'crm': { label:'CRM (5 IV → DV)', constructs:[{name:'SP',label:'Chất lượng SP',role:'independent',items:4},{name:'GC',label:'Giá cả',role:'independent',items:3},{name:'DV',label:'Dịch vụ KH',role:'independent',items:3},{name:'CN',label:'Công nghệ',role:'independent',items:3},{name:'TH',label:'Thương hiệu',role:'independent',items:3},{name:'HL',label:'Hài lòng KH',role:'dependent',items:4}] },
  'tam': { label:'TAM (IV→Med→DV)', constructs:[{name:'HI',label:'Hữu ích',role:'independent',items:4},{name:'DD',label:'Dễ dùng',role:'independent',items:4},{name:'TD',label:'Thái độ',role:'mediating',items:3},{name:'YD',label:'Ý định SD',role:'dependent',items:3}] },
  'servqual': { label:'SERVQUAL (5 → HL)', constructs:[{name:'TC',label:'Tin cậy',role:'independent',items:4},{name:'DU',label:'Đáp ứng',role:'independent',items:4},{name:'NL',label:'Năng lực',role:'independent',items:4},{name:'DC',label:'Đồng cảm',role:'independent',items:4},{name:'HH',label:'Phương tiện hữu hình',role:'independent',items:4},{name:'HL',label:'Hài lòng',role:'dependent',items:4}] },
  'utaut': { label:'UTAUT (4 IV → YD)', constructs:[{name:'HQ',label:'Hiệu quả kỳ vọng',role:'independent',items:4},{name:'DD',label:'Dễ dùng kỳ vọng',role:'independent',items:4},{name:'XH',label:'Ảnh hưởng xã hội',role:'independent',items:3},{name:'DK',label:'Điều kiện thuận lợi',role:'independent',items:3},{name:'YD',label:'Ý định hành vi',role:'dependent',items:3}] },
  'anova': { label:'ANOVA (3 nhóm → DV)', constructs:[{name:'PP',label:'Phương pháp GD',role:'independent',items:1},{name:'PP2',label:'Phương pháp GD (item 2)',role:'independent',items:1},{name:'PP3',label:'Phương pháp GD (item 3)',role:'independent',items:1},{name:'KQ',label:'Kết quả học tập',role:'dependent',items:4}] },
  'mod': { label:'Điều tiết (IV × Moderator → DV)', constructs:[{name:'CL',label:'Chất lượng SP',role:'independent',items:4},{name:'GC',label:'Giá cả',role:'moderating',items:3},{name:'HL',label:'Hài lòng',role:'dependent',items:4}] }
};

function loadTemplate(key) {
  const tpl = TEMPLATES[key];
  if (!tpl) return;
  if (variables.length > 0 && !confirm('Thay thế mô hình hiện tại bằng mẫu "' + tpl.label + '"? Dữ liệu cũ sẽ bị xóa.')) return;
  variables = [];
  generatedData = null;
  _regressionResults = null;
  const labels5 = ['Rất không đồng ý','Không đồng ý','Trung lập','Đồng ý','Rất đồng ý'];
  tpl.constructs.forEach(c => {
    for (let i = 1; i <= c.items; i++) {
      variables.push({
        name: c.name + i, label: `${c.label} - câu hỏi ${i}`,
        type: 'likert5', scale: 5, labels: labels5,
        construct: c.name, constructLabel: c.label, role: c.role, loading: 0.8
      });
    }
  });
  renderModelStructure();
  updateDownloadButtons();
  updatePreview(null);
  document.getElementById('gen-status').textContent = `✅ Đã tải mẫu "${tpl.label}" (${variables.length} biến) — đang tạo dữ liệu...`;
  showToast(`Đã tải mẫu "${tpl.label}"`, 'success');
  setTimeout(() => { smartGenerate(); }, 100);
}

// ====== DEMOGRAPHIC VARIABLES ======
const demoPresets = {
  gender: { name: 'GioiTinh', label: 'Giới tính', pcts: 'Nam: 48\nNữ: 48\nKhác: 4' },
  age: { name: 'DoTuoi', label: 'Độ tuổi', pcts: 'Dưới 18: 10\n18-24: 25\n25-34: 30\n35-44: 18\n45-54: 12\nTrên 55: 5' },
  education: { name: 'HocVan', label: 'Học vấn', pcts: 'Dưới THPT: 5\nTHPT: 25\nCao đẳng/Trung cấp: 20\nĐại học: 35\nSau đại học: 15' },
  income: { name: 'ThuNhap', label: 'Thu nhập', pcts: 'Dưới 5 triệu: 20\n5-10 triệu: 30\n10-20 triệu: 25\n20-50 triệu: 18\nTrên 50 triệu: 7' },
  region: { name: 'KhuVuc', label: 'Khu vực', pcts: 'Đồng bằng sông Hồng: 22\nTrung du miền núi Bắc Bộ: 13\nBắc Trung Bộ: 12\nDuyên hải Nam Trung Bộ: 11\nTây Nguyên: 6\nĐông Nam Bộ: 18\nĐồng bằng sông Cửu Long: 18' },
  marital: { name: 'HonNhan', label: 'Tình trạng hôn nhân', pcts: 'Độc thân: 35\nĐã kết hôn: 55\nLy hôn: 7\nGóa: 3' },
  job: { name: 'NgheNghiep', label: 'Nghề nghiệp', pcts: 'Học sinh/Sinh viên: 15\nNhân viên văn phòng: 30\nCông nhân: 15\nKinh doanh: 18\nNội trợ: 8\nHưu trí: 7\nKhác: 7' }
};

function updateDemoPctTotalDisplay() {
  const tbody = document.getElementById('demo-pct-table');
  const totalEl = document.getElementById('demo-pct-total');
  if (!tbody || !totalEl) return;
  let total = 0;
  let emptyCount = 0;
  for (let i = 1; i < tbody.rows.length; i++) {
    const inputs = tbody.rows[i].querySelectorAll('input');
    if (inputs.length < 2) continue;
    const val = parseFloat(inputs[1].value);
    if (!isNaN(val) && val > 0) { total += val; } else { emptyCount++; }
  }
  const remaining = Math.max(0, 100 - total);
  totalEl.innerHTML = `Tổng: <strong>${total.toFixed(1)}%</strong> / 100% <span style="color:${total === 100 ? 'var(--success)' : 'var(--gray-400)'}">(còn ${remaining.toFixed(1)}%)</span>`;
  totalEl.style.color = total === 100 ? 'var(--success)' : 'var(--gray-500)';
}

function clampAndSuggestDemoPct(changedInput) {
  const tbody = document.getElementById('demo-pct-table');
  if (!tbody) return;
  let sumOthers = 0;
  let emptyInputs = [];
  for (let i = 1; i < tbody.rows.length; i++) {
    const inputs = tbody.rows[i].querySelectorAll('input');
    if (inputs.length < 2) continue;
    const pctInput = inputs[1];
    if (pctInput === changedInput) continue;
    const val = parseFloat(pctInput.value);
    if (!isNaN(val) && val > 0) { sumOthers += val; } else { emptyInputs.push(pctInput); }
  }
  const maxAllowed = Math.max(0, 100 - sumOthers);
  const currentVal = parseFloat(changedInput.value);
  if (!isNaN(currentVal) && currentVal > maxAllowed) {
    changedInput.value = maxAllowed.toFixed(1);
    showToast(`Tỷ lệ tối đa cho nhóm này là ${maxAllowed.toFixed(1)}%`, 'error');
  }
  let total = 0;
  emptyInputs = [];
  for (let i = 1; i < tbody.rows.length; i++) {
    const inputs = tbody.rows[i].querySelectorAll('input');
    if (inputs.length < 2) continue;
    const pctInput = inputs[1];
    const val = parseFloat(pctInput.value);
    if (!isNaN(val) && val > 0) { total += val; } else { emptyInputs.push(pctInput); }
  }
  const remaining = Math.max(0, 100 - total);
  emptyInputs.forEach(inp => { inp.placeholder = ''; });
  if (emptyInputs.length === 1) { emptyInputs[0].value = remaining.toFixed(1); }
  else if (emptyInputs.length > 1) { emptyInputs[0].placeholder = `Gợi ý: ${remaining.toFixed(1)}%`; }
  updateDemoPctTotalDisplay();
}

function fillDemo(key) {
  const p = demoPresets[key];
  if (!p) return;
  document.getElementById('demo-name').value = p.name;
  document.getElementById('demo-label').value = p.label;
  const rows = p.pcts.split('\n').map(l => l.trim()).filter(l => l);
  const data = rows.map(r => { const m = r.match(/^(.+?)\s*:\s*([\d.]+)/); return m ? [m[1].trim(), m[2]] : null; }).filter(Boolean);
  fillDemoPctTable(data);
}

function fillDemoPctTable(data) {
  const tbody = document.getElementById('demo-pct-table');
  while (tbody.rows.length > 1) tbody.deleteRow(1);
  if (!data || data.length === 0) { addDemoPctRow(); updateDemoPctTotalDisplay(); return; }
  data.forEach(([label, pct]) => {
    const row = tbody.insertRow(-1);
    row.innerHTML = `<td style="padding:.15rem"><input type="text" value="${label.replace(/"/g,'&quot;')}" style="width:100%;font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--gray-200);border-radius:4px"></td>
      <td style="padding:.15rem;text-align:center"><input type="number" value="${pct}" min="0" max="100" step="0.1" style="width:60px;font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--gray-200);border-radius:4px;text-align:center"></td>
      <td style="padding:.15rem;text-align:center"><button class="btn btn-danger btn-sm" onclick="removeDemoPctRow(this)" style="font-size:.6rem;padding:.05rem .3rem">✕</button></td>`;
  });
  updateDemoPctTotalDisplay();
}

function removeDemoPctRow(btn) {
  btn.closest('tr').remove();
  updateDemoPctTotalDisplay();
}

function addDemoPctRow() {
  const tbody = document.getElementById('demo-pct-table');
  const row = tbody.insertRow(-1);
  row.innerHTML = `<td style="padding:.15rem"><input type="text" placeholder="Nhóm" style="width:100%;font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--gray-200);border-radius:4px"></td>
    <td style="padding:.15rem;text-align:center"><input type="number" value="" min="0" max="100" step="0.1" placeholder="%" style="width:60px;font-size:.8rem;padding:.25rem .4rem;border:1px solid var(--gray-200);border-radius:4px;text-align:center"></td>
    <td style="padding:.15rem;text-align:center"><button class="btn btn-danger btn-sm" onclick="removeDemoPctRow(this)" style="font-size:.6rem;padding:.05rem .3rem">✕</button></td>`;
  let total = 0, emptyCount = 0, lastPctInput = null;
  for (let i = 1; i < tbody.rows.length; i++) {
    const inputs = tbody.rows[i].querySelectorAll('input');
    if (inputs.length < 2) continue;
    const pctInput = inputs[1];
    const val = parseFloat(pctInput.value);
    if (!isNaN(val) && val > 0) { total += val; } else { emptyCount++; lastPctInput = pctInput; }
  }
  if (emptyCount === 1 && lastPctInput) { lastPctInput.value = Math.max(0, 100 - total).toFixed(1); }
  updateDemoPctTotalDisplay();
}

function readDemoPctTable() {
  const tbody = document.getElementById('demo-pct-table');
  const values = [], weights = [];
  for (let i = 1; i < tbody.rows.length; i++) {
    const inputs = tbody.rows[i].querySelectorAll('input');
    if (inputs.length < 2) continue;
    const label = inputs[0].value.trim();
    const pct = parseFloat(inputs[1].value);
    if (label) { values.push(label); weights.push(isNaN(pct) ? 1 : pct); }
  }
  return { values, weights };
}

function addDemographicVar() {
  const name = document.getElementById('demo-name').value.trim();
  const label = document.getElementById('demo-label').value.trim();
  const { values, weights } = readDemoPctTable();
  if (!name) { showToast('Vui lòng nhập tên biến', 'error'); return; }
  if (variables.some(v => v.name === name)) { showToast(`Biến "${name}" đã tồn tại`, 'error'); return; }
  if (values.length === 0) { showToast('Vui lòng nhập ít nhất 1 nhóm với tỷ lệ', 'error'); return; }
  const totalPct = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(totalPct - 100) > 0.01) { showToast(`Tổng tỷ lệ phải bằng 100% (hiện tại: ${totalPct.toFixed(1)}%)`, 'error'); return; }
  variables.push({ name, label: label || name, type: 'demographic', customValues: values, weights });
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderDemoList();
  document.getElementById('demo-name').value = '';
  document.getElementById('demo-label').value = '';
  const tbody = document.getElementById('demo-pct-table');
  while (tbody.rows.length > 1) tbody.deleteRow(1);
  addDemoPctRow();
  showToast(`Đã thêm biến nhân khẩu "${name}"`, 'success');
}

function removeDemographicVar(idx) {
  const demoVars = variables.filter(v => v.type === 'demographic' && !v.construct);
  const target = demoVars[idx];
  if (!target) return;
  if (!confirm(`Xóa biến nhân khẩu "${target.name}"?`)) return;
  variables = variables.filter(v => !(v.name === target.name && v.type === 'demographic' && !v.construct));
  generatedData = null; _regressionResults = null; updateDownloadButtons(); updatePreview(null);
  renderDemoList();
}

function renderDemoList() {
  const el = document.getElementById('demo-list');
  const demoVars = variables.filter(v => v.type === 'demographic' && !v.construct);
  if (demoVars.length === 0) { el.innerHTML = '<span style="color:var(--gray-400);font-size:.8rem">Chưa có biến nhân khẩu học nào</span>'; return; }
  let h = '';
  demoVars.forEach((v, i) => {
    h += `<div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .5rem;background:var(--gray-50);border-radius:var(--radius);margin-bottom:.25rem">
      <span><strong>${v.name}</strong> — ${v.label} (${v.customValues?.length||0} nhóm, mã: ${v.customValues?.map((l,i)=>`${i+1}=${l}`).join(', ') || ''})</span>
      <button class="btn btn-danger btn-sm" onclick="removeDemographicVar(${i})" style="font-size:.65rem;padding:.1rem .4rem">✕</button>
    </div>`;
  });
  el.innerHTML = h;
}

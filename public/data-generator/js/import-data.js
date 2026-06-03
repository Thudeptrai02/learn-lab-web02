// ====== IMPORT DATA (Excel/CSV) ======
let _importedVars = [];
let _importConstructs = {};
let _importedRawData = null;
let _importFileInfo = '';

function toggleImportSection() {
  const body = document.getElementById('import-section-body');
  const arrow = document.getElementById('import-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▶' : '▼';
}

function importFileDialog(type) {
  const input = document.getElementById('import-file-input');
  input.accept = type === 'xlsx' ? '.xlsx' : '.csv';
  input.value = '';
  input.click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  _importConstructs = {};
  _importedVars = [];
  _importedRawData = null;
  document.getElementById('import-construct-badges').innerHTML = '';
  document.getElementById('btn-finish-import').style.display = 'none';

  const reader = new FileReader();
  const isExcel = file.name.endsWith('.xlsx');

  reader.onload = function(e) {
    try {
      let parsed;
      if (isExcel) {
        if (typeof XLSX === 'undefined') { showToast('❌ Thư viện SheetJS chưa tải', 'error'); return; }
        const wb = XLSX.read(e.target.result, { type: 'array' });
        parsed = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      } else {
        const text = e.target.result;
        parsed = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim()).map(l => {
          const cols = []; let cur = '', inQ = false;
          for (const ch of l) {
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
            cur += ch;
          }
          cols.push(cur.trim());
          return cols;
        });
      }
      if (!parsed || parsed.length < 2) { showToast('❌ File không đủ dữ liệu', 'error'); return; }

      let headers = parsed[0].map((h, ci) => String(h || '').trim() || 'V' + (ci + 1));
      if (headers.length === 0) { showToast('❌ Không tìm thấy tên biến', 'error'); return; }
      const hdrCount = {};
      headers = headers.map(h => { hdrCount[h] = (hdrCount[h] || 0) + 1; return hdrCount[h] > 1 ? h + '_' + hdrCount[h] : h; });

      const rawFirst = parsed[0].map(h => String(h).trim()).filter(h => h);
      const allNumeric = rawFirst.length > 0 && rawFirst.every(h => !isNaN(parseFloat(h)) && isFinite(h));
      if (allNumeric) {
        headers = parsed[0].map((_, ci) => 'V' + (ci + 1));
      }

      const rawRows = [];
      const startRow = allNumeric ? 0 : 1;
      for (let r = startRow; r < parsed.length; r++) {
        const row = parsed[r];
        if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;
        const obj = {}; let hasData = false;
        headers.forEach((h, ci) => {
          let val = row[ci];
          if (val === undefined || val === null || val === '') { obj[h] = null; return; }
          const s = String(val).replace(/"/g, '').trim();
          const num = parseFloat(s.replace(/,/g, ''));
          if (!isNaN(num) && isFinite(num) && s !== '') { obj[h] = num; }
          else { obj[h] = s; }
          if (obj[h] !== null) hasData = true;
        });
        if (hasData) rawRows.push(obj);
      }

      if (rawRows.length < 5) { showToast(`❌ Chỉ có ${rawRows.length} dòng`, 'error'); return; }

      _importedVars = headers;
      _importedRawData = rawRows;
      _importFileInfo = `${file.name} — ${rawRows.length} dòng, ${headers.length} biến`;

      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('import-summary').textContent = `📋 ${_importFileInfo}. Chọn nhân tố cho từng biến (cột "Nhân tố"):`;
      renderImportTable();
      showToast(`✅ Import: ${_importFileInfo}`, 'success');

      autoCreateConstructPatterns();
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
      console.error(err);
    }
  };

  if (isExcel) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

function autoCreateConstructPatterns() {
  const prefixes = {};
  _importedVars.forEach(v => {
    const m = v.match(/^([A-Z]+)(\d+)$/i);
    if (m) {
      const p = m[1].toUpperCase();
      if (!prefixes[p]) prefixes[p] = [];
      prefixes[p].push(v);
    }
  });
  Object.keys(prefixes).forEach(p => {
    if (prefixes[p].length >= 2 && !_importConstructs[p]) {
      _importConstructs[p] = { role: 'independent', items: [...prefixes[p]] };
    }
  });
  renderImportBadges();
  renderImportTable();
}

function renderImportBadges() {
  const cont = document.getElementById('import-construct-badges');
  const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };
  const roleColors = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };
  const keys = Object.keys(_importConstructs);
  const btn = document.getElementById('btn-finish-import');
  if (keys.length === 0) {
    cont.innerHTML = '<span style="font-size:.8rem;color:var(--gray-400)">Tạo nhân tố để gán biến</span>';
    if (btn) btn.style.display = 'none';
    renderImportTable();
    return;
  }
  cont.innerHTML = keys.map(k => {
    const c = _importConstructs[k]; const rc = roleColors[c.role];
    return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .5rem;background:${rc}15;border:1px solid ${rc};border-radius:999px;font-size:.75rem">
      <strong>${k}</strong>
      <span style="color:${rc};font-size:.65rem">${roleLabels[c.role]}</span>
      <span style="color:var(--gray-400);font-size:.65rem">${c.items.length}bv</span>
      <button onclick="editImportConstructRole('${k}')" style="background:none;border:none;cursor:pointer;font-size:.65rem;color:${rc};padding:0">🔄</button>
      <button onclick="removeImportConstruct('${k}')" style="background:none;border:none;cursor:pointer;font-size:.65rem;color:#ef4444;padding:0">✕</button>
    </span>`;
  }).join('');
  if (btn) btn.style.display = 'inline-block';
  renderImportTable();
}

function renderImportTable() {
  const tbody = document.getElementById('import-var-tbody');
  const constructNames = Object.keys(_importConstructs);
  let html = '';
  _importedVars.forEach((v, i) => {
    let assignedTo = '';
    for (const k of constructNames) {
      if (_importConstructs[k].items.includes(v)) { assignedTo = k; break; }
    }
    const sample = _importedRawData.find(r => r[v] !== null && r[v] !== undefined)?.[v];
    const isNumeric = typeof sample === 'number' || _importedRawData.every(r => r[v] === null || typeof r[v] === 'number');
    const typeIcon = isNumeric ? '🔢' : '🔤';
    const opts = constructNames.map(k =>
      `<option value="${k}" ${assignedTo === k ? 'selected' : ''}>${k}</option>`
    ).join('');
    const bg = i % 2 === 0 ? '' : ' style="background:var(--gray-50)"';
    html += `<tr${bg}>
      <td style="padding:.3rem .5rem;text-align:center;color:var(--gray-400);font-size:.7rem">${i+1}</td>
      <td style="padding:.3rem .5rem;font-weight:600">${v}</td>
      <td style="padding:.3rem .5rem;text-align:center;font-size:.75rem" title="${isNumeric ? 'Số' : 'Chữ'}">${typeIcon}</td>
      <td style="padding:.3rem .5rem">
        <select data-var="${v.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" onchange="assignImportVar(this.getAttribute('data-var'), this.value)" style="width:100%;padding:.25rem .35rem;border:1px solid var(--gray-300);border-radius:4px;font-size:.8rem;background:${assignedTo ? '#eef2ff' : '#fff'}">
          <option value="">— Không gán —</option>
          ${opts}
          <option value="__new__" style="color:var(--primary);font-weight:600">➕ Tạo nhân tố mới...</option>
        </select>
      </td>
      <td style="padding:.3rem .1rem;text-align:center;width:30px">
        <button onclick="removeImportVar(${i})" title="Xoá biến này" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:1rem;padding:2px 4px">✕</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function removeImportVar(idx) {
  if (idx < 0 || idx >= _importedVars.length) return;
  const v = _importedVars[idx];
  if (!confirm(`Xoá biến "${v}" khỏi danh sách import?`)) return;
  for (const k of Object.keys(_importConstructs)) {
    const pos = _importConstructs[k].items.indexOf(v);
    if (pos !== -1) _importConstructs[k].items.splice(pos, 1);
  }
  _importedVars.splice(idx, 1);
  renderImportTable();
  renderImportBadges();
  _importFileInfo = `${document.getElementById('import-summary').textContent.match(/^[^—]+/)?.[0] || ''} — ${_importedRawData.length} dòng, ${_importedVars.length} biến`;
  document.getElementById('import-summary').textContent = `📋 ${_importFileInfo}. Chọn nhân tố cho từng biến (cột "Nhân tố"):`;
}

function assignImportVar(varName, value) {
  if (!value) {
    for (const k of Object.keys(_importConstructs)) {
      const idx = _importConstructs[k].items.indexOf(varName);
      if (idx !== -1) _importConstructs[k].items.splice(idx, 1);
    }
  } else if (value === '__new__') {
    const name = prompt('Nhập tên nhân tố mới (VD: CL):', '');
    if (!name) { renderImportTable(); return; }
    const upper = name.toUpperCase();
    if (_importConstructs[upper]) { showToast(`"${upper}" đã tồn tại`, 'error'); renderImportTable(); return; }
    _importConstructs[upper] = { role: 'independent', items: [varName] };
    renderImportBadges();
  } else {
    for (const k of Object.keys(_importConstructs)) {
      const idx = _importConstructs[k].items.indexOf(varName);
      if (idx !== -1) _importConstructs[k].items.splice(idx, 1);
    }
    _importConstructs[value].items.push(varName);
  }
  renderImportBadges();
}

function autoDetectConstructs() {
  _importConstructs = {};
  autoCreateConstructPatterns();
  const assigned = new Set();
  Object.values(_importConstructs).forEach(c => c.items.forEach(v => assigned.add(v)));
  _importedVars.forEach(v => {
    if (!assigned.has(v)) {
      const m = v.match(/^([A-Z]+)/i);
      if (m) {
        const p = m[1].toUpperCase();
        if (!_importConstructs[p]) _importConstructs[p] = { role: 'independent', items: [] };
        if (!_importConstructs[p].items.includes(v)) _importConstructs[p].items.push(v);
      }
    }
  });
  renderImportBadges();
}

function createConstructFromImport() {
  const name = document.getElementById('import-construct-name').value.trim().toUpperCase();
  const role = document.getElementById('import-construct-role').value;
  if (!name) { showToast('Vui lòng nhập tên nhân tố', 'error'); return; }
  if (_importConstructs[name]) { showToast(`"${name}" đã tồn tại`, 'error'); return; }
  _importConstructs[name] = { role, items: [] };
  document.getElementById('import-construct-name').value = '';
  renderImportBadges();
}

function editImportConstructRole(key) {
  const roles = ['independent', 'dependent', 'mediating', 'moderating'];
  const c = _importConstructs[key];
  c.role = roles[(roles.indexOf(c.role) + 1) % roles.length];
  renderImportBadges();
}

function removeImportConstruct(key) {
  if (!confirm(`Xóa nhân tố "${key}"?`)) return;
  delete _importConstructs[key];
  renderImportBadges();
}

function cancelImport() {
  _importedVars = []; _importedRawData = null; _importConstructs = {};
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-construct-badges').innerHTML = '';
  document.getElementById('btn-finish-import').style.display = 'none';
  document.getElementById('import-summary').textContent = '';
  showToast('Đã hủy import', 'info');
}

function finishImport() {
  try {
    if (!_importedRawData) { showToast('Chưa có dữ liệu', 'error'); return; }
    const assignedVars = new Set();
    Object.values(_importConstructs).forEach(c => c.items.forEach(v => assignedVars.add(v)));

    variables = [];
    _importedVars.forEach(v => {
      let construct = '', role = '';
      for (const k of Object.keys(_importConstructs)) {
        if (_importConstructs[k].items.includes(v)) { construct = k; role = _importConstructs[k].role; break; }
      }
      const sample = _importedRawData.find(r => r[v] !== null && r[v] !== undefined)?.[v];
      const isNumeric = typeof sample === 'number' || _importedRawData.every(r => r[v] === null || typeof r[v] === 'number');
      variables.push({
        name: v, label: v,
        type: isNumeric ? 'imported_numeric' : 'imported_text',
        construct: construct || '', constructLabel: construct || '', role: role || ''
      });
    });

    const colNames = _importedVars;
    generatedData = { rawRows: _importedRawData, labelRows: _importedRawData, colNames, colLabels: colNames, n: _importedRawData.length };
    _regressionResults = null;

    updatePreview(_importedRawData, colNames);
    updateDownloadButtons();
    renderModelStructure();

    const previewDiv = document.getElementById('import-preview');
    if (previewDiv) {
      const allR = _importedRawData.length;
      const allC = colNames.length;
      let h = '<div style="margin-top:.5rem;max-height:450px;overflow:auto;border:1px solid var(--gray-200);border-radius:var(--radius)">';
      h += '<table style="border-collapse:collapse;font-size:.72rem"><thead><tr style="background:#eef2ff;position:sticky;top:0;z-index:2">';
      for (let ci = 0; ci < allC; ci++) h += '<th style="padding:3px 6px;border:1px solid #d1d5db;white-space:nowrap;font-weight:600">' + colNames[ci] + '</th>';
      h += '</tr></thead><tbody>';
      for (let ri = 0; ri < allR; ri++) {
        h += '<tr' + (ri % 2 === 0 ? '' : ' style="background:#f9fafb"') + '>';
        for (let ci = 0; ci < allC; ci++) {
          const val = _importedRawData[ri][colNames[ci]];
          h += '<td style="padding:2px 6px;border:1px solid #e5e7eb;text-align:center;white-space:nowrap">' + (val === null || val === undefined ? '' : val) + '</td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      h += '<div style="margin-top:6px;font-size:.8rem;color:var(--gray-500)">Tổng: ' + allR + ' dòng × ' + allC + ' cột</div>';
      previewDiv.innerHTML = h;
    }
    showImportData();
    document.getElementById('gen-status').textContent = '✅ Import: ' + _importFileInfo;

    const _rawData = _importedRawData;
    const _cons = {};
    variables.forEach(v => { if (v.construct) { if (!_cons[v.construct]) _cons[v.construct] = []; _cons[v.construct].push(v); } });
    const _qc = document.getElementById('quality-card');
    const _qct = document.getElementById('quality-content');
    if (_qc) _qc.style.display = 'block';
    if (_qct && Object.keys(_cons).length > 0) {
      const cKeys = Object.keys(_cons);
      const roleColor = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };
      const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };
      const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
      const sd = a => { const m=mean(a); return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };
      const corr = (a,b) => { const ma=mean(a),mb=mean(b),sa=sd(a),sb=sd(b); if(sa===0||sb===0)return 0; return a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0)/(a.length*sa*sb); };
      const reg = (xv,yv) => {
        const vv=[]; for(let i=0;i<xv.length;i++) if(xv[i]!==null&&yv[i]!==null) vv.push(i);
        if(vv.length<5) return null;
        const xs=vv.map(i=>xv[i]),ys=vv.map(i=>yv[i]);
        const mx=mean(xs),my=mean(ys),sx2=xs.reduce((s,v)=>s+(v-mx)**2,0),sxy=xs.reduce((s,v,i)=>s+(v-mx)*(ys[i]-my),0);
        const b=sx2>0?sxy/sx2:0,yhat=xs.map(x=>b*(x-mx)+my);
        const ssr=ys.reduce((s,y,i)=>s+(y-yhat[i])**2,0),seB=Math.sqrt(ssr/(vv.length-2))/Math.sqrt(sx2)||1;
        const t=seB>0?b/seB:0,p=2*(1-0.5*(1+erf(Math.abs(t)/Math.SQRT2)));
        const r=sx2>0?corr(xs,ys):0;
        return {b,seB,stdBeta:r,t,p,R2:r*r,n:vv.length};
      };
      const compScores = {};
      cKeys.forEach(k => {
        const items = _cons[k].map(v => v.name);
        compScores[k] = _rawData.map(r => {
          let s=0,c=0; items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
          return c>=2?s/c:null;
        });
      });
      let h = '<div class="variables-list" style="gap:.5rem">';
      h += '<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc"><div style="font-size:.85rem;font-weight:600;margin-bottom:.35rem">📊 Thống kê mô tả</div>';
      h += '<div style="overflow-x:auto;font-size:.75rem"><table style="width:100%;border-collapse:collapse"><tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td><td style="padding:.3rem .5rem">Vai trò</td><td style="padding:.3rem .5rem;text-align:center">Số biến</td><td style="padding:.3rem .5rem;text-align:center">N</td><td style="padding:.3rem .5rem;text-align:center">Mean</td><td style="padding:.3rem .5rem;text-align:center">SD</td></tr>';
      cKeys.forEach((k,i) => {
        const role = _cons[k][0]?.role||'';
        const label = _cons[k][0]?.constructLabel||k;
        const vals = compScores[k].filter(v=>v!==null);
        h += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
          <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
          <td style="padding:.2rem .5rem;color:${roleColor[role]||'#666'}">${roleLabels[role]||''}</td>
          <td style="padding:.2rem .5rem;text-align:center">${_cons[k].length}</td>
          <td style="padding:.2rem .5rem;text-align:center">${vals.length}</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:600">${vals.length>0?mean(vals).toFixed(2):'—'}</td>
          <td style="padding:.2rem .5rem;text-align:center">${vals.length>1?sd(vals).toFixed(3):'—'}</td></tr>`;
      });
      h += '</table></div></div>';
      h += '<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc"><div style="font-size:.85rem;font-weight:600;margin-bottom:.35rem">🧪 Cronbach\'s Alpha</div>';
      h += '<div style="overflow-x:auto;font-size:.75rem"><table style="width:100%;border-collapse:collapse"><tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td><td style="padding:.3rem .5rem;text-align:center">Số items</td><td style="padding:.3rem .5rem;text-align:center">α</td><td style="padding:.3rem .5rem;text-align:center">Đánh giá</td></tr>';
      cKeys.forEach((k,i) => {
        const label = _cons[k][0]?.constructLabel||k;
        const items = _cons[k].map(v=>v.name);
        const data = _rawData.map(r => items.map(n=>{const v=r[n];return typeof v==='number'&&!isNaN(v)?v:null;}));
        const valid = []; for(let ri=0;ri<_rawData.length;ri++) if(data[ri].every(v=>v!==null)) valid.push(ri);
        const m = valid.length;
        let alpha=0;
        if(m>=3 && items.length>=2) {
          const kItems=items.length;
          const itemMeans = items.map((_,idx)=>mean(valid.map(ri=>data[ri][idx])));
          const covM = items.map((_,i)=>items.map((_,j)=>{
            let cov=0; valid.forEach(ri=>cov+=(data[ri][i]-itemMeans[i])*(data[ri][j]-itemMeans[j])); cov/=m;
            return cov;
          }));
          let sumVar=0,totalVar=0;
          for(let i=0;i<kItems;i++) sumVar+=covM[i][i];
          for(let i=0;i<kItems;i++) for(let j=0;j<kItems;j++) totalVar+=covM[i][j];
          alpha=totalVar>0?(kItems/(kItems-1))*(1-sumVar/totalVar):0;
        }
        const ok=alpha>=0.6;
        h += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
          <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
          <td style="padding:.2rem .5rem;text-align:center">${items.length} (n=${m})</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:700;color:${ok?'#059669':'#dc2626'}">${alpha.toFixed(3)}</td>
          <td style="padding:.2rem .5rem;text-align:center">${ok?'✅ Đạt':'⚠️ <0.6'}</td></tr>`;
      });
      h += '</table></div></div>';
      const ivs = cKeys.filter(k => _cons[k][0]?.role==='independent');
      const dvs = cKeys.filter(k => _cons[k][0]?.role==='dependent');
      const meds = cKeys.filter(k => _cons[k][0]?.role==='mediating');
      const mods = cKeys.filter(k => _cons[k][0]?.role==='moderating');
      if (dvs.length > 0 && (ivs.length>0||meds.length>0||mods.length>0)) {
        dvs.forEach(dvKey => {
          const predictors = [...ivs, ...meds, ...mods];
          const dv = compScores[dvKey];
          const valid = []; for(let i=0;i<_rawData.length;i++) if(dv[i]!==null&&predictors.every(p=>compScores[p][i]!==null)) valid.push(i);
          const m2 = valid.length;
          if (m2 > predictors.length+5) {
            const y=valid.map(i=>dv[i]),yMean=mean(y),ySd=sd(y);
            const xMean=predictors.map(p=>mean(valid.map(i=>compScores[p][i])));
            const xSd=predictors.map(p=>sd(valid.map(i=>compScores[p][i])));
            const R=corrMatrixFromData(valid.map(i=>{const o={__dv__:dv[i]};predictors.forEach(p=>{o[p]=compScores[p][i];});return o;}),['__dv__',...predictors]);
            const rY=predictors.map((_,j)=>R[0][j+1]),Rxx=predictors.map((_,i)=>predictors.map((_,j)=>R[i+1][j+1]));
            let RxxInv=matInverse(Rxx); if(!RxxInv){const lam=1e-8*predictors.length;RxxInv=matInverse(Rxx.map((r,i)=>r.map((v,j)=>i===j?v+lam:v)));}
            let stdBeta=[],rSquared=0; if(RxxInv){stdBeta=RxxInv.map(r=>r.reduce((a,v,j)=>a+v*rY[j],0));rSquared=stdBeta.reduce((a,b,j)=>a+b*rY[j],0);}
            if(rSquared<0)rSquared=0;if(rSquared>1)rSquared=1;
            const rawBeta=[yMean-stdBeta.reduce((a,b,j)=>a+b*ySd*xMean[j]/(xSd[j]||1),0)];
            predictors.forEach((_,j)=>rawBeta.push(xSd[j]>0?stdBeta[j]*ySd/xSd[j]:0));
            const yHat=valid.map(i=>rawBeta[0]+predictors.reduce((a,p,j)=>a+rawBeta[j+1]*compScores[p][i],0));
            const residuals=valid.map((i,ri)=>dv[i]-yHat[ri]),ssRes=residuals.reduce((a,r)=>a+r*r,0);
            const ssTot=y.reduce((a,yi)=>a+(yi-yMean)**2,0);
            if(rSquared<=0&&ssTot>0)rSquared=Math.max(0,1-ssRes/ssTot);
            const adjRSq=1-(1-rSquared)*(m2-1)/(m2-predictors.length-1);
            const mse=Math.max(ssRes/(m2-predictors.length-1),1e-10);
            const se=predictors.map((_,j)=>RxxInv?Math.sqrt(mse*RxxInv[j][j]/(m2-1)*ySd*ySd/(xSd[j]*xSd[j]||1)):1);
            const tStat=predictors.map((_,j)=>se[j]>0?rawBeta[j+1]/se[j]:0);
            const pValue=tStat.map(t=>{const z=Math.abs(t);return 2*(1-0.5*(1+erf(z/Math.SQRT2)));});
            const vif=predictors.map((_,j)=>RxxInv?RxxInv[j][j]:10);
            h += `<div class="var-item" style="margin-bottom:.5rem;background:#f0fdf4;border-color:#86efac">`;
            const dvName = _cons[dvKey][0]?.constructLabel||dvKey;
            h += `<div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">📈 Hồi quy — ${dvName} (R²=${rSquared.toFixed(3)}, R²ₐdj=${adjRSq.toFixed(3)})</div>`;
            h += `<div style="overflow-x:auto;font-size:.75rem"><table style="width:100%;border-collapse:collapse">
              <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Predictor</td><td style="padding:.25rem .5rem">β</td><td style="padding:.25rem .5rem">t</td><td style="padding:.25rem .5rem">Sig.</td><td style="padding:.25rem .5rem">VIF</td></tr>`;
            predictors.forEach((p,idx) => {
              const sig=pValue[idx]<0.05;
              h += `<tr${idx%2===1?' style="background:var(--gray-50)"':''}>
                <td style="padding:.25rem .5rem;font-weight:600">${_cons[p][0]?.constructLabel||p}</td>
                <td style="padding:.25rem .5rem;color:${clr(Math.abs(stdBeta[idx]),0.1,0.65,0.05,0.75)}">${stdBeta[idx].toFixed(3)}</td>
                <td style="padding:.25rem .5rem">${tStat[idx].toFixed(3)}</td>
                <td style="padding:.25rem .5rem;color:${sig?'#059669':'#dc2626'}">${pValue[idx].toFixed(4)}${sig?'✅':'⚠️'}</td>
                <td style="padding:.25rem .5rem">${vif[idx].toFixed(2)}</td></tr>`;
            });
            h += `</table></div>`;
            if (meds.length > 0) {
              h += `<div style="margin-top:.4rem;font-size:.75rem"><strong>🔗 Phân tích trung gian</strong></div>`;
              h += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.72rem">
                <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Đường dẫn</td>
                <td style="padding:.25rem .5rem;text-align:center">a (IV→Med)</td><td style="padding:.25rem .5rem;text-align:center">p(a)</td>
                <td style="padding:.25rem .5rem;text-align:center">b (Med→DV)</td><td style="padding:.25rem .5rem;text-align:center">p(b)</td>
                <td style="padding:.25rem .5rem;text-align:center">a×b</td><td style="padding:.25rem .5rem;text-align:center">Sobel Z</td>
                <td style="padding:.25rem .5rem;text-align:center">Sobel p</td><td style="padding:.25rem .5rem;text-align:center">VAF</td></tr>`;
              meds.forEach(mk => {
                const mLbl = _cons[mk][0]?.constructLabel||mk;
                ivs.forEach(ivk => {
                  const ivLbl = _cons[ivk][0]?.constructLabel||ivk;
                  const aRes = reg(compScores[ivk], compScores[mk]);
                  if (!aRes) return;
                  const bIdx = predictors.indexOf(mk);
                  const bRes = bIdx>=0?{b:rawBeta[bIdx+1],seB:se[bIdx],stdBeta:stdBeta[bIdx],t:tStat[bIdx],p:pValue[bIdx]}:null;
                  if (!bRes) return;
                  const cPrm = predictors.indexOf(ivk)>=0?{b:rawBeta[predictors.indexOf(ivk)+1],stdBeta:stdBeta[predictors.indexOf(ivk)],p:pValue[predictors.indexOf(ivk)]}:null;
                  const cRes = reg(compScores[ivk], compScores[dvKey]);
                  if (!cRes) return;
                  const indirect = aRes.b*bRes.b;
                  const seAB = Math.sqrt(bRes.b*bRes.b*aRes.seB*aRes.seB + aRes.b*aRes.b*bRes.seB*bRes.seB)||1;
                  const sobelZ = indirect/seAB;
                  const sobelP = 2*(1-0.5*(1+erf(Math.abs(sobelZ)/Math.SQRT2)));
                  const VAF = (cPrm?cPrm.b:0)+indirect!==0?Math.abs(indirect/((cPrm?cPrm.b:0)+indirect)):0;
                  const sigS = sobelP<0.05;
                  h += `<tr><td style="padding:.25rem .5rem;font-weight:600;white-space:nowrap">${ivLbl}→${mLbl}→${dvName}</td>
                    <td style="padding:.25rem .5rem;text-align:center;color:${aRes.p<0.05?'#059669':'#dc2626'}">${aRes.b.toFixed(3)}</td>
                    <td style="padding:.25rem .5rem;text-align:center">${aRes.p.toFixed(4)}</td>
                    <td style="padding:.25rem .5rem;text-align:center;color:${bRes.p<0.05?'#059669':'#dc2626'}">${bRes.b.toFixed(3)}</td>
                    <td style="padding:.25rem .5rem;text-align:center">${bRes.p.toFixed(4)}</td>
                    <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:#7c3aed">${indirect.toFixed(4)}</td>
                    <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:${sigS?'#059669':'#dc2626'}">${sobelZ.toFixed(3)}${sigS?'✅':'⚠️'}</td>
                    <td style="padding:.25rem .5rem;text-align:center">${sobelP.toFixed(4)}</td>
                    <td style="padding:.25rem .5rem;text-align:center;font-weight:700">${(VAF*100).toFixed(1)}%</td></tr>`;
                });
              });
              h += `</table></div>`;
              h += `<div style="margin-top:.3rem;font-size:.65rem;color:var(--gray-500)">Hướng dẫn: a×b=hiệu ứng gián tiếp. Sobel Z test xem trung gian có ý nghĩa không (p<0.05). VAF≥80%: trung gian hoàn toàn; 20-80%: một phần; <20%: không.</div>`;
            }
            h += `</div>`;
          }
        });
      }
      h += '</div>';
      _qct.innerHTML = h;
      document.getElementById('quality-badge').textContent = `${cKeys.length} nhân tố · ✅ Phân tích xong`;
      setTimeout(() => { if (_qc) _qc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
    } else if (_qct) {
      _qct.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-500)">Chưa có nhân tố. Hãy gán biến vào nhân tố trước khi xem báo cáo.</div>';
    }

    showToast('✅ Import thành công!', 'success');
    _importedVars = []; _importedRawData = null; _importConstructs = {};
  } catch (err) {
    showToast('❌ Lỗi: ' + err.message, 'error');
    console.error(err);
  }
}

function showImportData() {
  const content = document.getElementById('data-viewer-content');
  const info = document.getElementById('data-viewer-info');
  if (!_importedRawData || !_importedVars || _importedRawData.length === 0) {
    if (generatedData && generatedData.rawRows && generatedData.rawRows.length > 0) {
      renderDataTable(generatedData.rawRows, generatedData.colNames, content, info);
      return;
    }
    content.innerHTML = '<div class="empty-state"><p>Chưa có dữ liệu. Hãy import file Excel/CSV hoặc tạo dữ liệu mới.</p></div>';
    if (info) info.textContent = '0 dòng';
    return;
  }
  renderDataTable(_importedRawData, _importedVars, content, info);
  document.getElementById('data-viewer-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDataTable(rows, colNames, container, infoEl) {
  if (!container) return;
  const allR = rows.length;
  const allC = colNames.length;
  let h = '<div style="max-height:520px;overflow:auto;border:1px solid var(--gray-200);border-radius:var(--radius)">';
  h += '<table id="dataViewerTable" style="border-collapse:collapse;font-size:.72rem"><thead><tr style="background:#eef2ff;position:sticky;top:0;z-index:2">';
  for (let ci = 0; ci < allC; ci++) {
    h += '<th style="padding:3px 6px;border:1px solid #d1d5db;white-space:nowrap;font-weight:600">' + colNames[ci] + '</th>';
  }
  h += '</tr></thead><tbody>';
  for (let ri = 0; ri < allR; ri++) {
    h += '<tr' + (ri % 2 === 0 ? '' : ' style="background:#f9fafb"') + '>';
    for (let ci = 0; ci < allC; ci++) {
      const val = rows[ri][colNames[ci]];
      const colName = colNames[ci];
      const edited = window._changedCells && window._changedCells[ri] && window._changedCells[ri][colName];
      const num = Number(val);
      const isLikert = !isNaN(num) && num >= 1 && num <= 7 && val !== '';
      let cls = '';
      let extra = '';
      if (edited) { cls = ' cell-edited'; }
      if (isLikert) { cls += ' cell-editing'; extra = ' data-row="' + ri + '" data-col="' + ci + '"'; }
      h += '<td class="' + cls.trim() + '" style="padding:2px 6px;border:1px solid #e5e7eb;text-align:center;white-space:nowrap"' + extra + '>' + (val === null || val === undefined ? '' : val) + '</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  h += '<div style="margin-top:6px;font-size:.8rem;color:var(--gray-500)">Tổng: ' + allR + ' dòng × ' + allC + ' cột. Click ô Likert (1-7) để sửa trực tiếp.</div>';
  container.innerHTML = h;
  if (infoEl) infoEl.textContent = allR + ' dòng × ' + allC + ' cột';
  // Bind click-to-edit on Likert cells
  container.querySelectorAll('td.cell-editing').forEach(td => {
    td.addEventListener('click', function(e) {
      e.stopPropagation();
      // If already editing, skip
      if (this.querySelector('select')) return;
      const rowIdx = parseInt(this.dataset.row);
      const colIdx = parseInt(this.dataset.col);
      const colName = colNames[colIdx];
      const currentVal = parseInt(this.textContent.trim());
      if (isNaN(currentVal)) return;
      const sel = document.createElement('select');
      sel.style.width = '48px';
      sel.style.fontSize = '.72rem';
      for (let v = 1; v <= 7; v++) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === currentVal) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', function() {
        const newVal = parseInt(this.value);
        if (newVal !== currentVal) {
          const rowObj = generatedData.rawRows || rows;
          if (Array.isArray(rowObj) && rowObj[rowIdx]) {
            rowObj[rowIdx][colName] = newVal;
            if (!window._changedCells) window._changedCells = {};
            if (!window._changedCells[rowIdx]) window._changedCells[rowIdx] = {};
            window._changedCells[rowIdx][colName] = { oldVal: currentVal, newVal: newVal };
            if (generatedData) {
              if (generatedData.constructQualities) delete generatedData.constructQualities;
              if (generatedData.regressionCache) delete generatedData.regressionCache;
            }
            if (typeof renderDataTable === 'function') renderDataTable(rows, colNames, container, infoEl);
            const qc = document.getElementById('qualityContent');
            if (qc && typeof showQualityReport === 'function') {
              const c = generatedData?.constructs || {};
              showQualityReport(generatedData.rawRows || [], c, (generatedData.rawRows || []).length);
            }
          }
        } else {
          this.parentElement.textContent = currentVal;
        }
      });
      this.textContent = '';
      this.appendChild(sel);
      sel.focus();
    });
  });
}

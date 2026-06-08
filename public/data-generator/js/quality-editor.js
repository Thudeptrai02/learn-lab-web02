// ====== QUALITY EDITOR — fix ALL metrics by modifying raw data ======

let _qualityUndoData = null;

function _qualitySnapshot() {
  if (!generatedData) return;
  _qualityUndoData = generatedData.rawRows.map(row => ({ ...row }));
}

function _qualityRestore() {
  if (!_qualityUndoData || !generatedData) return;
  generatedData.rawRows.forEach((row, ri) => {
    if (_qualityUndoData[ri]) Object.assign(row, _qualityUndoData[ri]);
  });
  _qualityUndoData = null;
  _refreshQEditor();
}

// ====== COMPUTE METRICS FROM RAW DATA (no DOM dependency) ======

function _computeConstructMetrics(constructKey) {
  const items = variables.filter(v => v.construct === constructKey);
  const itemNames = items.map(v => v.name);
  const rows = generatedData.rawRows;
  const n = rows.length;
  if (itemNames.length < 2 || n < 3) return null;

  const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
  const valid = [];
  for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
  const m = valid.length;
  if (m < 3) return null;

  const itemMeans = itemNames.map((_, idx) => valid.reduce((a,i)=>a+scores[idx][i],0)/m);
  const itemVars = itemNames.map((_, idx) => valid.reduce((a,i)=>a+(scores[idx][i]-itemMeans[idx])**2,0)/m);
  const itemSds = itemVars.map(Math.sqrt);

  // Correlation matrix
  const corrM = itemNames.map((_, i) => itemNames.map((__, j) => {
    if (i === j) return 1;
    let cov = 0;
    valid.forEach(ri => cov += (scores[i][ri]-itemMeans[i])*(scores[j][ri]-itemMeans[j]));
    cov /= m;
    return itemSds[i]>0&&itemSds[j]>0 ? cov/(itemSds[i]*itemSds[j]) : 0;
  }));

  // Average inter-item correlation
  let sumCorr = 0, cCount = 0;
  for (let i = 0; i < itemNames.length; i++)
    for (let j = i+1; j < itemNames.length; j++) { sumCorr += corrM[i][j]; cCount++; }
  const avgCorr = cCount > 0 ? sumCorr / cCount : 0;

  // Cronbach's Alpha
  const sumVar = itemVars.reduce((a,b)=>a+b,0);
  let totalVar = 0;
  for (let i = 0; i < itemNames.length; i++)
    for (let j = 0; j < itemNames.length; j++) {
      let cov = 0;
      valid.forEach(ri => cov += (scores[i][ri]-itemMeans[i])*(scores[j][ri]-itemMeans[j]));
      cov /= m;
      totalVar += cov;
    }
  const alpha = totalVar > 0 ? (itemNames.length/(itemNames.length-1))*(1-sumVar/totalVar) : 0;

  // PCA → loading, eigenvalue, AVE, TVE
  const pc = firstPC(corrM);
  const loadings = pc.vector.map((_, i) => pc.loadings[i]);
  const avgLoading = loadings.reduce((a,b)=>a+Math.abs(b),0)/itemNames.length;
  const eig = pc.eigval;
  const tve = itemNames.length > 0 ? Math.min(1, eig / itemNames.length) : 0;
  const ave = loadings.reduce((a,b)=>a+b*b,0)/itemNames.length;

  // KMO
  const partialCov = matInverse(corrM);
  let kmoNum = 0, kmoDen = 0;
  if (partialCov) {
    for (let i = 0; i < itemNames.length; i++) {
      for (let j = i+1; j < itemNames.length; j++) {
        const r = corrM[i][j];
        const p = -partialCov[i][j] / Math.sqrt(partialCov[i][i] * partialCov[j][j]);
        kmoNum += r * r;
        kmoDen += r * r + p * p;
      }
    }
  }
  const kmo = kmoDen > 0 ? kmoNum / kmoDen : 0;

  // Bartlett's test
  const bartlett = bartlettTest(corrM, m);

  return {
    alpha, avgCorr, avgLoading, ave, kmo, eig, tve,
    itemNames, itemMeans, itemSds, m,
    bartlettChiSq: bartlett.chiSq,
    bartlettSig: bartlett.p < 0.05
  };
}

function _computeRegressionMetrics(dvKey) {
  const constructKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  const predictors = constructKeys.filter(k =>
    k !== dvKey && variables.find(v => v.construct === k)?.role !== 'moderating'
  );
  if (predictors.length === 0) return null;

  const rows = generatedData.rawRows;
  const n = rows.length;

  const comp = {};
  [...predictors, dvKey].forEach(k => {
    const its = variables.filter(v => v.construct === k).map(v => v.name);
    comp[k] = rows.map(r => {
      let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
      return c>0?s/c:null;
    });
  });

  const valid = [];
  for (let i = 0; i < n; i++) {
    if ([...predictors, dvKey].every(k => comp[k][i] !== null)) valid.push(i);
  }
  const m = valid.length;
  if (m <= predictors.length + 5) return null;

  const y = valid.map(i => comp[dvKey][i]);
  const yMean = y.reduce((a,b)=>a+b,0)/m;
  const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/m);

  const R = corrMatrixFromData(valid.map(i=>{
    const o={__dv__:comp[dvKey][i]};
    predictors.forEach(p=>{o[p]=comp[p][i];});
    return o;
  }),['__dv__',...predictors]);

  const rY = predictors.map((_,j)=>R[0][j+1]);
  const Rxx = predictors.map((_,i)=>predictors.map((_,j)=>R[i+1][j+1]));
  let RxxInv = matInverse(Rxx);
  if (!RxxInv) {
    const lam=1e-8*predictors.length;
    RxxInv=matInverse(Rxx.map((r,i)=>r.map((v,j)=>i===j?v+lam:v)));
  }
  let stdBeta=[], rSquared=0;
  if (RxxInv) {
    stdBeta=RxxInv.map(r=>r.reduce((a,v,j)=>a+v*rY[j],0));
    rSquared=stdBeta.reduce((a,b,j)=>a+b*rY[j],0);
  }
  if (rSquared<0) rSquared=0;
  if (rSquared>1) rSquared=1;

  const adjRSq = 1-(1-rSquared)*(m-1)/(m-predictors.length-1);

  // VIF
  const vif = predictors.map((_, j) => RxxInv ? RxxInv[j][j] : 10);

  // VIF overall status
  const vifOk = vif.every(v => v < 2);

  return { rSquared, adjRSq, vif, vifOk, m, predictors, stdBeta };
}

function _computeIVCorrelations() {
  const constructKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  const ivs = constructKeys.filter(k => variables.find(v=>v.construct===k)?.role === 'independent');
  if (ivs.length < 2) return [];

  const rows = generatedData.rawRows;
  const n = rows.length;
  const comp = {};
  ivs.forEach(k => {
    const its = variables.filter(v=>v.construct===k).map(v=>v.name);
    comp[k] = rows.map(r => {
      let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
      return c>0?s/c:null;
    });
  });

  const valid = [];
  for (let i = 0; i < n; i++) { if (ivs.every(k => comp[k][i] !== null)) valid.push(i); }
  const m = valid.length;
  if (m < 5) return [];

  const pairs = [];
  for (let i = 0; i < ivs.length; i++) {
    for (let j = i+1; j < ivs.length; j++) {
      const vals1 = valid.map(idx => comp[ivs[i]][idx]);
      const vals2 = valid.map(idx => comp[ivs[j]][idx]);
      const m1 = vals1.reduce((a,b)=>a+b,0)/m;
      const m2 = vals2.reduce((a,b)=>a+b,0)/m;
      const sd1 = Math.sqrt(vals1.reduce((a,b)=>a+(b-m1)**2,0)/m);
      const sd2 = Math.sqrt(vals2.reduce((a,b)=>a+(b-m2)**2,0)/m);
      let cov = 0;
      valid.forEach(idx => cov += (comp[ivs[i]][idx]-m1)*(comp[ivs[j]][idx]-m2));
      cov /= m;
      const r = sd1>0&&sd2>0 ? cov/(sd1*sd2) : 0;
      pairs.push({ c1: ivs[i], c2: ivs[j], r });
    }
  }
  return pairs;
}

// ====== EFA — Exploratory Factor Analysis ======

// Full PCA via deflation: extract ALL components from correlation matrix
function _fullPCA(R) {
  const n = R.length;
  let residual = R.map(row => [...row]);
  const comps = [];
  for (let f = 0; f < n; f++) {
    const pc = firstPC(residual);
    if (pc.eigval < 1e-6) break;
    comps.push(pc);
    const v = pc.vector;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        residual[i][j] -= pc.eigval * v[i] * v[j];
  }
  return comps;
}

// Kaiser Varimax rotation (orthogonal)
function _varimax(loadings) {
  const nRows = loadings.length, nCols = loadings[0].length;
  const h2 = loadings.map(row => Math.sqrt(row.reduce((a,b)=>a+b*b,0)));
  const normL = loadings.map((row,i) => h2[i] > 1e-6 ? row.map(v => v/h2[i]) : row.map(()=>0));
  let L = normL.map(r => [...r]);
  for (let iter = 0; iter < 100; iter++) {
    let maxAng = 0;
    for (let i = 0; i < nCols; i++) {
      for (let j = i+1; j < nCols; j++) {
        let A=0,B=0,D=0;
        for (let r = 0; r < nRows; r++) {
          const x=L[r][i], y=L[r][j];
          A += x*x - y*y;
          B += 2*x*y;
          D += (x*x - y*y)*(x*x - y*y) - (2*x*y)*(2*x*y);
        }
        const N=nRows, num=2*(N*A*B/2-D);
        const den = N*(A*A-B*B) - (A*A+B*B);
        const theta = Math.abs(den)>1e-8 ? 0.25*Math.atan2(num,den) : 0;
        if (Math.abs(theta) < 1e-8) continue;
        const c=Math.cos(theta), s=Math.sin(theta);
        for (let r = 0; r < nRows; r++) {
          const oi=L[r][i], oj=L[r][j];
          L[r][i] = oi*c + oj*s;
          L[r][j] = -oi*s + oj*c;
        }
        maxAng = Math.max(maxAng, Math.abs(theta));
      }
    }
    if (maxAng < 1e-5) break;
  }
  return L.map((row,i) => h2[i] > 1e-6 ? row.map(v => v*h2[i]) : row.map(()=>0));
}

// Run full EFA on all Likert items
function computeEFA() {
  if (!generatedData) return null;
  const likertItems = variables.filter(v => v.type === 'likert5' || v.type === 'likert7');
  const itemNames = likertItems.map(v => v.name);
  if (itemNames.length < 3) return null;

  const rows = generatedData.rawRows;
  const n = rows.length;
  const valid = [];
  for (let i = 0; i < n; i++) {
    if (itemNames.every(name => typeof rows[i][name]==='number'&&!isNaN(rows[i][name]))) valid.push(i);
  }
  if (valid.length < 10) return null;

  const R = corrMatrixFromData(valid.map(ri => { const o={}; itemNames.forEach(n=>{o[n]=rows[ri][n];}); return o; }), itemNames);

  // Step 1: Full PCA
  const comps = _fullPCA(R);

  // Step 2: Keep factors with eigenvalue > 1
  const eigCutoff = 1;
  const nFactors = comps.filter(c => c.eigval > eigCutoff).length;
  if (nFactors < 1) return { nFactors:0, comps, itemNames, R, error:'Không có factor nào >1' };

  // Step 3: Unrotated loadings matrix [items × nFactors]
  const unrotated = itemNames.map((_, i) => comps.slice(0, nFactors).map(c => c.loadings[i]));

  // Step 4: Varimax rotation
  const rotated = _varimax(unrotated);

  // Step 5: Communalities (h²) = row sum of squared rotated loadings
  const communalities = rotated.map(row => row.reduce((a,b)=>a+b*b,0));

  // Step 6: Factor assignment (highest loading per item)
  const assignment = rotated.map(row => {
    let maxIdx = 0, maxVal = 0;
    row.forEach((v,i) => { if (Math.abs(v) > maxVal) { maxVal = Math.abs(v); maxIdx = i; }});
    return { factor: maxIdx, loading: row[maxIdx] };
  });

  // Step 7: Cross-loading detection (items with significant loading on another factor)
  const crossLoadings = [];
  rotated.forEach((row, ii) => {
    const sorted = row.map((v,i) => ({ v: Math.abs(v), i })).sort((a,b) => b.v - a.v);
    if (sorted.length >= 2 && sorted[1].v > 0.3) {
      crossLoadings.push({
        item: itemNames[ii],
        primaryFactor: sorted[0].i,
        primaryLoading: row[sorted[0].i],
        secondaryFactor: sorted[1].i,
        secondaryLoading: row[sorted[1].i]
      });
    }
  });

  // Step 8: Expected factor assignment (based on construct labels)
  const expectedAssignment = itemNames.map((name, ii) => {
    const v = likertItems[ii];
    const constructKey = v.construct;
    const constructIdx = [...new Set(likertItems.filter(x=>x.construct).map(x=>x.construct))].indexOf(constructKey);
    return { item: name, expectedFactor: constructIdx, constructLabel: v.constructLabel || constructKey };
  });

  // Step 9: Item misclassification
  const misclassified = [];
  const uniqueConstructs = [...new Set(likertItems.filter(x=>x.construct).map(x=>x.construct))];
  assignment.forEach((a, ii) => {
    const v = likertItems[ii];
    const expectedIdx = uniqueConstructs.indexOf(v.construct);
    if (a.factor !== expectedIdx && expectedIdx >= 0 && expectedIdx < nFactors) {
      misclassified.push({
        item: itemNames[ii],
        loadedFactor: a.factor,
        expectedFactor: expectedIdx,
        constructLabel: v.constructLabel || v.construct,
        loading: a.loading
      });
    }
  });

  // Step 10: TVE and per-factor variance
  const totalVar = itemNames.length;
  const factorVar = comps.slice(0, nFactors).map((c,i) => {
    const sumSqLoadings = rotated.reduce((a,row) => a + row[i]*row[i], 0);
    return { eigval: c.eigval, varPct: sumSqLoadings / totalVar * 100, varCum: 0 };
  });
  let cum = 0;
  factorVar.forEach(f => { cum += f.varPct; f.varCum = cum; });

  return {
    itemNames, nFactors, nItems: itemNames.length, m: valid.length,
    eigenvalues: comps.map(c => c.eigval),
    factorVar,
    rotated,
    unrotated,
    communalities,
    assignment,
    crossLoadings,
    expectedAssignment,
    misclassified,
    totalVarExplained: cum
  };
}

// ====== EFA RENDER ======

function renderEFA() {
  const content = document.getElementById('quality-content');
  if (!content) return;

  const oldEfa = document.getElementById('efa-section');
  if (oldEfa) oldEfa.remove();

  const efa = computeEFA();
  if (!efa || efa.nFactors < 1) {
    content.insertAdjacentHTML('beforeend', `<div id="efa-section" class="var-item" style="margin-top:.5rem;background:#f8fafc">
      <div style="font-size:.85rem;font-weight:600;color:var(--gray-400)">🔬 EFA: Không đủ dữ liệu hoặc items</div></div>`);
    return;
  }

  const colorPalette = ['#4f46e5','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be123c','#65a30d'];
  const nCols = efa.nFactors;

  let html = `<div id="efa-section" class="var-item" style="margin-top:.5rem;background:#f8fafc">
    <div class="var-item-header">
      <span style="font-size:.85rem;font-weight:600">🔬 EFA — Phân tích nhân tố khám phá</span>
      <span style="font-size:.7rem;color:var(--gray-500)">PCA + Varimax</span>
    </div>

    <!-- KMO / Bartlett summary -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin:.5rem 0">
      <div style="background:#fff;padding:.4rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:.7rem;color:var(--gray-500)">Số factor (eigen > 1)</div>
        <div style="font-size:1rem;font-weight:700;color:${efa.nFactors >= 2 ? '#10b981' : '#d97706'}">${efa.nFactors}</div>
      </div>
      <div style="background:#fff;padding:.4rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:.7rem;color:var(--gray-500)">Tổng phương sai trích</div>
        <div style="font-size:1rem;font-weight:700;color:${efa.totalVarExplained >= 50 ? '#10b981' : '#ef4444'}">${efa.totalVarExplained.toFixed(1)}%</div>
      </div>
      <div style="background:#fff;padding:.4rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
        <div style="font-size:.7rem;color:var(--gray-500)">Items / misclassified</div>
        <div style="font-size:1rem;font-weight:700;color:${efa.misclassified.length === 0 ? '#10b981' : '#d97706'}">${efa.nItems} / ${efa.misclassified.length}</div>
      </div>
    </div>

    <!-- Eigenvalue table -->
    <details style="margin-top:.35rem">
    <summary style="font-size:.75rem;font-weight:600;cursor:pointer;color:var(--gray-600)">📊 Eigenvalues & Phương sai trích</summary>
    <div style="overflow-x:auto;font-size:.7rem;margin-top:.25rem">
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.2rem .4rem">Factor</td>
        <td style="padding:.2rem .4rem;text-align:center">Eigenvalue</td>
        <td style="padding:.2rem .4rem;text-align:center">% Variance</td>
        <td style="padding:.2rem .4rem;text-align:center">Cumulative %</td>
      </tr>`;
  efa.eigenvalues.forEach((eig, i) => {
    const isExtracted = i < efa.nFactors;
    const varPct = efa.factorVar[i] ? efa.factorVar[i].varPct : 0;
    const cumPct = efa.factorVar[i] ? efa.factorVar[i].varCum : 0;
    html += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
      <td style="padding:.15rem .4rem;font-weight:600">${i+1}</td>
      <td style="padding:.15rem .4rem;text-align:center;font-weight:700;color:${eig>1?'#059669':'#6b7280'}">${eig.toFixed(3)}</td>
      <td style="padding:.15rem .4rem;text-align:center">${varPct.toFixed(1)}%</td>
      <td style="padding:.15rem .4rem;text-align:center;font-weight:600">${cumPct.toFixed(1)}%</td>
    </tr>`;
  });
  html += `</table></div></details>`;

  // Rotated Component Matrix
  html += `<details open style="margin-top:.35rem">
    <summary style="font-size:.75rem;font-weight:600;cursor:pointer;color:var(--gray-600)">📋 Ma trận xoay (Rotated Component Matrix)</summary>
    <div style="overflow-x:auto;font-size:.7rem;margin-top:.25rem">
    <table style="width:100%;border-collapse:collapse;min-width:400px">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.2rem .4rem;white-space:nowrap">Item</td>
        <td style="padding:.2rem .4rem;white-space:nowrap">Kỳ vọng</td>
        ${Array.from({length:nCols}, (_,i) => `<td style="padding:.2rem .4rem;text-align:center;color:${colorPalette[i%colorPalette.length]};font-weight:700">Factor ${i+1}</td>`).join('')}
        <td style="padding:.2rem .4rem;text-align:center">Communality</td>
        <td style="padding:.2rem .4rem;text-align:center">Gán</td>
      </tr>`;
  efa.itemNames.forEach((name, ii) => {
    const v = variables.find(x => x.name === name);
    const expected = efa.expectedAssignment[ii];
    const expColor = colorPalette[(expected.expectedFactor >= 0 ? expected.expectedFactor : 0) % colorPalette.length];
    const loadingColor = efa.communalities[ii] >= 0.3 ? '#10b981' : efa.communalities[ii] >= 0.2 ? '#d97706' : '#ef4444';
    const assignColor = colorPalette[efa.assignment[ii].factor % colorPalette.length];
    html += `<tr${ii%2===1?' style="background:var(--gray-50)"':''}>
      <td style="padding:.15rem .4rem;white-space:nowrap;font-weight:500">${name}</td>
      <td style="padding:.15rem .4rem;white-space:nowrap;font-size:.65rem;color:${expColor}">${expected.constructLabel}</td>`;
    for (let fi = 0; fi < nCols; fi++) {
      const val = efa.rotated[ii][fi];
      const isPrimary = Math.abs(val) === Math.max(...efa.rotated[ii].map(Math.abs));
      const crossLoad = !isPrimary && Math.abs(val) > 0.3;
      html += `<td style="padding:.15rem .4rem;text-align:center;font-weight:${isPrimary?'700':'400'};color:${crossLoad?'#dc2626':Math.abs(val)>=0.5?'#059669':'#6b7280'}">${val.toFixed(3)}</td>`;
    }
    html += `<td style="padding:.15rem .4rem;text-align:center;font-weight:600;color:${loadingColor}">${efa.communalities[ii].toFixed(3)}</td>`;
    html += `<td style="padding:.15rem .4rem;text-align:center;font-size:.65rem;color:${assignColor};font-weight:600">F${efa.assignment[ii].factor+1}</td>`;
    html += `</tr>`;
  });
  html += `</table></div></details>`;

  // Cross-loading warnings
  if (efa.crossLoadings.length > 0) {
    html += `<div style="margin-top:.35rem;padding:.35rem .5rem;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-size:.72rem">
      <strong style="color:#991b1b">⚠️ Cross-loadings (có item tải > 0.3 lên factor khác):</strong><br>`;
    efa.crossLoadings.forEach(cl => {
      html += `• <b>${cl.item}</b>: F${cl.primaryFactor+1}(${cl.primaryLoading.toFixed(3)}) ↔ F${cl.secondaryFactor+1}(${cl.secondaryLoading.toFixed(3)})<br>`;
    });
    html += `</div>`;
  }

  // Misclassification warnings
  if (efa.misclassified.length > 0) {
    html += `<div style="margin-top:.35rem;padding:.35rem .5rem;background:#fefce8;border:1px solid #fde68a;border-radius:6px;font-size:.72rem">
      <strong style="color:#92400e">⚠️ Items tải sai factor (không đúng kỳ vọng):</strong><br>`;
    efa.misclassified.forEach(mc => {
      html += `• <b>${mc.item}</b> (${mc.constructLabel}): tải vào F${mc.loadedFactor+1} thay vì F${mc.expectedFactor+1}<br>`;
    });
    html += `<div style="margin-top:.25rem;font-style:italic;color:var(--gray-500)">💡 Nếu sai nhiều, bấm "Fix Cross-load" bên dưới.</div>`;
    html += `</div>`;
  }

  html += `</div>`;
  content.insertAdjacentHTML('beforeend', html);
}

// ====== EFA FIX ======

function fixEFA_CrossLoading() {
  if (!generatedData) return;
  _qualitySnapshot();
  const efa = computeEFA();
  if (!efa || efa.crossLoadings.length === 0) { showToast('✅ Không có cross-loading cần sửa', 'info'); return; }
  const rows = generatedData.rawRows;
  const scales = {};
  efa.crossLoadings.forEach(cl => {
    const v = variables.find(x => x.name === cl.item);
    if (!v) return;
    const scale = v.scale || 5;
    scales[cl.item] = scale;
    // Find all items in the secondary factor
    const secondaryItems = efa.itemNames.filter((_, ii) => efa.assignment[ii].factor === cl.secondaryFactor);
    if (secondaryItems.length === 0) return;
    // For each row, reduce influence of secondary factor on this item
    rows.forEach(row => {
      const old = row[cl.item];
      if (typeof old !== 'number' || isNaN(old)) return;
      const secondaryMean = secondaryItems.reduce((s,n) => s + (typeof row[n]==='number'?row[n]:0), 0) / secondaryItems.length;
      const primaryItems = efa.itemNames.filter((_, ii) => efa.assignment[ii].factor === cl.primaryFactor);
      if (primaryItems.length === 0) return;
      const primaryMean = primaryItems.reduce((s,n) => s + (typeof row[n]==='number'?row[n]:0), 0) / primaryItems.length;
      // Pull toward primary factor mean, away from secondary
      const pull = (primaryMean - secondaryMean) * 0.2;
      let newVal = Math.round(old + pull);
      newVal = Math.min(scale, Math.max(1, newVal));
      if (newVal !== old) row[cl.item] = newVal;
    });
  });
  // Update labelRows
  efa.itemNames.forEach(name => {
    const v = variables.find(x => x.name === name);
    if (!v || !v.labels) return;
    const idx = generatedData.colNames.indexOf(name);
    if (idx === -1) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][name];
      lr[name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
  _refreshQEditor();
  showToast('✅ Đã sửa cross-loadings', 'success');
}

function fixEFA_Communality() {
  if (!generatedData) return;
  _qualitySnapshot();
  const efa = computeEFA();
  if (!efa) return;
  const rows = generatedData.rawRows;
  // For items with low communality, pull them toward the mean of their factor
  efa.itemNames.forEach((name, ii) => {
    if (efa.communalities[ii] >= 0.3) return;
    const v = variables.find(x => x.name === name);
    const scale = v?.scale || 5;
    const factor = efa.assignment[ii].factor;
    const factorItems = efa.itemNames.filter((_, j) => efa.assignment[j].factor === factor);
    if (factorItems.length < 2) return;
    rows.forEach(row => {
      const old = row[name];
      if (typeof old !== 'number' || isNaN(old)) return;
      const factorMean = factorItems.reduce((s,n) => s + (typeof row[n]==='number'?row[n]:0), 0) / factorItems.length;
      const pull = (factorMean - old) * 0.3;
      let newVal = Math.round(old + pull);
      newVal = Math.min(scale, Math.max(1, newVal));
      if (newVal !== old) row[name] = newVal;
    });
  });
  // Update labelRows
  efa.itemNames.forEach(name => {
    const v = variables.find(x => x.name === name);
    if (!v || !v.labels) return;
    const idx = generatedData.colNames.indexOf(name);
    if (idx === -1) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][name];
      lr[name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
  _refreshQEditor();
  showToast('✅ Đã sửa communalities thấp', 'success');
}

// ====== FIX: Item-Total Correlation ≥ 0.3 ======
function fixItemTotalCorrelation(constructKey) {
  if (!generatedData || !constructKey) return;
  const items = variables.filter(v => v.construct === constructKey);
  const itemNames = items.map(v => v.name);
  if (itemNames.length < 2) return;
  const scale = items[0]?.scale || 5;
  const rows = generatedData.rawRows;
  const n = rows.length;

  for (let iter = 0; iter < 3; iter++) {
    const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
    if (valid.length < 5) break;
    const m = valid.length;

    // Compute corrected item-total correlation for each item
    for (let ii = 0; ii < itemNames.length; ii++) {
      const itemScores = valid.map(ri => scores[ii][ri]);
      const totalScores = valid.map(ri => itemNames.reduce((a, n, j) => a + (j===ii?0:(typeof rows[ri][n]==='number'?rows[ri][n]:0)), 0));
      const mI = itemScores.reduce((a,b)=>a+b,0)/m;
      const mT = totalScores.reduce((a,b)=>a+b,0)/m;
      const sdI = Math.sqrt(itemScores.reduce((a,b)=>a+(b-mI)**2,0)/m);
      const sdT = Math.sqrt(totalScores.reduce((a,b)=>a+(b-mT)**2,0)/m);
      const covIT = itemScores.reduce((a,b,i)=>a+(b-mI)*(totalScores[i]-mT),0)/m;
      const corr = sdI>0&&sdT>0 ? covIT/(sdI*sdT) : 0;
      if (corr >= 0.3) continue;

      // Fix: pull item toward total score direction
      const name = itemNames[ii];
      let changed = 0;
      valid.forEach(ri => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        const total = totalScores[ri];
        const item = itemScores[ri];
        const pullDir = (total/items.length - item) * 0.2;
        let newVal = Math.round(old + pullDir);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old && Math.random() < 0.5) { rows[ri][name] = newVal; changed++; }
      });
    }

    // Also pull toward composite (same as internal fix but lighter)
    const itemMeans = itemNames.map((_, idx) => valid.reduce((a,i)=>a+scores[idx][i],0)/m);
    const composite = valid.map(ri => itemNames.reduce((s,n)=>s+rows[ri][n],0)/itemNames.length);
    let changed2 = 0;
    valid.forEach((ri, idx) => {
      const comp = composite[idx];
      itemNames.forEach((name) => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        const pull = (comp - old) * 0.15;
        let newVal = Math.round(old + pull);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old && Math.random() < 0.3) { rows[ri][name] = newVal; changed2++; }
      });
    });
    if (changed2 < 2) break;
  }

  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

// ====== FIX: Residual normality (mean ≈ 0, SD ≈ 1) ======
function fixResidualNormality(dvKey) {
  if (!generatedData) return;
  const rows = generatedData.rawRows;
  const n = rows.length;
  const constructKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  const predictors = constructKeys.filter(k =>
    k !== dvKey && variables.find(v => v.construct === k)?.role !== 'moderating'
  );
  if (predictors.length === 0) return;

  const comp = {};
  [...predictors, dvKey].forEach(k => {
    const its = variables.filter(v => v.construct === k).map(v => v.name);
    comp[k] = rows.map(r => {
      let s=0,c=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
      return c>0?s/c:null;
    });
  });

  const valid = [];
  for (let i = 0; i < n; i++) {
    if ([...predictors, dvKey].every(k => comp[k][i] !== null)) valid.push(i);
  }
  if (valid.length < 10) return;
  const m = valid.length;

  // Compute current residuals
  const y = valid.map(i => comp[dvKey][i]);
  const yMean = y.reduce((a,b)=>a+b,0)/m;
  const xMean = predictors.map(p => valid.reduce((a,i)=>a+comp[p][i],0)/m);
  const Rmat = corrMatrixFromData(valid.map(i=>{const o={__dv__:comp[dvKey][i]};predictors.forEach(p=>{o[p]=comp[p][i];});return o;}),['__dv__',...predictors]);
  const rY = predictors.map((_,j)=>Rmat[0][j+1]);
  const Rxx = predictors.map((_,i)=>predictors.map((_,j)=>Rmat[i+1][j+1]));
  let RxxInv = matInverse(Rxx);
  if (!RxxInv) return;
  const stdBeta = RxxInv.map(r=>r.reduce((a,v,j)=>a+v*rY[j],0));
  const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/m);
  const xSd = predictors.map(p => Math.sqrt(valid.reduce((a,i)=>a+(comp[p][i]-xMean[predictors.indexOf(p)])**2,0)/m));
  const rawBeta = [yMean - stdBeta.reduce((a,b,j)=>a+b*ySd*xMean[j]/(xSd[j]||1),0)];
  predictors.forEach((_,j)=>rawBeta.push(xSd[j]>0?stdBeta[j]*ySd/xSd[j]:0));
  const yHat = valid.map(i=>rawBeta[0]+predictors.reduce((a,p,j)=>a+rawBeta[j+1]*comp[p][i],0));
  const residuals = valid.map((i,ri)=>y[ri]-yHat[ri]);
  const resMean = residuals.reduce((a,b)=>a+b,0)/m;
  const resSd = Math.sqrt(residuals.reduce((a,b)=>a+(b-resMean)**2,0)/m);
  if (resSd < 0.01) return;

  // Adjust DV items to fix residual distribution
  const dvItems = variables.filter(v => v.construct === dvKey).map(v => v.name);
  const scale = variables.find(v => v.construct === dvKey)?.scale || 5;
  const targetMean = 0, targetSd = 1;

  valid.forEach((ri, i) => {
    const res = residuals[i];
    // Scale and shift residual
    const adjRes = (res - resMean) / resSd; // Standardize
    const targetRes = adjRes * targetSd + targetMean;
    const delta = targetRes - res;
    if (Math.abs(delta) < 0.05) { /* skip — residual already close to target */ }
    else {
      dvItems.forEach(name => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        let newVal = Math.round(old + delta * 0.3);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old) rows[ri][name] = newVal;
      });
    }
  });

  dvItems.forEach(name => {
    const v = variables.find(x => x.name === name);
    if (!v || !v.labels) return;
    const idx = generatedData.colNames.indexOf(name);
    if (idx === -1) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][name];
      lr[name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

// ====== FIX FUNCTIONS ======

// Fix: Internal quality (alpha + loading + AVE + KMO + avgCorr all at once)
function fixConstructInternal(constructKey) {
  if (!generatedData || !constructKey) return;
  const items = variables.filter(v => v.construct === constructKey);
  const itemNames = items.map(v => v.name);
  if (itemNames.length < 2) return;
  const scale = items[0]?.scale || 5;
  const rows = generatedData.rawRows;
  const n = rows.length;

  for (let iter = 0; iter < 5; iter++) {
    const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
    if (valid.length < 5) break;
    const m = valid.length;

    const itemMeans = itemNames.map((_, idx) => valid.reduce((a,i)=>a+scores[idx][i],0)/m);
    const composite = valid.map(ri => itemNames.reduce((s,n)=>s+rows[ri][n],0)/itemNames.length);

    let totalChanged = 0;
    valid.forEach((ri, idx) => {
      const comp = composite[idx];
      itemNames.forEach((name) => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        // Pull toward composite with decreasing strength
        const pull = (comp - old) * 0.25;
        let newVal = Math.min(scale, Math.max(1, Math.round(old + pull)));
        if (newVal === old) {
          // tiny random nudge if stuck
          newVal = Math.min(scale, Math.max(1, old + (Math.random() < 0.5 ? 1 : -1)));
          if (Math.abs(newVal - old) > 1) newVal = old;
        }
        if (newVal !== old) { rows[ri][name] = newVal; totalChanged++; }
      });
    });
    if (totalChanged < 2) break;
  }

  // Update labelRows
  items.forEach(v => {
    const idx = generatedData.colNames.indexOf(v.name);
    if (idx === -1 || !v.labels) return;
    generatedData.labelRows.forEach((lr, ri) => {
      const val = generatedData.rawRows[ri][v.name];
      lr[v.name] = val ? v.labels[val - 1] || String(val) : '';
    });
  });
}

// Fix: R² by adjusting DV items toward predicted + noise
function fixDV_Rsquared(dvKey) {
  const metrics = _computeRegressionMetrics(dvKey);
  if (!metrics || metrics.predictors.length === 0) return;
  const targetR2 = parseFloat(document.getElementById('q-rsq')?.value) || 0.5;
  if (metrics.rSquared >= targetR2) return;

  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });
  aiSetRSquaredDirect(dvKey, targetR2, constructs);
}

// Fix: IV inter-correlation toward target range
function fixIVCorrelation(c1, c2) {
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });
  const corrMin = parseFloat(document.getElementById('q-corr-min')?.value) || 0.30;
  const corrMax = parseFloat(document.getElementById('q-corr-max')?.value) || 0.60;
  const targetR = (corrMin + corrMax) / 2;
  aiSetCorrelationDirect(c1, c2, targetR, constructs);
}

// Fix: VIF — reduce multicollinearity by reducing IV correlations
function fixVIF() {
  const constructKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  const ivs = constructKeys.filter(k => variables.find(v=>v.construct===k)?.role === 'independent');
  if (ivs.length < 2) return;

  const pairs = _computeIVCorrelations();
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });

  pairs.forEach(p => {
    if (Math.abs(p.r) > 0.5) {
      const targetR = Math.min(Math.abs(p.r) * 0.7, 0.4);
      try { aiSetCorrelationDirect(p.c1, p.c2, targetR, constructs); } catch(e) {}
    }
  });
}

// ====== REFRESH UI ======

function _refreshQEditor() {
  if (!generatedData) return;
  computeDiff();
  _dataVersion++;
  const { rawRows, colNames } = generatedData;
  updatePreview(rawRows, colNames);
  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    }
  });
  try { showQualityReport(rawRows, constructs, rawRows.length); } catch(e) {}
  renderQualityEditor();

  const totalChanged = Object.values(_changedCells).reduce((sum, cols) => sum + Object.keys(cols).length, 0);
  if (totalChanged > 0) {
    const rowCount = Object.keys(_changedCells).length;
    const changedCols = new Set();
    Object.values(_changedCells).forEach(cols => Object.keys(cols).forEach(c => changedCols.add(c)));
    showToast(`✅ Đã sửa: ${totalChanged} ô (${rowCount} dòng, ${changedCols.size} biến)`, 'success');
  }
}

function _clr(val, good) {
  return good(val) ? '#10b981' : '#ef4444';
}

// ====== RENDER QUALITY EDITOR (compute-based, no DOM dependency) ======

function renderQualityEditor() {
  const content = document.getElementById('quality-content');
  if (!content) return;

  const oldPanel = document.getElementById('quality-editor-panel');
  if (oldPanel) oldPanel.remove();

  const constructKeys = [];
  const constructMap = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructMap[v.construct]) {
        constructMap[v.construct] = { label: v.constructLabel || v.construct, role: v.role };
        constructKeys.push(v.construct);
      }
    }
  });
  if (constructKeys.length === 0) return;

  // Compute metrics for every construct
  const allMetrics = {};
  constructKeys.forEach(k => { allMetrics[k] = _computeConstructMetrics(k); });

  const ivPairs = _computeIVCorrelations();
  const targetAlpha = parseFloat(document.getElementById('q-alpha')?.value) || 0.8;
  const targetLoading = parseFloat(document.getElementById('q-loading')?.value) || 0.6;
  const targetRSq = parseFloat(document.getElementById('q-rsq')?.value) || 0.5;
  const roleColor = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };
  const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };

  let html = `<div id="quality-editor-panel" style="margin-top:.75rem;padding-top:.75rem;border-top:2px solid #7c3aed">
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap">
      <span style="font-size:.85rem;font-weight:700;color:#7c3aed">🔧 Trình sửa chất lượng (sửa dữ liệu thô)</span>
      <span style="font-size:.7rem;color:var(--gray-500)">Bấm từng nút để tự động cải thiện</span>
      <div style="margin-left:auto;display:flex;gap:.35rem">
        <button class="btn btn-sm" onclick="openQualityWizard()" style="background:#7c3aed;color:#fff;font-size:.7rem">🧙 Hướng dẫn từng bước</button>
        <button class="btn btn-sm btn-outline" onclick="if(_qualityUndoData&&confirm('Khôi phục?'))_qualityRestore()" style="font-size:.7rem">↩️ Undo</button>
      </div>
    </div>
    <div style="font-size:.7rem;color:var(--gray-500);margin-bottom:.5rem;background:#fefce8;padding:.35rem .5rem;border-radius:6px">
      💡 <strong>Cách dùng:</strong> Với mỗi nhân tố, bấm <b>📊 Nội tại</b> để cải thiện đồng thời α + λ + AVE + KMO. 
      Nếu cần tăng R², bấm <b>🎯 R²</b>. Giới hạn dưới lấy từ 🎯 Yêu cầu chất lượng.
    </div>
    <div style="display:flex;flex-direction:column;gap:.35rem">`;

  // Per-construct row
  constructKeys.forEach(k => {
    const c = constructMap[k];
    const m = allMetrics[k];
    if (!m) {
      html += `<div style="display:flex;align-items:center;gap:.35rem;padding:.35rem .5rem;background:#f9fafb;border-radius:6px;border:1px solid var(--gray-200)">
        <span style="font-weight:600;font-size:.8rem;color:${roleColor[c.role]||'#374151'};min-width:100px">${c.label}</span>
        <span style="font-size:.7rem;color:var(--gray-400)">Không đủ dữ liệu</span></div>`;
      return;
    }

    // Single unified "Nội tại" button for alpha+loading+AVE+KMO
    const needsInternal = m.alpha < targetAlpha || m.avgLoading < targetLoading || m.ave < 0.3 || m.kmo < 0.5;

    // R² for DV
    const isDV = c.role === 'dependent';
    let dvMetrics = null;
    if (isDV) dvMetrics = _computeRegressionMetrics(k);

    // Display row
    html += `<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;background:#fff;padding:.35rem .5rem;border-radius:6px;border:1px solid var(--gray-200)">
      <span style="font-weight:600;font-size:.8rem;color:${roleColor[c.role]||'#374151'};min-width:80px">${c.label}</span>`;

    // Alpha
    html += `<span style="font-size:.6rem;color:var(--gray-400)">α</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.alpha, v=>v>=targetAlpha)};min-width:36px">${m.alpha.toFixed(3)}</span>`;

    // Loading
    html += `<span style="font-size:.6rem;color:var(--gray-400)">λ</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.avgLoading, v=>v>=targetLoading)};min-width:36px">${m.avgLoading.toFixed(3)}</span>`;

    // AVE
    html += `<span style="font-size:.6rem;color:var(--gray-400)">AVE</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.ave, v=>v>=0.3)};min-width:36px">${m.ave.toFixed(3)}</span>`;

    // KMO
    html += `<span style="font-size:.6rem;color:var(--gray-400)">KMO</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.kmo, v=>v>=0.5)};min-width:36px">${m.kmo.toFixed(3)}</span>`;

    // Item-Total correlation (min across items)
    const minItemTotal = _computeItemTotalCorr(k);
    const itcOk = minItemTotal >= 0.3;
    html += `<span style="font-size:.6rem;color:var(--gray-400)">r-total</span>
      <span style="font-size:.7rem;font-weight:600;color:${_clr(minItemTotal, v=>v>=0.3)};min-width:36px">${minItemTotal.toFixed(3)}</span>
      <button class="btn btn-sm" onclick="_execFixITC('${k}')" style="font-size:.55rem;padding:.1rem .25rem;background:${itcOk?'#d1fae5':'#7c3aed'};color:${itcOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${itcOk?'✅':'r-total'}</button>`;

    // Nút Nội tại
    const intLabel = needsInternal ? '📊 Nội tại' : '✅';
    html += `<button class="btn btn-sm" onclick="_execFix('${k}')" style="font-size:.6rem;padding:.15rem .35rem;background:${needsInternal?'#7c3aed':'#d1fae5'};color:${needsInternal?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer">${intLabel}</button>`;

    // R² for DV
    if (isDV && dvMetrics) {
      const rsqOk = dvMetrics.rSquared >= targetRSq;
      html += `<span style="font-size:.6rem;color:var(--gray-400);margin-left:.25rem">R²</span>
        <span style="font-size:.75rem;font-weight:600;color:${_clr(dvMetrics.rSquared, v=>v>=targetRSq)};min-width:36px">${dvMetrics.rSquared.toFixed(3)}</span>
        <button class="btn btn-sm" onclick="_execFixDV('${k}')" style="font-size:.6rem;padding:.15rem .35rem;background:${rsqOk?'#d1fae5':'#059669'};color:${rsqOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${rsqOk?'✅':'🎯 R²'}</button>`;

      // VIF
      if (dvMetrics.vif && dvMetrics.vif.length > 0) {
        const maxVif = Math.max(...dvMetrics.vif);
        const vifOk = maxVif < 2;
        html += `<span style="font-size:.6rem;color:var(--gray-400)">VIF</span>
          <span style="font-size:.75rem;font-weight:600;color:${_clr(maxVif, v=>v<2)};min-width:36px">${maxVif.toFixed(2)}</span>
          <button class="btn btn-sm" onclick="_execFixVIF()" style="font-size:.6rem;padding:.15rem .35rem;background:${vifOk?'#d1fae5':'#dc2626'};color:${vifOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${vifOk?'✅':'🔄 VIF'}</button>`;

        // Residual normality fix
        html += `<span style="font-size:.6rem;color:var(--gray-400)">Resid</span>
          <button class="btn btn-sm" onclick="_execFixResidual('${k}')" style="font-size:.55rem;padding:.1rem .25rem;background:#7c3aed;color:#fff;border:none;border-radius:4px;cursor:pointer">📊 Resid</button>`;
      }
    }

    html += `</div>`;
  });

  // IV Correlation row
  if (ivPairs.length > 0) {
    let corrStatus = '✅';
    const corrMin = parseFloat(document.getElementById('q-corr-min')?.value) || 0.30;
    const corrMax = parseFloat(document.getElementById('q-corr-max')?.value) || 0.60;
    ivPairs.forEach(p => { if (p.r < corrMin || p.r > corrMax) corrStatus = '⚠️'; });

    html += `<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;background:#fff;padding:.35rem .5rem;border-radius:6px;border:1px solid var(--gray-200);margin-top:.25rem">
      <span style="font-weight:600;font-size:.8rem;color:#2563eb;min-width:80px">📊 IV Tương quan</span>`;
    ivPairs.forEach(p => {
      const inRange = p.r >= corrMin && p.r <= corrMax;
      html += `<span style="font-size:.6rem;color:var(--gray-400)">${p.c1}↔${p.c2}</span>
        <span style="font-size:.7rem;font-weight:600;color:${_clr(p.r, v=>v>=corrMin&&v<=corrMax)};min-width:32px">${p.r.toFixed(3)}</span>
        <button class="btn btn-sm" onclick="_execFixCorr('${p.c1}','${p.c2}')" style="font-size:.55rem;padding:.1rem .25rem;background:${inRange?'#d1fae5':'#2563eb'};color:${inRange?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${inRange?'✅':'🔗'}</button>`;
    });
    html += `<span style="font-size:.6rem;color:var(--gray-500)">[${corrMin}–${corrMax}]</span></div>`;
  }

  // EFA fix buttons
  const efa = computeEFA();
  if (efa && efa.nFactors > 0) {
    const hasCross = efa.crossLoadings.length > 0;
    const hasLowComm = efa.communalities.some(c => c < 0.3);
    html += `<div style="display:flex;gap:.35rem;margin-top:.25rem;flex-wrap:wrap">
      <span style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-right:.25rem">🔬 EFA:</span>
      <button class="btn btn-sm" onclick="fixEFA_CrossLoading()" style="font-size:.6rem;padding:.15rem .35rem;background:${hasCross?'#dc2626':'#d1fae5'};color:${hasCross?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer">${hasCross?`🔄 Cross-load (${efa.crossLoadings.length})`:'✅ Cross-load'}</button>
      <button class="btn btn-sm" onclick="fixEFA_Communality()" style="font-size:.6rem;padding:.15rem .35rem;background:${hasLowComm?'#d97706':'#d1fae5'};color:${hasLowComm?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer">${hasLowComm?'📊 Communality':'✅ Communality'}</button>
    </div>`;
  }

  // Auto-fix all button
  html += `<div style="display:flex;gap:.35rem;margin-top:.35rem">
    <button class="btn btn-sm" onclick="_execAutoFixAll()" style="background:#059669;color:#fff;font-size:.7rem">✨ Tự động sửa tất cả</button>
  </div>`;

  html += `</div></div>`;
  content.insertAdjacentHTML('afterbegin', html);
}

// ====== EXECUTION WRAPPERS (snapshot + refresh) ======

function _execFix(constructKey) {
  _qualitySnapshot();
  fixConstructInternal(constructKey);
  _refreshQEditor();
}

function _execFixDV(dvKey) {
  _qualitySnapshot();
  fixDV_Rsquared(dvKey);
  _refreshQEditor();
}

function _execFixCorr(c1, c2) {
  _qualitySnapshot();
  fixIVCorrelation(c1, c2);
  _refreshQEditor();
}

function _execFixVIF() {
  _qualitySnapshot();
  fixVIF();
  _refreshQEditor();
}

function _execFixITC(constructKey) {
  _qualitySnapshot();
  fixItemTotalCorrelation(constructKey);
  _refreshQEditor();
}

function _execFixResidual(dvKey) {
  _qualitySnapshot();
  fixResidualNormality(dvKey);
  _refreshQEditor();
}

function _computeItemTotalCorr(constructKey) {
  if (!generatedData) return 1;
  const items = variables.filter(v => v.construct === constructKey);
  const itemNames = items.map(v => v.name);
  if (itemNames.length < 3) return 1;
  const rows = generatedData.rawRows;
  const n = rows.length;
  const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
  const valid = [];
  for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
  if (valid.length < 5) return 1;
  const m = valid.length;
  let minCorr = 1;
  for (let ii = 0; ii < itemNames.length; ii++) {
    const itemVals = valid.map(ri => scores[ii][ri]);
    const totalVals = valid.map(ri => itemNames.reduce((a, n, j) => a + (j===ii?0:(typeof rows[ri][n]==='number'?rows[ri][n]:0)), 0));
    const mi = itemVals.reduce((a,b)=>a+b,0)/m;
    const mt = totalVals.reduce((a,b)=>a+b,0)/m;
    const sdi = Math.sqrt(itemVals.reduce((a,b)=>a+(b-mi)**2,0)/m);
    const sdt = Math.sqrt(totalVals.reduce((a,b)=>a+(b-mt)**2,0)/m);
    if (sdi < 0.001 || sdt < 0.001) continue;
    const r = itemVals.reduce((a,b,i)=>a+(b-mi)*(totalVals[i]-mt),0)/m/(sdi*sdt);
    if (r < minCorr) minCorr = r;
  }
  return minCorr;
}

function _execAutoFixAll() {
  _qualitySnapshot();
  const constructKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  // Step 1: Item-total correlation + Internal quality (α + λ + AVE + KMO)
  constructKeys.forEach(k => {
    try { fixItemTotalCorrelation(k); } catch(e) {}
    try { fixConstructInternal(k); } catch(e) {}
  });
  // Step 2: EFA — cross-load + communality
  try { fixEFA_CrossLoading(); } catch(e) {}
  try { fixEFA_Communality(); } catch(e) {}
  // Step 3: DV R² + Residual normality
  constructKeys.filter(k => variables.find(v=>v.construct===k)?.role === 'dependent').forEach(dv => {
    try { fixDV_Rsquared(dv); } catch(e) {}
    try { fixResidualNormality(dv); } catch(e) {}
  });
  // Step 4: IV correlation + VIF
  try { fixVIF(); } catch(e) {}
  _refreshQEditor();
  showToast('✅ Đã tự động sửa tất cả chỉ số chất lượng', 'success');
}

// ====== HOOK INTO showQualityReport ======

const _origSQRT = showQualityReport;
showQualityReport = function(rawRows, constructs, n) {
  _origSQRT(rawRows, constructs, n);
  try { renderEFA(); } catch(e) { console.error('EFA render error:', e); }
  try { renderQualityEditor(); } catch(e) { console.error('QEditor render error:', e); }
  // Scroll to show the editor panel if it rendered
  setTimeout(() => {
    const panel = document.getElementById('quality-editor-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
  // Update badge to reflect editor availability
  const badge = document.getElementById('quality-badge');
  if (badge && !badge.textContent.includes('🔧')) {
    badge.textContent += ' · 🔧 Sửa được';
  }
};

// ====== SHOW EDITOR PANEL (called from header button) ======
function showEditorPanel() {
  let panel = document.getElementById('quality-editor-panel');
  if (!panel) {
    renderEFA();
    renderQualityEditor();
    panel = document.getElementById('quality-editor-panel');
  }
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Flash highlight
    panel.style.transition = 'box-shadow 0.3s';
    panel.style.boxShadow = '0 0 0 3px #7c3aed';
    setTimeout(() => { panel.style.boxShadow = ''; }, 1500);
  } else {
    // Fallback: open wizard modal
    openQualityWizard();
  }
}

// ====== STEP-BY-STEP WIZARD ======

function openQualityWizard() {
  const old = document.getElementById('wizard-modal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'wizard-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;justify-content:center;align-items:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const constructKeys = [];
  const constructMap = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructMap[v.construct]) {
        constructMap[v.construct] = { label: v.constructLabel || v.construct, role: v.role };
        constructKeys.push(v.construct);
      }
    }
  });

  const targetAlpha = parseFloat(document.getElementById('q-alpha')?.value) || 0.8;
  const targetLoading = parseFloat(document.getElementById('q-loading')?.value) || 0.6;
  const targetRSq = parseFloat(document.getElementById('q-rsq')?.value) || 0.5;

  // Compute metrics
  const allMetrics = {};
  constructKeys.forEach(k => { allMetrics[k] = _computeConstructMetrics(k); });

  // DV metrics
  const dvKeys = constructKeys.filter(k => constructMap[k].role === 'dependent');
  const dvMetrics = {};
  dvKeys.forEach(dv => { dvMetrics[dv] = _computeRegressionMetrics(dv); });

  const steps = [
    {
      icon: '📊', label: 'Nội tại (α + λ + AVE + KMO)',
      desc: `Cải thiện đồng loạt cho từng nhân tố. Mục tiêu: α≥${targetAlpha}, λ≥${targetLoading}, AVE≥0.3, KMO≥0.5`,
      constructs: constructKeys,
      action: (k) => { _qualitySnapshot(); fixConstructInternal(k); _refreshQEditor(); }
    },
    {
      icon: '🎯', label: 'R² hồi quy',
      desc: `Tăng R² cho biến phụ thuộc lên ≥ ${targetRSq}`,
      constructs: dvKeys,
      action: (k) => { _qualitySnapshot(); fixDV_Rsquared(k); _refreshQEditor(); }
    },
    {
      icon: '🔄', label: 'VIF (đa cộng tuyến)',
      desc: 'Giảm tương quan giữa các IV nếu VIF > 2',
      constructs: ['__all__'],
      action: () => { _qualitySnapshot(); fixVIF(); _refreshQEditor(); }
    }
  ];

  let stepHtml = '';
  steps.forEach((step, si) => {
    let details = '';
    if (step.constructs.length === 0 || (step.constructs.length === 1 && step.constructs[0] === '__all__')) {
      // Single button for VIF
      details += `<button class="btn btn-sm" onclick="this.disabled=true;this.textContent='⏳';setTimeout(()=>{_qualitySnapshot();fixVIF();_refreshQEditor();this.textContent='✅ Xong';this.style.background='#d1fae5';},50)" style="font-size:.65rem;padding:.15rem .4rem;background:#e5e7eb;color:#374151;border:none;border-radius:4px;cursor:pointer">Chạy</button>`;
    } else {
      step.constructs.forEach(k => {
        const c = constructMap[k];
        details += `<button class="btn btn-sm" onclick="this.disabled=true;this.textContent='⏳';setTimeout(()=>{${step.action.toString().replace(/\n/g,' ').replace(/'/g,"\\'").replace(/fixConstructInternal/g,'_qualitySnapshot();fixConstructInternal').replace(/fixDV_Rsquared/g,'_qualitySnapshot();fixDV_Rsquared').replace(/fixVIF/g,'_qualitySnapshot();fixVIF').replace(/_refreshQEditor\(\)/g,'_refreshQEditor();this.textContent=\'✅ Xong\';this.style.background=\'#d1fae5\'')}('${k}')})" style="font-size:.65rem;padding:.15rem .4rem;background:#e5e7eb;color:#374151;border:none;border-radius:4px;cursor:pointer;margin:2px">${c.label}</button>`;
      });
    }

    stepHtml += `<div style="margin-bottom:.5rem;padding:.5rem .65rem;background:#f9fafb;border-radius:8px;border:1px solid var(--gray-200)">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
        <span style="font-size:1.1rem">${step.icon}</span>
        <span style="font-weight:600;font-size:.85rem">${step.label}</span>
        <span style="font-size:.7rem;color:var(--gray-500)">${step.desc}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem">${details || '<span style="font-size:.7rem;color:var(--gray-400)">—</span>'}</div>
    </div>`;
  });

  overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:1.25rem;max-width:560px;width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
      <span style="font-size:1rem;font-weight:700;color:#7c3aed">🧙 Hướng dẫn từng bước</span>
      <button onclick="this.closest('#wizard-modal').remove()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--gray-400)">✕</button>
    </div>
    <div style="font-size:.75rem;color:var(--gray-500);margin-bottom:.75rem;line-height:1.5">
      <p style="margin:0 0 .35rem"><strong>Thứ tự tối ưu:</strong></p>
      <ol style="margin:0;padding-left:1.2rem">
        <li><strong>Nội tại</strong> — cải thiện α, λ, AVE, KMO đồng thời (quan trọng nhất)</li>
        <li><strong>R²</strong> — tăng khả năng giải thích của mô hình hồi quy</li>
        <li><strong>VIF</strong> — giảm đa cộng tuyến giữa các biến độc lập</li>
      </ol>
      <p style="margin:.35rem 0 0;color:#7c3aed;font-style:italic">💡 Bấm từng nút theo thứ tự, mỗi lần một nhân tố.</p>
    </div>
    ${stepHtml}
    <div style="display:flex;gap:.35rem;margin-top:.5rem">
      <button class="btn btn-sm" onclick="this.closest('#wizard-modal').remove();_execAutoFixAll()" style="background:#059669;color:#fff;font-size:.7rem">✨ Tự động toàn bộ</button>
      <button class="btn btn-sm btn-outline" onclick="if(_qualityUndoData)this.closest('#wizard-modal').remove();_qualityRestore()" style="font-size:.7rem">↩️ Undo</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

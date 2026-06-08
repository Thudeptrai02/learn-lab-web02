// ====== DATA GENERATION ======
function weightedRandom(values, weights) {
  if (!weights) return values[Math.floor(Math.random() * values.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    r -= weights[i];
    if (r <= 0) return values[i];
  }
  return values[values.length - 1];
}

function normalRandom(mean, std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function matInverse(m) {
  const n = m.length;
  if (n === 0) return null;
  const aug = m.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    if (maxRow !== col) { const t = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = t; }
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function matDeterminant(m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let det = 0;
  for (let j = 0; j < n; j++) {
    const sub = Array(n - 1).fill(0).map(() => Array(n - 1).fill(0));
    for (let row = 1; row < n; row++) {
      let c2 = 0;
      for (let col = 0; col < n; col++) { if (col === j) continue; sub[row - 1][c2++] = m[row][col]; }
    }
    det += m[0][j] * (j % 2 === 0 ? 1 : -1) * matDeterminant(sub);
  }
  return det;
}

function largestEigenvalue(m) {
  const n = m.length;
  let v = Array(n).fill(1);
  for (let iter = 0; iter < 100; iter++) {
    const w = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[i] += m[i][j] * v[j];
    const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0));
    if (norm < 1e-15) return 0;
    v = w.map(x => x / norm);
  }
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += m[i][j] * v[j]; num += v[i] * s; den += v[i] * v[i]; }
  return den > 0 ? num / den : 0;
}

function firstPC(m) {
  const n = m.length;
  let v0 = Array(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 100; iter++) {
    const w = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) w[i] += m[i][j] * v0[j];
    const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0));
    if (norm < 1e-15) return { eigval: 0, vector: Array(n).fill(0) };
    v0 = w.map(x => x / norm);
  }
  let eigval = 0; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += m[i][j] * v0[i]; eigval += v0[i] * s; }
  const loadings = v0.map(x => x * Math.sqrt(Math.max(0, eigval)));
  return { eigval, vector: v0, loadings };
}

function corrMatrixFromData(data, colNames) {
  const k = colNames.length;
  const m = data.length;
  const means = colNames.map(c => data.reduce((a, r) => a + (r[c] || 0), 0) / m);
  const stds = colNames.map((c, i) => { const d = data.reduce((a, r) => a + ((r[c] || 0) - means[i]) ** 2, 0) / m; return Math.sqrt(d); });
  const R = Array(k).fill(0).map(() => Array(k).fill(0));
  for (let i = 0; i < k; i++) { R[i][i] = 1;
    for (let j = i + 1; j < k; j++) {
      let cov = 0; for (let r = 0; r < m; r++) cov += ((data[r][colNames[i]] || 0) - means[i]) * ((data[r][colNames[j]] || 0) - means[j]);
      cov /= m; R[i][j] = R[j][i] = (stds[i] > 0 && stds[j] > 0) ? cov / (stds[i] * stds[j]) : 0; }
  } return R;
}

function skewness(vals) {
  const m = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / m;
  const var_ = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / m;
  if (var_ <= 0) return 0;
  const sd = Math.sqrt(var_);
  const skew = vals.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / m;
  return skew;
}

function kurtosis(vals) {
  const m = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / m;
  const var_ = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / m;
  if (var_ <= 0) return -3;
  const sd = Math.sqrt(var_);
  const kurt = vals.reduce((a, b) => a + ((b - mean) / sd) ** 4, 0) / m - 3;
  return kurt;
}

function durbinWatson(residuals) {
  let num = 0, den = 0;
  for (let i = 1; i < residuals.length; i++) num += (residuals[i] - residuals[i - 1]) ** 2;
  for (let i = 0; i < residuals.length; i++) den += residuals[i] ** 2;
  return den > 0 ? num / den : 2;
}

function computeKMO(corrMat) {
  const k = corrMat.length;
  const inv = matInverse(corrMat);
  if (!inv) return 0;
  let sumR = 0, sumP = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      sumR += corrMat[i][j] ** 2;
      const p = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]);
      sumP += p * p;
    }
  }
  return sumR + sumP > 0 ? sumR / (sumR + sumP) : 0;
}

function bartlettTest(corrMat, n) {
  const k = corrMat.length;
  const det = matDeterminant(corrMat);
  if (det <= 0) return { chiSq: 0, df: k * (k - 1) / 2, p: 1 };
  const chiSq = -((n - 1) - (2 * k + 5) / 6) * Math.log(det);
  const df = k * (k - 1) / 2;
  let p = 1;
  if (chiSq > 0 && df > 0) {
    const z = (Math.pow(chiSq / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
    p = 0.5 * (1 - erf(z / Math.SQRT2));
  }
  return { chiSq, df, p };
}

function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function randomUniform() { return Math.random(); }

function generateValue(v) {
  switch (v.type) {
    case 'likert5':
    case 'likert7': {
      const val = Math.floor(Math.random() * v.scale) + 1;
      return { raw: val, label: v.labels ? v.labels[val - 1] : String(val) };
    }
    case 'demographic': {
      const values = v.customValues || ['Giá trị 1', 'Giá trị 2'];
      const idx = v.weights ? weightedRandom(values.map((_, i) => i), v.weights) : Math.floor(Math.random() * values.length);
      return { raw: idx + 1, label: values[idx] || '' };
    }
    case 'continuous': {
      let val;
      if (v.dist === 'normal') { val = normalRandom(v.mean, v.std); }
      else { val = v.min + Math.random() * (v.max - v.min); }
      val = Math.round(val * Math.pow(10, v.decimals)) / Math.pow(10, v.decimals);
      return { raw: val, label: String(val) };
    }
    case 'binary': {
      const val = Math.random() < v.prob ? 1 : 0;
      return { raw: val, label: v.labels ? v.labels[val] : String(val) };
    }
    case 'custom': {
      const val = weightedRandom(v.values, v.weights);
      return { raw: val, label: '' };
    }
    default:
      return { raw: null, label: '' };
  }
}

// ====== SMART GENERATE ======
function smartGenerate() {
  _changedCells = {};
  if (typeof setupRealism === 'function') setupRealism();
  const n = parseInt(document.getElementById('sample-size').value) || 200;
  const missingPct = parseFloat(document.getElementById('missing-pct').value) || 0;
  const qAlpha = parseFloat(document.getElementById('q-alpha').value) || 0.8;
  const qLoading = parseFloat(document.getElementById('q-loading').value) || 0.6;
  const qRsq = parseFloat(document.getElementById('q-rsq').value) || 0.5;
  const qCorrMin = parseFloat(document.getElementById('q-corr-min').value) || 0.3;
  const qCorrMax = parseFloat(document.getElementById('q-corr-max').value) || 0.6;
  if (variables.length === 0) { showToast('Chưa có biến nào — hãy thêm nhân tố vào mô hình', 'error'); return; }
  document.getElementById('gen-status').textContent = `🎯 Đang tạo dữ liệu thông minh...`;
  generateDataCore(n, missingPct, qAlpha, qLoading, qRsq, qCorrMin, qCorrMax);
}

function generateDataCore(n, missingPct, targetAlpha, minLoading, minRSq, corrMin, corrMax) {
  const colNames = variables.map(v => v.name);
  const constructs = {};
  const nonConstructVars = [];
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v);
    } else { nonConstructVars.push(v); }
  });
  const hasModel = Object.keys(constructs).length > 0;

  Object.keys(constructs).forEach(key => {
    const profile = RESEARCH_KNOWLEDGE && RESEARCH_KNOWLEDGE.getDistributionProfile(key);
    constructs[key].forEach((v, idx) => {
      if (!v.loading || v.loading < 0.5) {
        v.loading = generateRealisticLoading(constructs[key].length, idx);
      } else {
        v.loading = Math.min(0.90, Math.max(0.40, v.loading + (Math.random() - 0.5) * 0.08));
      }
      v._discrimination = 0.8 + Math.random() * 1.0;
      v._profile = profile;
    });
  });

  let latentScores = {};
  if (hasModel) {
    const constructInfo = {};
    Object.keys(constructs).forEach(key => {
      constructInfo[key] = { vars: constructs[key], role: constructs[key][0]?.role || '', avgLoading: constructs[key].reduce((a,v) => a+(v.loading||0.7),0)/constructs[key].length };
    });
    const orderedKeys = Object.keys(constructInfo).sort((a,b) => {
      const order = { independent:0, mediating:1, moderating:2, dependent:3, '':4 };
      return (order[constructInfo[a].role]||4) - (order[constructInfo[b].role]||4);
    });
    const ivKeys = orderedKeys.filter(k => constructInfo[k].role === 'independent');
    const modKeys = orderedKeys.filter(k => constructInfo[k].role === 'moderating');
    const depKeys = orderedKeys.filter(k => constructInfo[k].role === 'dependent');
    const medKeys = orderedKeys.filter(k => constructInfo[k].role === 'mediating');

    Object.keys(constructInfo).forEach(k => { latentScores[k] = []; });

    const weakIdx = ivKeys.length >= 3 ? Math.floor(Math.random() * ivKeys.length) : -1;

    // Determine realistic R² range for DV
    let rSquaredRange = [0.45, 0.65];
    const dvLabel = depKeys.length > 0 ? (constructInfo[depKeys[0]]?.vars?.[0]?.constructLabel || '') : '';
    const pattern = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.matchResearchPattern(dvLabel) : null;
    if (pattern) rSquaredRange = pattern.typicalR2;
    else if (depKeys.length > 0) {
      const dvName = depKeys[0];
      const profile = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.getDistributionProfile(dvName) : null;
      if (profile) {
        rSquaredRange = profile.skew < -0.3 ? [0.45, 0.70] : [0.35, 0.60];
      }
    }

    for (let i = 0; i < n; i++) {
      const row = {};
      const ivLoadings = ivKeys.map(() => 0.50 + Math.random() * 0.30);
      const commonF = normalRandom(0, 1);
      ivKeys.forEach((k, idx) => {
        const profile = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.getDistributionProfile(k) : null;
        let targetSkew = profile ? profile.skew : 0;
        targetSkew += (Math.random() - 0.5) * 0.2;
        const a = ivLoadings[idx];
        const e = skewedRandom(targetSkew * 0.3);
        const s = a * commonF + Math.sqrt(Math.max(0, 1 - a * a)) * e;
        row[k] = s;
      });
      modKeys.forEach(k => { row[k] = skewedRandom(0.1); });
      medKeys.forEach(k => {
        let score = 0, betaSum = 0, betaSumSq = 0;
        ivKeys.forEach(iv => {
          const es = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.getEffectSize(iv, k) : null;
          let beta_a;
          if (es) {
            const [lo, hi] = es.range;
            beta_a = lo + Math.random() * (hi - lo);
            if (Math.random() < 0.15 * _noiseLevel) beta_a *= 0.3;
          } else {
            beta_a = 0.10 + Math.random() * 0.25;
          }
          score += beta_a * (row[iv] || 0);
          betaSum += beta_a;
          betaSumSq += beta_a * beta_a;
        });
        const medVarScore = Math.max(0.01, (1 - 0.42) * betaSumSq + 0.42 * betaSum * betaSum);
        const medR2 = 0.30 + Math.random() * 0.20;
        const residualVar = medVarScore * (1 / Math.min(medR2, 0.90) - 1);
        row[k] = score + skewedRandom(0.2) * Math.sqrt(Math.max(0.05, residualVar));
      });
      depKeys.forEach(k => {
        const predictors = [...ivKeys, ...medKeys];
        const nPred = Math.min(predictors.length, 5);
        let score = 0, betaSum = 0, betaSumSq = 0;

        const dvName = k;
        predictors.slice(0, nPred).forEach((p, pidx) => {
          const es = RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.getEffectSize(p, dvName) : null;
          let beta;
          if (es) {
            const [lo, hi] = es.range;
            beta = lo + Math.random() * (hi - lo);
            if (Math.random() < 0.15 * _noiseLevel) beta *= 0.3;
          } else {
            if (weakIdx >= 0 && p === ivKeys[weakIdx]) { beta = 0.05 + Math.random() * 0.10; }
            else { beta = 0.10 + Math.random() * 0.35; }
          }
          score += beta * (row[p] || 0);
          betaSum += beta;
          betaSumSq += beta * beta;
        });
        if (ivKeys.length > 0 && modKeys.length > 0) {
          const modBeta = 0.05 + Math.random() * 0.15;
          const iv = ivKeys[Math.floor(Math.random() * ivKeys.length)];
          const mo = modKeys[0];
          const interaction = (row[iv] || 0) * (row[mo] || 0) / 2;
          score += modBeta * interaction;
          betaSum += modBeta;
          betaSumSq += modBeta * modBeta * 0.5;
        }
        const avgPredCorr = 0.38;
        const varScore = Math.max(0.01, (1 - avgPredCorr) * betaSumSq + avgPredCorr * betaSum * betaSum);
        const targetR2 = rSquaredRange[0] + Math.random() * (rSquaredRange[1] - rSquaredRange[0]);
        const residualVar = varScore * (1 / Math.min(targetR2, 0.95) - 1);
        row[k] = score + skewedRandom((Math.random() - 0.5) * 0.3) * Math.sqrt(Math.max(0.05, residualVar));
      });
      orderedKeys.forEach(k => { latentScores[k].push(row[k] || 0); });
    }
  }

  const rawRows = [];
  const labelRows = [];

  for (let i = 0; i < n; i++) {
    const rawRow = {};
    const labelRow = {};

    Object.keys(constructs).forEach(key => {
      constructs[key].forEach(v => {
        const hasMissing = Math.random() * 100 < missingPct;
        if (hasMissing) { rawRow[v.name] = null; labelRow[v.name] = ''; return; }

        const loading = v.loading || Math.max(minLoading, 0.50);
        const latent = latentScores[key] ? latentScores[key][i] || 0 : skewedRandom(0);
        const err = skewedRandom((Math.random() - 0.5) * 0.2);
        const profile = v._profile || (RESEARCH_KNOWLEDGE ? RESEARCH_KNOWLEDGE.getDistributionProfile(key) : null);
        const shift = profile ? (profile.meanBias || 0) : (Math.random() - 0.5) * 0.1;
        const varScale = profile ? (profile.varianceScale || 1.0) : 1.0;
        const itemScore = loading * (latent + shift) + err * Math.sqrt(Math.max(0.01, 1 - loading * loading)) * varScale;
        const disc = v._discrimination || (1.0 + Math.random() * 0.3);
        let p = irtResponse(itemScore, disc, 0);
        if (profile) {
          p = applyCeilingFloor(p, profile.ceilingEffect || 0, profile.floorEffect || 0);
        }

        if (v.type === 'likert5' || v.type === 'likert7') {
          const scale = v.scale || 5;
          let val = Math.min(scale, Math.max(1, Math.round(p * (scale - 0.5) + 0.5)));
          val = addRealisticNoise(val, scale, _realismProfile, 1.0);
          rawRow[v.name] = val;
          labelRow[v.name] = v.labels ? v.labels[val - 1] : String(val);
        } else if (v.type === 'continuous') {
          let val = v.dist === 'normal' ? (v.mean + itemScore * v.std) : (v.min + p * (v.max - v.min));
          val = Math.round(val * Math.pow(10, v.decimals||2)) / Math.pow(10, v.decimals||2);
          val = Math.min(v.max, Math.max(v.min, val));
          rawRow[v.name] = val; labelRow[v.name] = String(val);
        } else if (v.type === 'binary') {
          const val = p > (1 - (v.prob||0.5)) ? 1 : 0;
          rawRow[v.name] = val; labelRow[v.name] = v.labels ? v.labels[val] : String(val);
        } else if (v.type === 'custom') {
          const idx2 = Math.min(v.values.length-1, Math.floor(p * v.values.length));
          rawRow[v.name] = v.values[Math.max(0, idx2)]; labelRow[v.name] = '';
        } else if (v.type === 'demographic') {
          const vals = v.customValues || ['A','B'];
          const wIdx = v.weights ? (() => {
            const total = v.weights.reduce((a,b)=>a+b,0);
            let r = Math.random() * total;
            for (let i=0; i<v.weights.length; i++) { r -= v.weights[i]; if (r <= 0) return i; }
            return vals.length-1;
          })() : Math.floor(Math.random() * vals.length);
          rawRow[v.name] = wIdx + 1;
          labelRow[v.name] = vals[wIdx] || String(wIdx + 1);
        } else { rawRow[v.name] = null; labelRow[v.name] = ''; }
      });
    });

    nonConstructVars.forEach(v => {
      const hasMissing = Math.random() * 100 < missingPct;
      if (hasMissing) { rawRow[v.name] = null; labelRow[v.name] = ''; return; }
      const result = generateValue(v);
      rawRow[v.name] = result.raw;
      labelRow[v.name] = result.label || String(result.raw);
    });

    rawRows.push(rawRow);
    labelRows.push(labelRow);
  }

  const outlierRespCount = Math.min(Math.floor(n * (0.02 + _noiseLevel * 0.04)), n);
  const outlierRespIndices = [];
  for (let o = 0; o < outlierRespCount; o++) {
    const ri = Math.floor(Math.random() * n);
    if (!outlierRespIndices.includes(ri)) outlierRespIndices.push(ri);
  }
  outlierRespIndices.forEach(ri => {
    const isExtreme = Math.random() < 0.5;
    if (isExtreme) {
      const extremeVal = Math.random() < 0.5 ? 1 : 7;
      colNames.forEach(col => {
        const scale = variables.find(v => v.name === col)?.scale || 5;
        const val = Math.min(scale, Math.max(1, extremeVal > 3 ? scale : 1));
        rawRows[ri][col] = val;
        if (variables.find(v => v.name === col)?.labels) {
          labelRows[ri][col] = variables.find(v => v.name === col).labels[val - 1] || String(val);
        }
      });
    } else {
      const constructKeysList = Object.keys(constructs);
      if (constructKeysList.length > 0) {
        const ck = constructKeysList[Math.floor(Math.random() * constructKeysList.length)];
        const items = constructs[ck].map(v => v.name);
        if (items.length >= 2) {
          const fixedVal = Math.random() < 0.4 ? 1 : (Math.random() < 0.5 ? 7 : 4);
          items.forEach(item => {
            const scale = variables.find(v => v.name === item)?.scale || 5;
            const val = Math.min(scale, Math.max(1, fixedVal));
            rawRows[ri][item] = val;
            if (variables.find(v => v.name === item)?.labels) {
              labelRows[ri][item] = variables.find(v => v.name === item).labels[val - 1] || String(val);
            }
          });
        }
      }
    }
  });

  // === REALISM ENGINE: Post-generation processing ===
  if (hasModel && _noiseLevel > 0.2) {
    const constructKeys = Object.keys(constructs);
    // Add cross-loadings for EFA realism
    addCrossLoadings(rawRows, constructs, constructKeys, n, _noiseLevel * 0.15);
    // Adjust communalities
    adjustCommunalities(rawRows, constructs, constructKeys, n);
    // Add heteroscedasticity
    addHeteroscedasticity(rawRows, colNames, n, _noiseLevel * 0.3);
  }

  generatedData = { rawRows, labelRows, colNames, colLabels: colNames, n };
  if (hasModel) {
    // Tối ưu dữ liệu theo mục tiêu TRƯỚC khi hiện báo cáo
    try { _autoFixAfterGenerate(); } catch(e) { console.error(e); }
  }
  updatePreview(rawRows, colNames);
  updateDownloadButtons();
  document.getElementById('gen-status').textContent = `🎯 Đã tạo ${n} dòng × ${variables.length} biến · ✅ Tối ưu`;
  showToast(`✅ Đã tạo ${n} dòng dữ liệu đạt mục tiêu`, 'success');
  if (hasModel) {
    showQualityReport(rawRows, constructs, n);
    renderModelStructure();
  }
  showImportData();
}

// ====== PREVIEW ======
function updatePreview(rows, colNames) {
  const wrap = document.getElementById('preview-table-wrap');
  const info = document.getElementById('preview-info');

  if (!rows || rows.length === 0 || !colNames || colNames.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><p>Hãy tạo dữ liệu để xem preview</p></div>';
    if (info) info.textContent = '0 dòng';
    return;
  }

  const maxRows = Math.min(rows.length, 50);
  const maxCols = Math.min(colNames.length, 20);

  let h = '<div style="overflow-x:auto"><table style="font-size:.75rem"><thead><tr style="background:#f3f4f6">';
  for (let ci = 0; ci < maxCols; ci++) {
    h += '<th style="padding:4px 8px;white-space:nowrap;border:1px solid #e5e7eb">' + colNames[ci] + '</th>';
  }
  h += '</tr></thead><tbody>';
  for (let ri = 0; ri < maxRows; ri++) {
    h += '<tr>';
    for (let ci = 0; ci < maxCols; ci++) {
      const val = rows[ri][colNames[ci]];
      h += '<td style="padding:3px 8px;border:1px solid #e5e7eb;text-align:center">' + (val === null || val === undefined ? '' : val) + '</td>';
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  h += '<div style="font-size:.75rem;color:#6b7280;margin-top:4px">Hiển thị ' + maxRows + ' dòng × ' + maxCols + ' cột (tổng ' + rows.length + ' dòng × ' + colNames.length + ' cột)</div>';
  wrap.innerHTML = h;
  if (info) info.textContent = rows.length + ' dòng';
}

// ====== DOWNLOAD ======
function updateDownloadButtons() {
  const btn = document.getElementById('btn-download');
  const btnCsv = document.getElementById('btn-csv');
  const enabled = generatedData !== null && generatedData.rawRows.length > 0;
  btn.disabled = !enabled;
  btnCsv.disabled = !enabled;
}

function downloadExcel() {
  if (!generatedData) { showToast('Chưa có dữ liệu để tải', 'error'); return; }
  const { rawRows, labelRows, colNames, colLabels } = generatedData;

  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = { label: v.constructLabel || v.construct, items: [] };
      constructs[v.construct].items.push(v.name);
    }
  });
  const constructKeys = Object.keys(constructs);
  const meanColNames = constructKeys.map(k => k + '_Mean');

  function addMeans(row) {
    const o = {};
    colNames.forEach(c => { o[c] = row[c] === null ? '' : row[c]; });
    constructKeys.forEach(k => {
      const items = constructs[k].items;
      let sum = 0, cnt = 0;
      items.forEach(n => { const v = row[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
      o[k + '_Mean'] = cnt > 0 ? +(sum / cnt).toFixed(3) : '';
    });
    return o;
  }

  const rawSheet = XLSX.utils.json_to_sheet(rawRows.map(addMeans));
  const labelSheet = XLSX.utils.json_to_sheet(labelRows.map(addMeans));

  const defRows = variables.map(v => ({
    'Tên biến': v.name, 'Nhãn': v.label || '', 'Loại': v.type,
    'Construct': v.construct || '', 'Nhãn Construct': v.constructLabel || '', 'Vai trò': v.role || '', 'Loading': v.loading || '',
    'Mã hóa': v.type === 'demographic' && v.customValues
      ? v.customValues.map((l, i) => `${i+1}=${l}`).join('; ')
      : v.labels ? v.labels.map((l, i) => `${i+1}=${l}`).join('; ') : '',
    'Tham số': JSON.stringify(v)
  }));
  const defSheet = XLSX.utils.json_to_sheet(defRows);

  const hasConstructs = variables.some(v => v.construct);
  let wb;
  if (hasConstructs) {
    const modelRows = Object.keys(constructs).map(key => ({
      'Construct': key, 'Nhãn': constructs[key].label, 'Vai trò': constructs[key].role,
      'Số biến quan sát': constructs[key].items.length, 'Các biến': constructs[key].items.join(', ')
    }));
    const modelSheet = XLSX.utils.json_to_sheet(modelRows);

    const meanHeader = { 'Construct': 'Construct', 'Nhãn': 'Nhãn', 'Mean': 'Mean', 'SD': 'SD', 'Số items': 'Số items', 'Các biến': 'Các biến' };
    const meanRows = Object.keys(constructs).map(key => {
      const items = constructs[key].items;
      const vals = rawRows.map(r => {
        let sum = 0, cnt = 0;
        items.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
        return cnt > 0 ? sum / cnt : null;
      }).filter(v => v !== null);
      const m = vals.length;
      const mean = vals.reduce((a, b) => a + b, 0) / m;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / m);
      return { 'Construct': key, 'Nhãn': constructs[key].label, 'Mean': mean.toFixed(3), 'SD': sd.toFixed(3), 'Số items': items.length, 'Các biến': items.join(', ') };
    });
    meanRows.unshift(meanHeader);
    const meanSheet = XLSX.utils.json_to_sheet(meanRows);

    let spssLines = ['* SPSS Syntax — Variable & Value Labels (copy-paste vào Syntax Editor).', '* Generated by Data Generator for SPSS.', ''];
    variables.forEach(v => {
      const name = v.name;
      const label = (v.label || name).replace(/"/g, "'");
      spssLines.push(`VARIABLE LABELS ${name} "${label}".`);
      if (v.type === 'demographic' && v.customValues) {
        const vals = v.customValues.map((l, i) => `${i+1} "${l.replace(/"/g,"'")}"`).join(' ');
        spssLines.push(`VALUE LABELS ${name} ${vals}.`);
      } else if (v.labels && v.labels.length > 0) {
        const vals = v.labels.map((l, i) => `${i+1} "${l.replace(/"/g,"'")}"`).join(' ');
        spssLines.push(`VALUE LABELS ${name} ${vals}.`);
      }
    });
    if (constructKeys.length > 0) {
      constructKeys.forEach(key => {
        const c = constructs[key];
        spssLines.push('');
        spssLines.push(`COMPUTE ${key}_Mean = MEAN(${c.items.join(',')}).`);
        spssLines.push(`VARIABLE LABELS ${key}_Mean "${c.label} (Mean)".`);
        spssLines.push(`EXECUTE.`);
      });
      spssLines.push('');
      spssLines.push('* Descriptive statistics for all variables.');
      spssLines.push('DESCRIPTIVES VARIABLES=ALL /STATISTICS=MEAN STDDEV MIN MAX.');
      spssLines.push('');
      const ivCons = constructKeys.filter(k => constructs[k].role === 'independent');
      const dvCons = constructKeys.filter(k => constructs[k].role === 'dependent');
      if (dvCons.length > 0) {
        const allCons = constructKeys.filter(k => constructs[k].role !== 'moderating');
        spssLines.push('* Regression: Enter method.');
        dvCons.forEach(dk => {
          const preds = allCons.filter(k => k !== dk);
          if (preds.length > 0) {
            spssLines.push(`REGRESSION /DESCRIPTIVES MEAN STDDEV CORR SIG N /STATISTICS COEFF R ANOVA COLLIN TOL /DEPENDENT ${dk}_Mean /METHOD=ENTER ${preds.map(p => p + '_Mean').join(' ')}.`);
          }
        });
      }
    }
    spssLines.push('');
    spssLines.push('* Note: Run EXECUTE. after pasting all labels before running analysis.');
    const spssSyntax = spssLines.join('\n');
    const spssSheet = XLSX.utils.aoa_to_sheet([[spssSyntax]]);
    spssSheet['!cols'] = [{ wch: 120 }];

    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, rawSheet, 'Raw Data');
    XLSX.utils.book_append_sheet(wb, labelSheet, 'Labeled Data');
    XLSX.utils.book_append_sheet(wb, defSheet, 'Variable Definitions');
    XLSX.utils.book_append_sheet(wb, modelSheet, 'Model');
    XLSX.utils.book_append_sheet(wb, meanSheet, 'Construct Means');
    XLSX.utils.book_append_sheet(wb, spssSheet, 'SPSS Syntax');
  } else {
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, rawSheet, 'Raw Data');
    XLSX.utils.book_append_sheet(wb, labelSheet, 'Labeled Data');
    XLSX.utils.book_append_sheet(wb, defSheet, 'Variable Definitions');
  }

  [rawSheet, labelSheet, defSheet].forEach(sheet => {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      let maxW = 10;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v !== undefined) { const w = String(cell.v).length; if (w > maxW) maxW = w; }
      }
      cols.push({ wch: Math.min(maxW + 2, 40) });
    }
    sheet['!cols'] = cols;
  });

  XLSX.writeFile(wb, `data_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Đã tải file Excel thành công!', 'success');
}

function downloadCSV() {
  if (!generatedData) { showToast('Chưa có dữ liệu để tải', 'error'); return; }
  const { rawRows, colNames } = generatedData;

  const constructs = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!constructs[v.construct]) constructs[v.construct] = [];
      constructs[v.construct].push(v.name);
    }
  });
  const constructKeys = Object.keys(constructs);
  const meanColNames = constructKeys.map(k => k + '_Mean');

  let csv = [...colNames, ...meanColNames].join(',') + '\n';
  rawRows.forEach(row => {
    const base = colNames.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    const means = constructKeys.map(k => {
      const items = constructs[k];
      let sum = 0, cnt = 0;
      items.forEach(n => { const v = row[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
      return cnt > 0 ? (sum / cnt).toFixed(3) : '';
    });
    csv += [...base, ...means].join(',') + '\n';
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `data_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Đã tải file CSV thành công!', 'success');
}

function resetAll() {
  if (variables.length === 0 && !generatedData) return;
  if (!confirm('Xóa tất cả biến và dữ liệu đã tạo?')) return;
  variables = [];
  generatedData = null;
  _regressionResults = null;
  _changedCells = {};
  renderModelStructure();
  updateDownloadButtons();
  updatePreview(null);
  document.getElementById('gen-status').textContent = 'Đã xóa tất cả';
}

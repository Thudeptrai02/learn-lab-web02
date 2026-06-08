// ====== F-distribution approximation (for ANOVA) ======
function computeFPValue(F, df1, df2) {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df1 * F / (df1 * F + df2);
  function logBeta(a, b) { return Math.log(Math.abs(lgamma(a))) + Math.log(Math.abs(lgamma(b))) - Math.log(Math.abs(lgamma(a+b))); }
  function lgamma(z) {
    if (z < 0.5) return lgamma(z+1) - Math.log(z);
    const g = 7; const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let s = c[0]; for (let i = 1; i < g+2; i++) s += c[i] / (z + i - 1);
    const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(t) - t + Math.log(s);
  }
  function incBeta(a, b, x) {
    if (x < 0 || x > 1) return 0;
    if (x === 0 || x === 1) return x === 0 ? 0 : 1;
    const bt = Math.exp(logBeta(a, b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * contFrac(a, b, x) / a;
    return 1 - bt * contFrac(b, a, 1 - x) / b;
  }
  function contFrac(a, b, x) {
    const eps = 1e-10; let qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < eps) d = eps; d = 1 / d;
    let result = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < eps) d = eps; c = 1 + aa / c; if (Math.abs(c) < eps) c = eps;
      d = 1 / d; result *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < eps) d = eps; c = 1 + aa / c; if (Math.abs(c) < eps) c = eps;
      d = 1 / d; const del = d * c; result *= del;
      if (Math.abs(del - 1) < eps) break;
    }
    return result;
  }
  const a = df1 / 2, b = df2 / 2;
  const p = 1 - incBeta(a, b, x);
  return Math.max(0, Math.min(1, p));
}

// ====== INDEPENDENT SAMPLE T-TEST ======
function independentTTest(group1, group2, label1, label2) {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = group1.reduce((a,b)=>a+b,0)/n1;
  const m2 = group2.reduce((a,b)=>a+b,0)/n2;
  const v1 = group1.reduce((a,b)=>a+(b-m1)**2,0)/(n1-1);
  const v2 = group2.reduce((a,b)=>a+(b-m2)**2,0)/(n2-1);
  const pooledVar = ((n1-1)*v1 + (n2-1)*v2) / (n1+n2-2);
  const seEqual = Math.sqrt(pooledVar * (1/n1 + 1/n2));
  const tEqual = seEqual > 0 ? (m1 - m2) / seEqual : 0;
  const dfEqual = n1 + n2 - 2;
  const seWelch = Math.sqrt(v1/n1 + v2/n2);
  const tWelch = seWelch > 0 ? (m1 - m2) / seWelch : 0;
  const dfWelchNum = Math.pow(v1/n1 + v2/n2, 2);
  const dfWelchDen = Math.pow(v1/n1, 2)/(n1-1) + Math.pow(v2/n2, 2)/(n2-1);
  const dfWelch = dfWelchDen > 0 ? dfWelchNum / dfWelchDen : dfEqual;
  const grandMean = (m1*n1 + m2*n2) / (n1+n2);
  const z1 = group1.map(v => Math.abs(v - m1));
  const z2 = group2.map(v => Math.abs(v - m2));
  const zm1 = z1.reduce((a,b)=>a+b,0)/n1;
  const zm2 = z2.reduce((a,b)=>a+b,0)/n2;
  const gz = [...z1, ...z2]; const gzm = gz.reduce((a,b)=>a+b,0)/(n1+n2);
  const ssb = n1*(zm1-gzm)**2 + n2*(zm2-gzm)**2;
  const ssw = z1.reduce((a,b)=>a+(b-zm1)**2,0) + z2.reduce((a,b)=>a+(b-zm2)**2,0);
  const fLevene = ssw > 0 ? ssb / ssw * (n1+n2-2) : 0;
  const leveneP = computeFPValue(fLevene, 1, n1+n2-2);
  const equalVarAssumed = leveneP >= 0.05;
  const useWelch = !equalVarAssumed;
  const tStat = useWelch ? tWelch : tEqual;
  const df = useWelch ? dfWelch : dfEqual;
  const pVal = tDistP(tStat, df);
  const cohensD = Math.sqrt(pooledVar) > 0 ? Math.abs(m1 - m2) / Math.sqrt(pooledVar) : 0;

  return {
    n1, n2, m1, m2, v1, v2,
    tStat, df, pVal,
    cohensD,
    equalVarAssumed,
    fLevene, leveneP,
    useWelch
  };
}

function tDistP(t, df) {
  if (df <= 0 || !isFinite(t)) return 1;
  const fVal = t * t;
  const pOneTail = 1 - computeFPValue(fVal, 1, df);
  return 2 * Math.min(pOneTail, 0.5);
}

// ====== QUALITY REPORT ======
function clr(val, gl, gh, yl, yh) {
  if (val >= gl && val <= gh) return '#10b981';
  if (val >= yl && val <= yh) return '#d97706';
  return '#ef4444';
}

function showQualityReport(rawRows, constructs, n) {
  const card = document.getElementById('quality-card');
  const content = document.getElementById('quality-content');
  card.style.display = 'block';

  const constructKeys = Object.keys(constructs);
  let html = '<div class="variables-list" style="gap:.5rem">';

  let allPass = true;
  let warnings = [];

  const roleColor = { independent: '#2563eb', dependent: '#dc2626', mediating: '#d97706', moderating: '#7c3aed' };
  const roleLabels = { independent: 'Độc lập', dependent: 'Phụ thuộc', mediating: 'Trung gian', moderating: 'Điều tiết' };

  const compStats = {};
  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    const vals = rawRows.map(r => {
      let s=0, c=0; items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){s+=v;c++;}});
      return c>0 ? s/c : null;
    }).filter(v=>v!==null);
    const m = vals.length;
    const mean = m>0 ? vals.reduce((a,b)=>a+b,0)/m : 0;
    const sd = m>1 ? Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/m) : 0;
    compStats[key] = { mean, sd, n: m };
  });

  let descHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
    <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📊 Thống kê mô tả thang đo (Composite)</span></div>
    <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.3rem .5rem">Nhân tố</td><td style="padding:.3rem .5rem">Vai trò</td>
        <td style="padding:.3rem .5rem;text-align:center">Số items</td><td style="padding:.3rem .5rem;text-align:center">N</td>
        <td style="padding:.3rem .5rem;text-align:center">Mean</td><td style="padding:.3rem .5rem;text-align:center">SD</td></tr>`;
  constructKeys.forEach((key, i) => {
    const role = constructs[key][0]?.role || '';
    const label = constructs[key][0]?.constructLabel || key;
    const k = constructs[key].length;
    const st = compStats[key];
    descHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
      <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
      <td style="padding:.2rem .5rem;color:${roleColor[role]||'#666'}">${roleLabels[role]||''}</td>
      <td style="padding:.2rem .5rem;text-align:center">${k}</td>
      <td style="padding:.2rem .5rem;text-align:center">${st.n}</td>
      <td style="padding:.2rem .5rem;text-align:center;font-weight:600;color:var(--primary)">${st.mean.toFixed(2)}</td>
      <td style="padding:.2rem .5rem;text-align:center">${st.sd.toFixed(3)}</td></tr>`;
  });
  descHtml += `</table></div></div>`;
  html += descHtml;

  if (constructKeys.length > 0) {
    let normHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
      <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📐 Đánh giá phân phối chuẩn — Skewness & Kurtosis</span>
      <span style="font-size:.7rem;color:var(--gray-500)">Skewness ∈ [±1.5]; Kurtosis ∈ [±3] (chuẩn) | ∈ [±2]; [±5] (tạm)</span></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
      <tr style="background:var(--gray-100);font-weight:600">
        <td style="padding:.3rem .5rem">Nhân tố</td>
        <td style="padding:.3rem .5rem;text-align:center">Items</td>
        <td style="padding:.3rem .5rem;text-align:center">Skewness TB</td>
        <td style="padding:.3rem .5rem;text-align:center">Kurtosis TB</td>
        <td style="padding:.3rem .5rem;text-align:center">Đánh giá</td></tr>`;
    constructKeys.forEach((key, i) => {
      const items = constructs[key].map(v => v.name);
      const itemSkew = items.map(name => {
        const vals = rawRows.map(r => r[name]).filter(v => typeof v === 'number' && !isNaN(v));
        return vals.length > 0 ? skewness(vals) : 0;
      });
      const itemKurt = items.map(name => {
        const vals = rawRows.map(r => r[name]).filter(v => typeof v === 'number' && !isNaN(v));
        return vals.length > 0 ? kurtosis(vals) : 0;
      });
      const avgSkew = itemSkew.reduce((a,b)=>a+b,0)/items.length;
      const avgKurt = itemKurt.reduce((a,b)=>a+b,0)/items.length;
      const passStrict = Math.abs(avgSkew) < 1.5 && Math.abs(avgKurt) < 3;
      const passModerate = Math.abs(avgSkew) < 2 && Math.abs(avgKurt) < 5;
      const label = constructs[key][0]?.constructLabel || key;
      const status = passStrict ? '✅ Chuẩn' : passModerate ? '⚠️ Tạm' : '❌ Không chuẩn';
      const color = passStrict ? '#10b981' : passModerate ? '#d97706' : '#ef4444';
      normHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}>
        <td style="padding:.2rem .5rem;font-weight:600">${label}</td>
        <td style="padding:.2rem .5rem;text-align:center">${items.length}</td>
        <td style="padding:.2rem .5rem;text-align:center;color:${Math.abs(avgSkew)<1.5?'#10b981':Math.abs(avgSkew)<2?'#d97706':'#ef4444'}">${avgSkew.toFixed(3)}</td>
        <td style="padding:.2rem .5rem;text-align:center;color:${Math.abs(avgKurt)<3?'#10b981':Math.abs(avgKurt)<5?'#d97706':'#ef4444'}">${avgKurt.toFixed(3)}</td>
        <td style="padding:.2rem .5rem;text-align:center;font-weight:600;color:${color}">${status}</td></tr>`;
    });
    normHtml += `</table></div></div>`;
    html += normHtml;
  }

  const demoColors = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
  const demoVars = variables.filter(v => v.type === 'demographic' && !v.construct);
  if (demoVars.length > 0) {
    let demoHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
      <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">👤 Thống kê nhân khẩu học</span></div>`;
    demoVars.forEach(dv => {
      const counts = {}; let total = 0;
      const demoLabels = dv.customValues || ['Giá trị 1', 'Giá trị 2'];
      rawRows.forEach(r => { const v = r[dv.name]; if (v != null) { counts[v] = (counts[v]||0)+1; total++; } });
      const keys = Object.keys(counts).map(k => parseInt(k)).filter(k => !isNaN(k)).sort((a,b) => a-b);
      demoHtml += `<div style="margin-top:.5rem;font-size:.8rem;font-weight:600">${dv.label} (${dv.name}) — Mã: ${demoLabels.map((l,i)=>`${i+1}=${l}`).join(', ')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:start;margin-top:.25rem">
        <div style="flex-shrink:0"><table style="font-size:.75rem;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Mã</td><td style="padding:.25rem .5rem">Nhóm</td><td style="padding:.25rem .5rem;text-align:center">N</td><td style="padding:.25rem .5rem;text-align:center">%</td></tr>`;
      keys.forEach((k, li) => {
        const c = counts[k]; const p = total>0 ? (c/total*100) : 0;
        const l = demoLabels[k-1] || `Nhóm ${k}`;
        demoHtml += `<tr><td style="padding:.15rem .5rem;border-bottom:1px solid var(--gray-100);text-align:center;font-weight:600">${k}</td>
          <td style="padding:.15rem .5rem;border-bottom:1px solid var(--gray-100)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${demoColors[li%demoColors.length]};margin-right:.35rem;vertical-align:middle"></span>${l}</td>
          <td style="padding:.15rem .5rem;text-align:center;border-bottom:1px solid var(--gray-100)">${c}</td>
          <td style="padding:.15rem .5rem;text-align:center;border-bottom:1px solid var(--gray-100)">${p.toFixed(1)}%</td></tr>`;
      });
      demoHtml += `</table></div>
        <div>${pieChartSVG(keys.map(k=>(demoLabels[k-1]||`Nhóm ${k}`)), keys.map(k=>counts[k]), total, 160, 120)}</div></div>`;
    });

    const twoGroupVars = demoVars.filter(dv => {
      const vals = new Set(); rawRows.forEach(r => { const v = r[dv.name]; if (v != null) vals.add(v); });
      return vals.size === 2;
    });
    if (twoGroupVars.length > 0 && constructKeys.length > 0) {
      demoHtml += `<div style="margin-top:.75rem;font-size:.75rem">
        <div style="font-weight:600;color:var(--gray-700);margin-bottom:.25rem">📊 Independent Sample t-test (so sánh trung bình theo nhóm)</div>`;
      twoGroupVars.forEach(dv => {
        const groups = {}; rawRows.forEach(r => { const v = r[dv.name]; if (v != null) { if (!groups[v]) groups[v]=[]; } });
        const grpLabels = Object.keys(groups).sort((a,b) => a-b);
        const grp1 = grpLabels[0], grp2 = grpLabels[1];
        const demoLabels = dv.customValues || [];
        const grp1Name = demoLabels[parseInt(grp1)-1] || `Nhóm ${grp1}`;
        const grp2Name = demoLabels[parseInt(grp2)-1] || `Nhóm ${grp2}`;
        constructKeys.forEach(ck => {
          const items = constructs[ck].map(v => v.name);
          const g1vals = [], g2vals = [];
          rawRows.forEach(r => {
            const g = r[dv.name];
            if (g == null) return;
            let sum=0,cnt=0;
            items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}});
            const cs = cnt>0 ? sum/cnt : null;
            if (cs === null) return;
            if (g === grp1) g1vals.push(cs);
            else if (g === grp2) g2vals.push(cs);
          });
          if (g1vals.length < 2 || g2vals.length < 2) return;
          const tt = independentTTest(g1vals, g2vals, grp1, grp2);
          if (!tt) return;
          const label = constructs[ck][0]?.constructLabel || ck;
          const effSizeStr = tt.cohensD >= 0.8 ? 'Lớn' : tt.cohensD >= 0.5 ? 'Trung bình' : tt.cohensD >= 0.2 ? 'Nhỏ' : 'Không đáng kể';
          demoHtml += `<div style="background:#fff;padding:.4rem .6rem;border-radius:6px;border:1px solid var(--gray-200);margin-top:.3rem">
            <div style="font-weight:600;color:var(--primary);margin-bottom:.2rem">${label} × ${dv.label}</div>
            <table style="width:100%;border-collapse:collapse;font-size:.7rem">
              <tr style="background:var(--gray-100)">
                <td style="padding:.15rem .4rem;font-weight:600">Nhóm</td><td style="padding:.15rem .4rem;text-align:center">N</td>
                <td style="padding:.15rem .4rem;text-align:center">TB</td><td style="padding:.15rem .4rem;text-align:center">ĐLC</td></tr>
              <tr><td style="padding:.1rem .4rem">${grp1} (${grp1Name})</td>
                <td style="padding:.1rem .4rem;text-align:center">${tt.n1}</td>
                <td style="padding:.1rem .4rem;text-align:center;font-weight:600">${tt.m1.toFixed(2)}</td>
                <td style="padding:.1rem .4rem;text-align:center">${Math.sqrt(tt.v1).toFixed(3)}</td></tr>
              <tr style="background:var(--gray-50)"><td style="padding:.1rem .4rem">${grp2} (${grp2Name})</td>
                <td style="padding:.1rem .4rem;text-align:center">${tt.n2}</td>
                <td style="padding:.1rem .4rem;text-align:center;font-weight:600">${tt.m2.toFixed(2)}</td>
                <td style="padding:.1rem .4rem;text-align:center">${Math.sqrt(tt.v2).toFixed(3)}</td></tr>
            </table>
            <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.2rem;font-size:.65rem">
              <span>Levene: F=${tt.fLevene.toFixed(3)} (p=${tt.leveneP.toFixed(4)}) → ${tt.equalVarAssumed?'Phương sai bằng nhau':'Phương sai khác nhau'}</span>
              <span style="font-weight:700">t(${tt.df.toFixed(1)}) = ${tt.tStat.toFixed(3)}</span>
              <span style="color:${tt.pVal<0.05?'#10b981':'#ef4444'};font-weight:600">p = ${tt.pVal.toFixed(4)}${tt.pVal<0.05?' ✅ (có ý nghĩa)':' (không ý nghĩa)'}</span>
              <span>Cohen's d = ${tt.cohensD.toFixed(3)} (${effSizeStr})</span>
            </div>
          </div>`;
        });
      });
      demoHtml += `</div>`;
    }
    demoHtml += `</div>`;
    html += demoHtml;
  }

  function pieChartSVG(labels, counts, total, w, h) {
    const cx = w*0.4, cy = h/2, r = Math.min(w*0.35, h*0.45);
    let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
    let a0 = -Math.PI/2;
    counts.forEach((c, i) => {
      const angle = (c/total)*2*Math.PI;
      const a1 = a0 + angle;
      const x1 = cx + r*Math.cos(a0), y1 = cy + r*Math.sin(a0);
      const x2 = cx + r*Math.cos(a1), y2 = cy + r*Math.sin(a1);
      const large = angle > Math.PI ? 1 : 0;
      if (c > 0) {
        svg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${demoColors[i%demoColors.length]}" stroke="#fff" stroke-width="1"/>`;
      }
      a0 = a1;
    });
    let ly = 10;
    labels.forEach((l, i) => {
      svg += `<rect x="${w*0.7}" y="${ly}" width="8" height="8" rx="1" fill="${demoColors[i%demoColors.length]}"/><text x="${w*0.7+12}" y="${ly+7}" font-size="7" fill="#374151">${l} (${((counts[i]/total)*100).toFixed(0)}%)</text>`;
      ly += 16;
    });
    svg += '</svg>';
    return svg;
  }

  constructKeys.forEach(key => {
    const items = constructs[key].map(v => v.name);
    const role = constructs[key][0]?.role || '';
    const label = constructs[key][0]?.constructLabel || key;

    const scoreMatrix = items.map(name => rawRows.map(r => {
      const v = r[name]; return (typeof v === 'number' && !isNaN(v)) ? v : null;
    }));
    const validRows = [];
    for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) validRows.push(i); }
    const m = validRows.length;
    if (m < 3) { html += `<div style="padding:.5rem;background:#fef2f2;border-radius:var(--radius);margin-bottom:.5rem"><strong>${label}</strong> — Không đủ dữ liệu</div>`; return; }

    const itemStats = items.map((name, idx) => {
      const vals = validRows.map(i => scoreMatrix[idx][i]);
      const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
      const var_ = vals.reduce((a,b) => a + (b-mean)**2, 0) / vals.length;
      return { name, mean, sd: Math.sqrt(var_) };
    });

    const k = items.length;
    const covM = [], corrM = [];
    for (let i = 0; i < k; i++) {
      covM[i] = []; corrM[i] = [];
      for (let j = 0; j < k; j++) {
        let cov = 0; validRows.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean)); cov /= m;
        covM[i][j] = cov;
        corrM[i][j] = itemStats[i].sd>0&&itemStats[j].sd>0 ? cov/(itemStats[i].sd*itemStats[j].sd) : 0;
      }
    }

    let sumCorr = 0, corrCount = 0;
    for (let i = 0; i < k; i++) for (let j = i+1; j < k; j++) { sumCorr += corrM[i][j]; corrCount++; }
    const avgCorr = corrCount > 0 ? sumCorr / corrCount : 0;

    let sumVar = 0, totalVar = 0;
    for (let i = 0; i < k; i++) sumVar += covM[i][i];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) totalVar += covM[i][j];
    const alpha = totalVar > 0 ? (k / (k - 1)) * (1 - sumVar / totalVar) : 0;

    const itemTotalCorr = items.map((name, idx) => {
      const itemScores = validRows.map(ri => scoreMatrix[idx][ri]);
      const totalScores = validRows.map(ri => items.reduce((a, n, j) => a + (j===idx?0:scoreMatrix[j][ri]||0), 0));
      const mI = itemScores.reduce((a,b)=>a+b,0)/m;
      const mT = totalScores.reduce((a,b)=>a+b,0)/m;
      const sdI = Math.sqrt(itemScores.reduce((a,b)=>a+(b-mI)**2,0)/m);
      const sdT = Math.sqrt(totalScores.reduce((a,b)=>a+(b-mT)**2,0)/m);
      const covIT = itemScores.reduce((a,b,i)=>a+(b-mI)*(totalScores[i]-mT),0)/m;
      return sdI>0&&sdT>0 ? covIT/(sdI*sdT) : 0;
    });

    const corrForKMO = items.map((_, i) => items.map((__, j) => corrM[i][j]));
    const pc = firstPC(corrForKMO);
    const itemLoading = pc.vector.map((_, i) => pc.loadings[i]);
    const avgLoading = itemLoading.reduce((a, b) => a + Math.abs(b), 0) / k;
    const ave = itemLoading.reduce((a, b) => a + b * b, 0) / k;

    const kmo = computeKMO(corrForKMO);
    const bartlett = bartlettTest(corrForKMO, m);
    const eig = pc.eigval;
    const tve = k > 0 ? Math.min(1, eig / k) : 0;

    const itemSkew = items.map((name, idx) => skewness(validRows.map(ri => scoreMatrix[idx][ri])));
    const itemKurt = items.map((name, idx) => kurtosis(validRows.map(ri => scoreMatrix[idx][ri])));

    const alphaSuspicious = alpha > 0.95;
    const bartlettSig = bartlett.p < 0.05;
    const eigTarget = eig > 1;

    if (clr(alpha, 0.80, 0.95, 0.60, 0.95) === '#ef4444') { allPass = false; warnings.push(`${label}: α=${alpha.toFixed(3)} < 0.6`); }
    if (kmo < 0.5) warnings.push(`${label}: KMO=${kmo.toFixed(3)} < 0.5`);

    html += `<div class="var-item" style="margin-bottom:.5rem">
      <div class="var-item-header">
        <div>
          <span class="var-item-name">${label}</span>
          <span style="font-size:.75rem;color:${roleColor[role]||'#666'};font-weight:600;margin-left:.5rem">${roleLabels[role]||''}</span>
          <span class="var-item-type" style="margin-left:.5rem">${k} items</span>
          ${alphaSuspicious ? '<span style="color:#dc2626;font-size:.7rem;margin-left:.5rem">⚠️ α > 0.95 (đáng nghi)</span>' : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin-top:.5rem">
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(alpha,0.80,0.95,0.60,0.95)}">${alpha.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">α Cronbach ≥ 0.6</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(avgCorr,0.30,0.80,0.20,0.88)}">${avgCorr.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">r̅ Inter-item [0.20;0.88]</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(avgLoading,0.50,0.95,0.50,0.95)}">${avgLoading.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">λ̅ Loading ≥ 0.5</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(ave,0.40,Infinity,0.30,Infinity)}">${ave.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">AVE ≥ 0.30</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(kmo,0.50,1.0,0.50,1.0)}">${kmo.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">KMO ≥ 0.5</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.1rem;font-weight:700;color:${bartlettSig?'#10b981':'#ef4444'}">${bartlett.chiSq.toFixed(1)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">Bartlett χ² ${bartlettSig?'p<0.05 ✅':'p≥0.05'}</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${eigTarget?'#10b981':'#ef4444'}">${eig.toFixed(3)}</div>
          <div style="font-size:.7rem;color:var(--gray-500)">Eigenvalue ${eigTarget?'>1 ✅':'<1'}</div>
        </div>
        <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:1.25rem;font-weight:700;color:${clr(tve,0.50,1.0,0.50,1.0)}">${(tve*100).toFixed(1)}%</div>
          <div style="font-size:.7rem;color:var(--gray-500)">TVE ≥ 50%</div>
        </div>
      </div>
      <div style="margin-top:.4rem;font-size:.75rem;border-top:1px solid var(--gray-100);padding-top:.35rem">`;

    html += `<div style="margin-bottom:.2rem"><strong>λ Factor Loading (≥ 0.5):</strong> `;
    items.forEach((name, idx) => {
      const l = itemLoading[idx];
      html += `<span style="margin-right:.6rem;color:${clr(l,0.50,0.95,0.50,0.95)}">${name}=${l.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div style="margin-bottom:.2rem"><strong>Corrected Item-Total r (≥ 0.3):</strong> `;
    items.forEach((name, idx) => {
      const r = itemTotalCorr[idx];
      html += `<span style="margin-right:.6rem;color:${clr(r,0.30,0.88,0.30,0.92)}">${name}=${r.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div style="margin-bottom:.2rem"><strong>Skewness [±1.5]; Kurtosis [±3]:</strong> `;
    items.forEach((name, idx) => {
      const s = itemSkew[idx];
      html += `<span style="margin-right:.6rem;color:${clr(Math.abs(s),0,1.5,0,3)}">Skew ${name}=${s.toFixed(3)}</span>`;
    });
    html += `| `;
    items.forEach((name, idx) => {
      const k2 = itemKurt[idx];
      html += `<span style="margin-right:.6rem;color:${clr(Math.abs(k2),0,3,0,5)}">Kurt ${name}=${k2.toFixed(3)}</span>`;
    });
    html += `</div>`;

    html += `<div><strong>Mean [2.8–4.5]; SD [0.5–1.5]:</strong> `;
    itemStats.forEach(s => {
      const mC = clr(s.mean, 2.8, 4.5, 2.5, 4.8);
      const sdC = clr(s.sd, 0.5, 1.5, 0.3, 1.8);
      html += `<span style="margin-right:.6rem">${s.name}: M=${s.mean.toFixed(2)} <span style="color:${mC}">●</span> SD=${s.sd.toFixed(3)} <span style="color:${sdC}">●</span></span>`;
    });
    html += `</div>`;

    html += `</div></div>`;
  });

  const allItemNames = [];
  constructKeys.forEach(k => {
    constructs[k].forEach(v => {
      if (v.type === 'likert5' || v.type === 'likert7') allItemNames.push(v.name);
    });
  });
  if (allItemNames.length >= 3) {
    const validRows = [];
    for (let i = 0; i < n; i++) {
      if (allItemNames.every(name => typeof rawRows[i][name] === 'number' && !isNaN(rawRows[i][name]))) validRows.push(i);
    }
    const m = validRows.length;
    if (m >= 30) {
      const k2 = allItemNames.length;
      const R = corrMatrixFromData(validRows.map(ri => { const o = {}; allItemNames.forEach(n => { o[n] = rawRows[ri][n]; }); return o; }), allItemNames);
      const pca = firstPC(R);
      const tve = pca.eigval / k2;
      const cmbPass = tve < 0.50;
      html += `<div class="var-item" style="margin-bottom:.5rem;background:${cmbPass?'#f0fdf4':'#fef2f2'};border-color:${cmbPass?'#86efac':'#fca5a5'}">
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">🧪 Common Method Bias — Harman Single-Factor Test</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem">
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${pca.eigval > 1 ? '#10b981' : '#ef4444'}">${pca.eigval.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Eigenvalue (PC1)</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${cmbPass?'#10b981':'#ef4444'}">${(tve*100).toFixed(1)}%</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Phương sai trích PC1 ${cmbPass?'< 50% ✅':'≥ 50% ⚠️'}</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${k2}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Tổng số items</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${m}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Số quan sát</div>
          </div>
        </div>
        <div style="margin-top:.35rem;font-size:.75rem;color:${cmbPass?'#166534':'#991b1b'};font-weight:500;text-align:center">
          ${cmbPass ? '✅ Không có Common Method Bias — phương sai trích PC1 < 50%.' : '⚠️ Có thể tồn tại Common Method Bias — phương sai trích PC1 ≥ 50%. Cần kiểm tra thêm.'}
        </div>
      </div>`;
    }
  }

  const nonDemoKeys = constructKeys.filter(k => constructs[k][0]?.role !== 'moderating');
  if (nonDemoKeys.length > 1) {
    const compScores = {};
    nonDemoKeys.forEach(k => {
      const its = constructs[k].map(v => v.name);
      compScores[k] = rawRows.map(r => {
        let sum = 0, cnt = 0;
        its.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
        return cnt > 0 ? sum / cnt : null;
      });
    });
    const valid = [];
    for (let i = 0; i < n; i++) { if (nonDemoKeys.every(k => compScores[k][i] !== null)) valid.push(i); }
    const m = valid.length;
    if (m > 3) {
      const R = corrMatrixFromData(valid.map(ri => { const o = {}; nonDemoKeys.forEach(k => { o[k] = compScores[k][ri]; }); return o; }), nonDemoKeys);
      html += `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
        <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">📊 Ma trận tương quan giữa các nhân tố (Mean-based Pearson)</span></div>
        <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td>${nonDemoKeys.map(k => `<td style="padding:.3rem .5rem;text-align:center">${k}</td>`).join('')}<td style="padding:.3rem .5rem;text-align:center">Mean</td><td style="padding:.3rem .5rem;text-align:center">SD</td></tr>`;
      const means = nonDemoKeys.map(k => compScores[k].reduce((a, v) => a + v, 0) / m);
      const sds = nonDemoKeys.map((k, i) => Math.sqrt(compScores[k].reduce((a, v) => a + (v - means[i]) ** 2, 0) / m));
      nonDemoKeys.forEach((ki, i) => {
        html += `<tr${i%2===1?' style="background:var(--gray-50)"':''}><td style="padding:.3rem .5rem;font-weight:600">${ki}</td>`;
        nonDemoKeys.forEach((kj, j) => {
          const r = R[i][j];
          const sig = m > 2 ? (Math.abs(r) * Math.sqrt(m - 2) / Math.sqrt(1 - r * r)) : 0;
          const pVal = 2 * (1 - 0.5 * (1 + erf(Math.abs(sig) / Math.SQRT2)));
          const pPass = pVal < 0.05;
          html += `<td style="padding:.3rem .5rem;text-align:center;color:${clr(Math.abs(r),0.25,0.85,0.15,0.92)}">${r.toFixed(3)}${pPass?'*':''}</td>`;
        });
        html += `<td style="padding:.3rem .5rem;text-align:center">${means[i].toFixed(2)}</td>`;
        html += `<td style="padding:.3rem .5rem;text-align:center">${sds[i].toFixed(3)}</td></tr>`;
      });
      html += `<tr style="font-size:.65rem;color:var(--gray-400)"><td></td>${nonDemoKeys.map(() => '<td style="text-align:center">* p<.05</td>').join('')}<td></td><td></td></tr>`;
      html += `</table></div></div>`;

      if (nonDemoKeys.length > 1) {
        const sqrtAve = {};
        nonDemoKeys.forEach(k => {
          const its = constructs[k].map(v => v.name);
          const scoreMatrix = its.map(name => rawRows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
          const validRows = [];
          for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) validRows.push(i); }
          const m = validRows.length;
          if (m < 3) { sqrtAve[k] = 0; return; }
          const itemStats = its.map((name, idx) => {
            const vals = validRows.map(i => scoreMatrix[idx][i]);
            const mean = vals.reduce((a,b)=>a+b,0)/m;
            return { name, mean };
          });
          const corrM = [];
          for (let i = 0; i < its.length; i++) {
            corrM[i]=[];
            for (let j = 0; j < its.length; j++) {
              let cov = 0;
              validRows.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean));
              cov /= m;
              const sdi = Math.sqrt(scoreMatrix[i].reduce((a,b,ri2)=>a+(b-itemStats[i].mean)**2,0)/m);
              const sdj = Math.sqrt(scoreMatrix[j].reduce((a,b,ri2)=>a+(b-itemStats[j].mean)**2,0)/m);
              corrM[i][j] = sdi>0&&sdj>0 ? cov/(sdi*sdj) : 0;
            }
          }
          const pc = firstPC(corrM);
          const loadings = pc.loadings;
          const ave = loadings.reduce((a,b)=>a+b*b,0)/its.length;
          sqrtAve[k] = Math.sqrt(Math.max(0, ave));
        });
        let flHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
          <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔷 Fornell-Larcker — Phân biệt giữa các nhân tố</span>
          <span style="font-size:.7rem;color:var(--gray-500)">(Chéo: tương quan; Chéo đậm: √AVE > tương quan → đạt)</span></div>
          <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Nhân tố</td>${nonDemoKeys.map(k => `<td style="padding:.3rem .5rem;text-align:center">${k}</td>`).join('')}</tr>`;
        nonDemoKeys.forEach((ki, i) => {
          flHtml += `<tr${i%2===1?' style="background:var(--gray-50)"':''}><td style="padding:.3rem .5rem;font-weight:600">${ki}</td>`;
          nonDemoKeys.forEach((kj, j) => {
            if (i === j) {
              const val = sqrtAve[ki] || 0;
              const pass = val > Math.max(...nonDemoKeys.map((k2, k2i) => k2i !== i ? Math.abs(R[i][k2i]) : 0));
              flHtml += `<td style="padding:.3rem .5rem;text-align:center;font-weight:700;background:${pass?'#d1fae5':'#fef3c7'};color:${pass?'#065f46':'#92400e'}">${val.toFixed(3)}</td>`;
            } else {
              const r = R[i][j];
              flHtml += `<td style="padding:.3rem .5rem;text-align:center;color:${Math.abs(r) > (sqrtAve[ki]||0) ? '#ef4444' : '#6b7280'}">${r.toFixed(3)}</td>`;
            }
          });
          flHtml += `</tr>`;
        });
        flHtml += `</table></div></div>`;
        html += flHtml;
      }

      if (nonDemoKeys.length > 1) {
        const htmtMatrix = Array.from({length:nonDemoKeys.length}, () => Array(nonDemoKeys.length).fill(0));
        for (let a = 0; a < nonDemoKeys.length; a++) {
          for (let b = a+1; b < nonDemoKeys.length; b++) {
            const ka = nonDemoKeys[a], kb = nonDemoKeys[b];
            const itemsA = constructs[ka].map(v => v.name);
            const itemsB = constructs[kb].map(v => v.name);
            const validRows = [];
            for (let i = 0; i < n; i++) {
              let ok = true;
              itemsA.forEach(n => { if (rawRows[i][n] == null || isNaN(rawRows[i][n])) ok = false; });
              itemsB.forEach(n => { if (rawRows[i][n] == null || isNaN(rawRows[i][n])) ok = false; });
              if (ok) validRows.push(i);
            }
            if (validRows.length < 10) continue;
            const m = validRows.length;
            let sumMonoA = 0, monoCountA = 0;
            for (let i = 0; i < itemsA.length; i++) {
              for (let j = i+1; j < itemsA.length; j++) {
                let cov = 0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsA[i]]; m2 += rawRows[ri][itemsA[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsA[i]]-m1, d2=rawRows[ri][itemsA[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumMonoA += r; monoCountA++;
              }
            }
            let sumMonoB = 0, monoCountB = 0;
            for (let i = 0; i < itemsB.length; i++) {
              for (let j = i+1; j < itemsB.length; j++) {
                let cov=0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsB[i]]; m2 += rawRows[ri][itemsB[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsB[i]]-m1, d2=rawRows[ri][itemsB[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumMonoB += r; monoCountB++;
              }
            }
            const avgMonoA = monoCountA > 0 ? sumMonoA/monoCountA : 0;
            const avgMonoB = monoCountB > 0 ? sumMonoB/monoCountB : 0;
            let sumHetero = 0, heteroCount = 0;
            for (let i = 0; i < itemsA.length; i++) {
              for (let j = 0; j < itemsB.length; j++) {
                let cov=0, s1=0, s2=0, m1=0, m2=0;
                validRows.forEach(ri => { m1 += rawRows[ri][itemsA[i]]; m2 += rawRows[ri][itemsB[j]]; });
                m1/=m; m2/=m;
                validRows.forEach(ri => { const d1=rawRows[ri][itemsA[i]]-m1, d2=rawRows[ri][itemsB[j]]-m2; cov+=d1*d2; s1+=d1*d1; s2+=d2*d2; });
                const r = Math.sqrt(s1*s2)>0 ? cov/Math.sqrt(s1*s2) : 0;
                sumHetero += r; heteroCount++;
              }
            }
            const avgHetero = heteroCount > 0 ? sumHetero/heteroCount : 0;
            const denominator = Math.sqrt(avgMonoA * avgMonoB);
            htmtMatrix[a][b] = htmtMatrix[b][a] = denominator > 0 ? avgHetero/denominator : 0;
          }
        }
        let htmtHtml = `<div class="var-item" style="margin-bottom:.5rem;background:#f8fafc">
          <div class="var-item-header"><span style="font-size:.85rem;font-weight:600">🔗 HTMT — Heterotrait-Monotrait Ratio</span>
          <span style="font-size:.7rem;color:var(--gray-500)">HTMT &lt; 0.85 (strict) hoặc &lt; 0.90 (mềm) → đạt phân biệt</span></div>
          <div style="overflow-x:auto;font-size:.75rem;margin-top:.35rem"><table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.3rem .5rem">Cặp nhân tố</td><td style="padding:.3rem .5rem;text-align:center">HTMT</td><td style="padding:.3rem .5rem;text-align:center">Đạt 0.85</td><td style="padding:.3rem .5rem;text-align:center">Đạt 0.90</td></tr>`;
        for (let a = 0; a < nonDemoKeys.length; a++) {
          for (let b = a+1; b < nonDemoKeys.length; b++) {
            const htmt = htmtMatrix[a][b];
            const pass85 = htmt < 0.85;
            const pass90 = htmt < 0.90;
            htmtHtml += `<tr${(a+b)%2===0?' style="background:var(--gray-50)"':''}>
              <td style="padding:.3rem .5rem;font-weight:600">${nonDemoKeys[a]} ↔ ${nonDemoKeys[b]}</td>
              <td style="padding:.3rem .5rem;text-align:center;font-weight:700;color:${pass85?'#10b981':pass90?'#d97706':'#ef4444'}">${htmt.toFixed(3)}</td>
              <td style="padding:.3rem .5rem;text-align:center;color:${pass85?'#10b981':'#ef4444'}">${pass85?'✅':'❌'}</td>
              <td style="padding:.3rem .5rem;text-align:center;color:${pass90?'#10b981':'#ef4444'}">${pass90?'✅':'❌'}</td></tr>`;
          }
        }
        htmtHtml += `</table></div></div>`;
        html += htmtHtml;
      }
    }
  }

  const dvConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'dependent');
  if (dvConstructs.length > 0) {
    dvConstructs.forEach(dvKey => {
      const ivConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'independent');
      const medConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'mediating');
      const modConstructs = constructKeys.filter(k => constructs[k][0]?.role === 'moderating');
      const predictors = [...ivConstructs, ...medConstructs, ...modConstructs];
      if (predictors.length === 0) return;

      const compScores = {};
      [...predictors, dvKey].forEach(k => {
        const its = constructs[k].map(v => v.name);
        compScores[k] = rawRows.map(r => {
          let sum = 0, cnt = 0;
          its.forEach(n => { const v = r[n]; if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; } });
          return cnt > 0 ? sum / cnt : null;
        });
      });

      const dv = compScores[dvKey];
      const valid = [];
      for (let i = 0; i < n; i++) {
        if (dv[i] !== null && predictors.every(p => compScores[p][i] !== null)) valid.push(i);
      }
      const m2 = valid.length;
      if (m2 <= predictors.length + 5) return;

      const y = valid.map(idx => dv[idx]);
      const yMean = y.reduce((a,b)=>a+b,0)/m2;
      const ySd = Math.sqrt(y.reduce((a,b)=>a+(b-yMean)**2,0)/m2);
      const xMean = predictors.map(p => valid.reduce((a,i)=>a+compScores[p][i],0)/m2);
      const xSd = predictors.map(p => Math.sqrt(valid.reduce((a,i)=>a+(compScores[p][i]-xMean[predictors.indexOf(p)])**2,0)/m2));
      const R = corrMatrixFromData(valid.map(i=>{const o={__dv__:dv[i]};predictors.forEach(p=>{o[p]=compScores[p][i];});return o;}),['__dv__',...predictors]);
      const rY = predictors.map((_,j)=>R[0][j+1]);
      const Rxx = predictors.map((_,i)=>predictors.map((_,j)=>R[i+1][j+1]));
      let RxxInv = matInverse(Rxx);
      if (!RxxInv) { const lam=1e-8*predictors.length; RxxInv=matInverse(Rxx.map((r,i)=>r.map((v,j)=>i===j?v+lam:v))); }
      let stdBeta=[], rSquared=0;
      if (RxxInv) { stdBeta=RxxInv.map(r=>r.reduce((a,v,j)=>a+v*rY[j],0)); rSquared=stdBeta.reduce((a,b,j)=>a+b*rY[j],0); }
      if (rSquared<0) rSquared=0; if (rSquared>1) rSquared=1;
      const rawBeta = [yMean - stdBeta.reduce((a,b,j)=>a+b*ySd*xMean[j]/(xSd[j]||1),0)];
      predictors.forEach((_,j)=>rawBeta.push(xSd[j]>0?stdBeta[j]*ySd/xSd[j]:0));
      const yHat = valid.map(i=>rawBeta[0]+predictors.reduce((a,p,j)=>a+rawBeta[j+1]*compScores[p][i],0));
      const residuals = valid.map((i,ri)=>dv[i]-yHat[ri]);
      const ssRes = residuals.reduce((a,r)=>a+r*r,0);
      const ssTot = y.reduce((a,yi)=>a+(yi-yMean)**2,0);
      if (rSquared<=0&&ssTot>0) rSquared=Math.max(0,1-ssRes/ssTot);
      const adjRSq = 1-(1-rSquared)*(m2-1)/(m2-predictors.length-1);
      const dw = durbinWatson(residuals);

      const mse = Math.max(ssRes/(m2-predictors.length-1),1e-10);
      const se = predictors.map((_,j)=>RxxInv?Math.sqrt(mse*RxxInv[j][j]/(m2-1)*ySd*ySd/(xSd[j]*xSd[j]||1)):1);
      const tStat = predictors.map((_,j)=>se[j]>0?rawBeta[j+1]/se[j]:0);
      const pValue = tStat.map(t=>{const z=Math.abs(t);return 2*(1-0.5*(1+erf(z/Math.SQRT2)));});

      const vif = predictors.map((_, j) => RxxInv ? RxxInv[j][j] : 10);
      const tolerance = vif.map(v => 1 / v);

      const ssReg = ssTot - ssRes;
      const dfReg = predictors.length;
      const dfRes = m2 - predictors.length - 1;
      const dfTot = m2 - 1;
      const msReg = ssReg / dfReg;
      const msRes = mse;
      const fStat = msRes > 0 ? msReg / msRes : 0;
      const fPValue = computeFPValue(fStat, dfReg, dfRes);

      _regressionResults = {
        dvKey: dvKey,
        rSquared: rSquared,
        adjRSq: adjRSq,
        fStat: fStat,
        fSig: fPValue,
        paths: {}
      };
      predictors.forEach((p, idx) => {
        _regressionResults.paths[p] = {
          stdBeta: stdBeta[idx],
          pValue: pValue[idx],
          sig: pValue[idx] < 0.05
        };
      });

      const adjDiff = Math.abs(rSquared - adjRSq);
      const rSqSuspicious = rSquared > 0.85;
      const fSigPass = fPValue < 0.05;

      html += `<div class="var-item" style="margin-bottom:.5rem;background:#f0fdf4;border-color:#86efac">
        <div style="font-size:.85rem;font-weight:600;margin-bottom:.25rem">
          📈 Hồi quy — ${constructs[dvKey][0]?.constructLabel || dvKey}
          ${rSqSuspicious ? '<span style="color:#dc2626;font-size:.7rem;margin-left:.5rem">⚠️ R² > 0.85 (đáng nghi)</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem;margin-bottom:.4rem">
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(rSquared,0.50,1.0,0.50,1.0)}">${rSquared.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">R² ≥ 0.50</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(adjDiff,0,0.05,0,0.08)}">${adjRSq.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">R²ₐdj (chênh ${adjDiff.toFixed(3)})</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:${clr(dw,1.5,2.5,1.3,2.7)}">${dw.toFixed(3)}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">DW [1.5;2.5]</div>
          </div>
          <div style="background:#fff;padding:.5rem;border-radius:6px;border:1px solid var(--gray-200);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--gray-700)">${m2}</div>
            <div style="font-size:.7rem;color:var(--gray-500)">Số quan sát</div>
          </div>
        </div>`;

      html += `<div style="margin-top:.4rem;font-size:.75rem"><strong>📋 ANOVA (F-test)</strong></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.2rem"><table style="width:100%;border-collapse:collapse">
        <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Nguồn</td>
        <td style="padding:.25rem .5rem;text-align:center">SS</td><td style="padding:.25rem .5rem;text-align:center">df</td>
        <td style="padding:.25rem .5rem;text-align:center">MS</td><td style="padding:.25rem .5rem;text-align:center">F</td>
        <td style="padding:.25rem .5rem;text-align:center">Sig.</td></tr>
        <tr><td style="padding:.2rem .5rem">Hồi quy</td>
          <td style="padding:.2rem .5rem;text-align:center">${ssReg.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfReg}</td>
          <td style="padding:.2rem .5rem;text-align:center">${msReg.toFixed(3)}</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:700">${fStat.toFixed(3)}</td>
          <td style="padding:.2rem .5rem;text-align:center;color:${fSigPass?'#10b981':'#ef4444'};font-weight:600">${fPValue.toFixed(4)}${fSigPass?' ✅':''}</td></tr>
        <tr style="background:var(--gray-50)"><td style="padding:.2rem .5rem">Phần dư</td>
          <td style="padding:.2rem .5rem;text-align:center">${ssRes.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfRes}</td>
          <td style="padding:.2rem .5rem;text-align:center">${msRes.toFixed(3)}</td><td></td><td></td></tr>
        <tr><td style="padding:.2rem .5rem;font-weight:600">Tổng</td>
          <td style="padding:.2rem .5rem;text-align:center;font-weight:600">${ssTot.toFixed(3)}</td><td style="padding:.2rem .5rem;text-align:center">${dfTot}</td><td></td><td></td><td></td></tr>
      </table></div>`;

      html += `<div style="margin-top:.4rem;font-size:.75rem"><strong>📊 Hệ số hồi quy</strong></div>
      <div style="overflow-x:auto;font-size:.75rem;margin-top:.2rem"><table style="width:100%;border-collapse:collapse">
        <tr style="background:var(--gray-100);font-weight:600"><td style="padding:.25rem .5rem">Predictor</td>
        <td style="padding:.25rem .5rem">β chuẩn</td><td style="padding:.25rem .5rem">β thô</td>
        <td style="padding:.25rem .5rem">t</td><td style="padding:.25rem .5rem">Sig.</td>
        <td style="padding:.25rem .5rem">VIF</td><td style="padding:.25rem .5rem">Tolerance</td></tr>`;
      predictors.forEach((p, idx) => {
        const sigPass = pValue[idx] < 0.05;
        const vifLikertWarn = vif[idx] > 2;
        if (!sigPass) { allPass = false; warnings.push(`${p}: Sig=${pValue[idx].toFixed(4)} > 0.05 (không ý nghĩa)`); }
        if (vifLikertWarn) warnings.push(`${p}: VIF=${vif[idx].toFixed(2)} > 2 (đa cộng tuyến với thang đo Likert)`);
        html += `<tr${idx%2===1?' style="background:var(--gray-50)"':''}>
          <td style="padding:.25rem .5rem;font-weight:600">${p}</td>
          <td style="padding:.25rem .5rem;color:${clr(Math.abs(stdBeta[idx]),0.10,0.65,0.05,0.75)}">${stdBeta[idx].toFixed(3)}</td>
          <td style="padding:.25rem .5rem">${(rawBeta[idx+1]||0).toFixed(4)}</td>
          <td style="padding:.25rem .5rem">${tStat[idx].toFixed(3)}</td>
          <td style="padding:.25rem .5rem;color:${clr(pValue[idx],-Infinity,0.05,-Infinity,0.10)}">${pValue[idx].toFixed(4)}${sigPass?' ✅':' ⚠️'}</td>
          <td style="padding:.25rem .5rem;color:${vifLikertWarn?'#d97706':clr(vif[idx],1.0,2.0,1.0,2.0)}">${vif[idx].toFixed(2)}${vifLikertWarn?' ⚠️':''}</td>
          <td style="padding:.25rem .5rem;color:${1/vif[idx]<0.10?'#ef4444':clr(1/vif[idx],0.20,1,0.10,1)}">${(1/vif[idx]).toFixed(3)}</td>
        </tr>`;
      });
      html += `</table></div>`;

      const nBins = Math.min(20, Math.max(8, Math.round(Math.sqrt(m2))));
      const minR = Math.min(...residuals);
      const maxR = Math.max(...residuals);
      const binW = (maxR - minR) / nBins || 0.01;
      const bins = Array(nBins).fill(0);
      residuals.forEach(r => { const bi = Math.min(nBins-1, Math.max(0, Math.floor((r - minR) / binW))); bins[bi]++; });
      const maxBin = Math.max(...bins, 1);
      const bh = 100, bw = 280;
      let histSvg = `<svg width="${bw}" height="${bh+30}" viewBox="0 0 ${bw} ${bh+30}" xmlns="http://www.w3.org/2000/svg">
        <text x="${bw/2}" y="${bh+20}" text-anchor="middle" font-size="8" fill="#6b7280">Phần dư (Residual)</text>
        <text x="2" y="${bh/2}" text-anchor="middle" font-size="7" fill="#6b7280" transform="rotate(-90,2,${bh/2})">TS</text>`;
      bins.forEach((c, i) => {
        const x = 30 + i * (bw-30) / nBins;
        const w = (bw-30) / nBins - 1;
        const h = (c / maxBin) * (bh-10);
        histSvg += `<rect x="${x}" y="${bh-10-h}" width="${Math.max(1,w)}" height="${h}" fill="#4f46e5" opacity="0.7" rx="1"/>`;
      });
      const zMin = -3, zMax = 3, zStep = 0.1;
      let curvePath = '';
      for (let z = zMin; z <= zMax; z += zStep) {
        const x = 30 + (z - zMin) / (zMax - zMin) * (bw-30);
        const y = bh-10 - (Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)) / 0.4 * (bh-10);
        curvePath += (z === zMin ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      histSvg += `<path d="${curvePath}" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,3"/>`;
      histSvg += `<line x1="30" y1="${bh-10}" x2="${bw}" y2="${bh-10}" stroke="#d1d5db" stroke-width="1"/></svg>`;

      const minP = Math.min(...yHat);
      const maxP = Math.max(...yHat);
      const pRange = maxP - minP || 1;
      const sResiduals = residuals.map(r => r / Math.sqrt(msRes));
      const sw = 280, sh = 200;
      let scatterSvg = `<svg width="${sw}" height="${sh+20}" viewBox="0 0 ${sw} ${sh+20}" xmlns="http://www.w3.org/2000/svg">
        <text x="${sw/2}" y="${sh+16}" text-anchor="middle" font-size="7" fill="#6b7280">Giá trị dự đoán (Predicted)</text>
        <text x="4" y="${sh/2}" text-anchor="middle" font-size="7" fill="#6b7280" transform="rotate(-90,4,${sh/2})">Phần dư</text>`;
      yHat.forEach((p, i) => {
        const px = 30 + (p - minP) / pRange * (sw - 35);
        const py = sh/2 - sResiduals[i] / 4 * sh/2;
        if (px >= 30 && px <= sw && py >= 5 && py <= sh-5) {
          scatterSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="#4f46e5" opacity="0.4"/>`;
        }
      });
      scatterSvg += `<line x1="30" y1="${sh/2}" x2="${sw}" y2="${sh/2}" stroke="#dc2626" stroke-width="1" stroke-dasharray="4,3"/></svg>`;

      html += `<div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.5rem;justify-content:center">
        <div style="background:#fff;padding:.5rem;border-radius:8px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-bottom:.25rem">📊 Histogram phần dư</div>${histSvg}</div>
        <div style="background:#fff;padding:.5rem;border-radius:8px;border:1px solid var(--gray-200);text-align:center">
          <div style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-bottom:.25rem">📉 Scatter plot (Predicted vs Residual)</div>${scatterSvg}</div>
      </div>`;

      html += `</div>`;

      if (medConstructs.length > 0 && ivConstructs.length > 0) {
        html += `<div class="var-item" style="margin-bottom:.5rem;background:#fefce8;border-color:#fbbf24">`;
        html += `<div style="font-size:.85rem;font-weight:600;margin-bottom:.4rem">🔗 Phân tích trung gian (Mediation) — DV: ${constructs[dvKey][0]?.constructLabel || dvKey}</div>`;
        const simpleReg = (xv, yv, label) => {
          const vv = [];
          for (let i = 0; i < n; i++) { if (xv[i] !== null && yv[i] !== null) vv.push(i); }
          const mv = vv.length;
          if (mv < 5) return null;
          const xs = vv.map(i => xv[i]), ys = vv.map(i => yv[i]);
          const mx = xs.reduce((a,b)=>a+b,0)/mv, my = ys.reduce((a,b)=>a+b,0)/mv;
          const sx2 = xs.reduce((a,v)=>a+(v-mx)**2,0), sy2 = ys.reduce((a,v)=>a+(v-my)**2,0);
          const sxy = xs.reduce((a,v,i)=>a+(v-mx)*(ys[i]-my),0);
          const b = sx2>0?sxy/sx2:0;
          const r = Math.sqrt(sx2*sy2)>0?sxy/Math.sqrt(sx2*sy2):0;
          const yh = xs.map(x=>b*(x-mx)+my);
          const ssr = ys.reduce((a,y,i)=>a+(y-yh[i])**2,0);
          const seB = Math.sqrt(ssr/(mv-2))/Math.sqrt(sx2)||1;
          const tVal = seB>0?b/seB:0;
          const z2 = Math.abs(tVal);
          const pV = 2*(1-0.5*(1+erf(z2/Math.SQRT2)));
          return {b,seB,stdBeta:r,t:tVal,p:pV,valid:mv,R2:r*r};
        };
        const medRows = [];
        medConstructs.forEach(mk => {
          const mLbl = constructs[mk][0]?.constructLabel || mk;
          ivConstructs.forEach(ivk => {
            const ivLbl = constructs[ivk][0]?.constructLabel || ivk;
            const aRes = simpleReg(compScores[ivk], compScores[mk], `a (${ivLbl}→${mLbl})`);
            if (!aRes) return;
            const bIdx = predictors.indexOf(mk);
            const bRes = bIdx>=0?{b:rawBeta[bIdx+1],seB:se[bIdx],stdBeta:stdBeta[bIdx],t:tStat[bIdx],p:pValue[bIdx]}:null;
            if (!bRes) return;
            const cPrimeIdx = predictors.indexOf(ivk);
            const cPrm = cPrimeIdx>=0?{b:rawBeta[cPrimeIdx+1],stdBeta:stdBeta[cPrimeIdx],p:pValue[cPrimeIdx]}:null;
            const cRes = simpleReg(compScores[ivk], compScores[dvKey], `c (${ivLbl}→DV)`);
            if (!cRes) return;
            const indirectAB = aRes.b * bRes.b;
            const seAB = Math.sqrt(bRes.b*bRes.b*aRes.seB*aRes.seB + aRes.b*aRes.b*bRes.seB*bRes.seB) || 1;
            const sobelZ = indirectAB / seAB;
            const sobelP = 2*(1-0.5*(1+erf(Math.abs(sobelZ)/Math.SQRT2)));
            const totalC = indirectAB + (cPrm?cPrm.b:0);
            const VAF = totalC!==0?Math.abs(indirectAB/totalC):0;
            medRows.push({ivLbl,mLbl,ivk,mk,aRes,bRes,cRes,cPrm,indirectAB,seAB,sobelZ,sobelP,VAF,totalC});
          });
        });
        if (medRows.length > 0) {
          html += `<div style="overflow-x:auto;font-size:.75rem"><table style="width:100%;border-collapse:collapse">`;
          html += `<tr style="background:var(--gray-100);font-weight:600">
            <td style="padding:.25rem .5rem">Đường dẫn</td>
            <td style="padding:.25rem .5rem;text-align:center">a (IV→Med)</td><td style="padding:.25rem .5rem;text-align:center">p(a)</td>
            <td style="padding:.25rem .5rem;text-align:center">b (Med→DV)</td><td style="padding:.25rem .5rem;text-align:center">p(b)</td>
            <td style="padding:.25rem .5rem;text-align:center">c' (trực tiếp)</td><td style="padding:.25rem .5rem;text-align:center">c (tổng)</td>
            <td style="padding:.25rem .5rem;text-align:center">a×b (gián tiếp)</td>
            <td style="padding:.25rem .5rem;text-align:center">Sobel Z</td><td style="padding:.25rem .5rem;text-align:center">Sobel p</td>
            <td style="padding:.25rem .5rem;text-align:center">VAF</td>
          </tr>`;
          let allMedOk = true;
          medRows.forEach(r => {
            const sigA = r.aRes.p < 0.05, sigB = r.bRes.p < 0.05;
            const sigSobel = r.sobelP < 0.05;
            const vafOk = r.VAF >= 0.20;
            if (!sigSobel) allMedOk = false;
            const pathLabel = `${r.ivLbl} → ${r.mLbl} → DV`;
            html += `<tr style="border-top:1px solid #e5e7eb">
              <td style="padding:.25rem .5rem;font-weight:600;white-space:nowrap">${pathLabel}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${sigA?'#059669':'#dc2626'}">${r.aRes.b.toFixed(3)} (${r.aRes.stdBeta.toFixed(3)})${sigA?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.aRes.p.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${sigB?'#059669':'#dc2626'}">${r.bRes.b.toFixed(3)} (${r.bRes.stdBeta.toFixed(3)})${sigB?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.bRes.p.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;color:${r.cPrm?.p<0.05?'#059669':'#dc2626'}">${r.cPrm?r.cPrm.b.toFixed(3)+' ('+r.cPrm.stdBeta.toFixed(3)+') '+(r.cPrm.p<0.05?'✅':'⚠️'):'—'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.cRes.b.toFixed(3)} (${r.cRes.stdBeta.toFixed(3)})</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:#7c3aed">${r.indirectAB.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:${sigSobel?'#059669':'#dc2626'}">${r.sobelZ.toFixed(3)}${sigSobel?' ✅':' ⚠️'}</td>
              <td style="padding:.25rem .5rem;text-align:center">${r.sobelP.toFixed(4)}</td>
              <td style="padding:.25rem .5rem;text-align:center;font-weight:700;color:${vafOk?'#059669':'#d97706'}">${(r.VAF*100).toFixed(1)}%${vafOk?' ✅':r.VAF>0?' ⚠️':' 🚫'}</td>
            </tr>`;
            if (!sigSobel) warnings.push(`${pathLabel}: Sobel p=${r.sobelP.toFixed(4)} > 0.05 (không có trung gian)`);
            if (!vafOk && r.VAF>0) warnings.push(`${pathLabel}: VAF=${(r.VAF*100).toFixed(1)}% < 20% (trung gian một phần yếu)`);
          });
          html += `</table></div>`;
          html += `<div style="margin-top:.4rem;font-size:.7rem;color:var(--gray-500)">
            <b>Hướng dẫn:</b> a (IV→Med) × b (Med→DV) = hiệu ứng gián tiếp. Sobel Z kiểm tra ý nghĩa gián tiếp.
            VAF = (a×b)/(c' + a×b): ≥80% = trung gian hoàn toàn; 20–80% = trung gian một phần; &lt;20% = không có trung gian.
            ${allMedOk?'✅ Tất cả đường dẫn trung gian có ý nghĩa.':'⚠️ Một số đường dẫn trung gian chưa có ý nghĩa thống kê.'}
          </div>`;
        }
        html += `</div>`;
      }
    });
  }

  const nWarn = warnings.length;
  const overall = nWarn === 0 ? '✅ Dữ liệu mô phỏng đạt chất lượng tốt — các chỉ tiêu trong khoảng lý tưởng'
    : `⚠️ ${nWarn} chỉ tiêu ở mức cảnh báo: ${warnings.slice(0,3).join('; ')}${warnings.length>3 ? `... (+${warnings.length-3})` : ''}. Kiểm tra các chỉ số màu vàng/đỏ.`;
  const bg = nWarn === 0 ? '#f0fdf4;color:#166534' : nWarn <= 2 ? '#fefce8;color:#92400e' : '#fef2f2;color:#991b1b';
  html += `<div style="padding:.5rem;border-radius:var(--radius);text-align:center;font-weight:600;font-size:.85rem;background:${bg}">${overall}</div>`;

  html += '</div>';
  content.innerHTML = html;

  const badge = document.getElementById('quality-badge');
  badge.textContent = `${constructKeys.length} nhân tố · ${warnings.length === 0 ? '✅ Đạt' : warnings.length + ' ⚠️'}`;
}

// ====== EXPORT REPORT ======
function exportReport() {
  const content = document.getElementById('quality-content');
  const title = 'BÁO CÁO KIỂM ĐỊNH CHẤT LƯỢNG DỮ LIỆU';
  const now = new Date().toLocaleString('vi-VN');
  const n = document.getElementById('sample-size').value || 200;
  const nVars = variables.length;
  const constructKeys = [...new Set(variables.filter(v => v.construct).map(v => v.construct))];
  const c3 = (v,gl,gh,yl,yh) => v>=gl&&v<=gh?'pass':v>=yl&&v<=yh?'warn':'fail';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 1.5cm; size: A4 portrait; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; color: #1f2937; line-height: 1.5; max-width: 210mm; margin: 0 auto; padding: 20px; }
  h1 { font-size: 16pt; text-align: center; color: #1e40af; margin-bottom: 4pt; }
  h2 { font-size: 13pt; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 4pt; margin-top: 18pt; }
  h3 { font-size: 11pt; color: #374151; margin: 10pt 0 4pt; }
  .meta { text-align: center; font-size: 9pt; color: #6b7280; margin-bottom: 14pt; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 9pt; }
  th, td { border: 1px solid #d1d5db; padding: 4pt 6pt; text-align: center; }
  th { background: #f3f4f6; font-weight: 600; }
  .pass { color: #059669; }
  .warn { color: #d97706; }
  .fail { color: #dc2626; }
  .section { margin-bottom: 10pt; page-break-inside: avoid; }
  .badge { display:inline-block; background:#e5e7eb; padding:1pt 6pt; border-radius:4pt; font-size:8pt; }
  .summary-box { background:#f0fdf4; border:1px solid #86efac; border-radius:6pt; padding:8pt 12pt; margin:8pt 0; font-size:10pt; }
  .warn-box { background:#fef2f2; border:1px solid #fca5a5; border-radius:6pt; padding:8pt 12pt; margin:8pt 0; font-size:10pt; }
  .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 20pt; border-top: 1px solid #e5e7eb; padding-top: 6pt; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
<h1>${title}</h1>
<div class="meta">Ngày: ${now} · Cỡ mẫu: ${n} · Tổng biến: ${nVars} · Nhân tố: ${constructKeys.length}</div>

<div class="section">
  <h2>1. Độ tin cậy Cronbach's Alpha</h2>
  <table><tr><th>Nhân tố</th><th>Vai trò</th><th>Số items</th><th>α</th>
  <th>r̅ Inter-item</th><th>λ̅ Loading</th><th>AVE</th><th>KMO</th><th>Eigenvalue</th><th>TVE</th></tr>
`;

  const cons = {};
  variables.forEach(v => {
    if (v.construct) {
      if (!cons[v.construct]) cons[v.construct] = [];
      cons[v.construct].push(v);
    }
  });

  const roleLabels = { independent:'Độc lập', dependent:'Phụ thuộc', mediating:'Trung gian', moderating:'Điều tiết' };
  const roleColors = { independent:'#2563eb', dependent:'#dc2626', mediating:'#d97706', moderating:'#7c3aed' };

  let rowsHtml = '';

  Object.keys(cons).forEach(key => {
    const items = cons[key];
    const role = items[0]?.role || '';
    const k = items.length;
    const itemNames = items.map(v => v.name);
    const rawRows2 = generatedData?.rawRows || [];

    const scoreMatrix = itemNames.map(name => rawRows2.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scoreMatrix.every(col => col[i] !== null)) valid.push(i); }
    const m = valid.length;
    if (m < 3) return;

    const itemStats = itemNames.map((name, idx) => {
      const vals = valid.map(i => scoreMatrix[idx][i]);
      const mean = vals.reduce((a,b)=>a+b,0)/m;
      const var_ = vals.reduce((a,b)=>a+(b-mean)**2,0)/m;
      return { name, mean, sd: Math.sqrt(var_) };
    });

    const covM = [], corrM = [];
    for (let i = 0; i < k; i++) {
      covM[i]=[]; corrM[i]=[];
      for (let j = 0; j < k; j++) {
        let cov = 0; valid.forEach(ri => cov += (scoreMatrix[i][ri]-itemStats[i].mean)*(scoreMatrix[j][ri]-itemStats[j].mean)); cov /= m;
        covM[i][j] = cov;
        corrM[i][j] = itemStats[i].sd>0&&itemStats[j].sd>0 ? cov/(itemStats[i].sd*itemStats[j].sd) : 0;
      }
    }

    let sumCorr=0, corrCount=0;
    for(let i=0;i<k;i++) for(let j=i+1;j<k;j++){sumCorr+=corrM[i][j];corrCount++;}
    const avgCorr = corrCount>0 ? sumCorr/corrCount : 0;

    let sumVar=0, totalVar=0;
    for(let i=0;i<k;i++) sumVar+=covM[i][i];
    for(let i=0;i<k;i++) for(let j=0;j<k;j++) totalVar+=covM[i][j];
    const alpha = totalVar>0 ? (k/(k-1))*(1-sumVar/totalVar) : 0;

    const corrForKMO = items.map((_,i)=>items.map((__,j)=>corrM[i][j]));
    const pc = firstPC(corrForKMO);
    const itemLoading = pc.loadings;
    const avgLoading = itemLoading.reduce((a, b) => a + Math.abs(b), 0) / k;
    const ave = itemLoading.reduce((a, b) => a + b * b, 0) / k;
    const kmo = computeKMO(corrForKMO);
    const eig = pc.eigval;
    const tve = k>0 ? Math.min(1, eig/k) : 0;

    const rc = roleColors[role]||'#666';
    rowsHtml += `<tr><td style="font-weight:600">${key}</td>
      <td><span style="color:${rc}">${roleLabels[role]||''}</span></td>
      <td>${k}</td>
      <td class="${c3(alpha,0.80,0.95,0.60,0.95)}">${alpha.toFixed(3)}</td>
      <td class="${c3(avgCorr,0.30,0.80,0.20,0.88)}">${avgCorr.toFixed(3)}</td>
      <td class="${c3(avgLoading,0.50,0.92,0.45,0.96)}">${avgLoading.toFixed(3)}</td>
      <td class="${c3(ave,0.40,Infinity,0.30,Infinity)}">${ave.toFixed(3)}</td>
      <td class="${c3(kmo,0.70,0.95,0.50,0.98)}">${kmo.toFixed(3)}</td>
      <td class="${eig>1?'pass':'fail'}">${eig.toFixed(3)}</td>
      <td class="${c3(tve,0.50,0.85,0.35,0.92)}">${(tve*100).toFixed(1)}%</td>
    </tr>`;

    rowsHtml += `<tr style="background:#f9fafb;font-size:8pt"><td colspan="10" style="text-align:left;padding:2pt 6pt">
      <strong>Items:</strong> ${itemNames.join(', ')} | `;
    itemNames.forEach((nm, idx) => {
      const l = itemLoading[idx];
      rowsHtml += `${nm}(λ=${l.toFixed(3)}, M=${itemStats[idx].mean.toFixed(2)}, SD=${itemStats[idx].sd.toFixed(3)}) `;
    });
    rowsHtml += `</td></tr>`;
  });

  const htmlWithRows = html + rowsHtml + `</table></div>`;

  const ivCons = Object.keys(cons).filter(k => cons[k][0]?.role === 'independent');
  const depCons = Object.keys(cons).filter(k => cons[k][0]?.role === 'dependent');
  let restHtml = '';
  if (depCons.length > 0) {
    restHtml += `<div class="section"><h2>2. Hồi quy & Kiểm định mô hình</h2>`;
    depCons.forEach(dvKey => {
      const predictors = [...ivCons];
      const medCon = Object.keys(cons).filter(k => cons[k][0]?.role === 'mediating');
      predictors.push(...medCon);
      if (predictors.length === 0) return;

      const compScores = {};
      [...predictors, dvKey].forEach(k => {
        const its = cons[k].map(v => v.name);
        compScores[k] = (generatedData?.rawRows||[]).map(r => {
          let sum=0,cnt=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}}); return cnt>0?sum/cnt:null;
        });
      });

      const dv = compScores[dvKey];
      const valid2 = [];
      for (let i = 0; i < n; i++) { if (dv[i] !== null && predictors.every(p => compScores[p][i] !== null)) valid2.push(i); }
      const m2 = valid2.length;
      if (m2 <= predictors.length + 5) return;

      const y = valid2.map(idx => dv[idx]);
      const yMean2 = y.reduce((a,b)=>a+b,0)/m2;
      const ySd2 = Math.sqrt(y.reduce((a,b)=>a+(b-yMean2)**2,0)/m2);
      const xMean2 = predictors.map(p => valid2.reduce((a,i)=>a+compScores[p][i],0)/m2);
      const xSd2 = predictors.map(p => Math.sqrt(valid2.reduce((a,i)=>a+(compScores[p][i]-xMean2[predictors.indexOf(p)])**2,0)/m2));

      const R2 = corrMatrixFromData(valid2.map(i=>{
        const o={__dv__:dv[i]}; predictors.forEach(p=>{o[p]=compScores[p][i];}); return o;
      }), ['__dv__',...predictors]);
      const rY2 = predictors.map((_,j)=>R2[0][j+1]);
      const Rxx2 = predictors.map((_,i)=>predictors.map((_,j)=>R2[i+1][j+1]));
      let Rxx2Inv = matInverse(Rxx2);
      if (!Rxx2Inv) { const lam=1e-8*predictors.length; Rxx2Inv=matInverse(Rxx2.map((r,i)=>r.map((v,j)=>i===j?v+lam:v))); }

      let stdBeta2=[], rSquared2=0;
      if (Rxx2Inv) {
        stdBeta2 = Rxx2Inv.map(r=>r.reduce((a,v,j)=>a+v*rY2[j],0));
        rSquared2 = stdBeta2.reduce((a,b,j)=>a+b*rY2[j],0);
      }
      if (rSquared2<0) rSquared2=0; if (rSquared2>1) rSquared2=1;

      const rawBeta2 = [yMean2 - stdBeta2.reduce((a,b,j)=>a+b*ySd2*xMean2[j]/(xSd2[j]||1),0)];
      predictors.forEach((_,j)=>rawBeta2.push(xSd2[j]>0?stdBeta2[j]*ySd2/xSd2[j]:0));

      const yHat2 = valid2.map(i=>rawBeta2[0]+predictors.reduce((a,p,j)=>a+rawBeta2[j+1]*compScores[p][i],0));
      const residuals2 = valid2.map((i,ri)=>dv[i]-yHat2[ri]);

      const ssRes2 = residuals2.reduce((a,r)=>a+r*r,0);
      const ssTot2 = y.reduce((a,yi)=>a+(yi-yMean2)**2,0);
      if (rSquared2<=0&&ssTot2>0) rSquared2=Math.max(0,1-ssRes2/ssTot2);
      const adjRSq2 = 1-(1-rSquared2)*(m2-1)/(m2-predictors.length-1);
      const dw2 = durbinWatson(residuals2);

      const mse2 = Math.max(ssRes2/(m2-predictors.length-1),1e-10);
      const se2 = predictors.map((_,j)=>Rxx2Inv?Math.sqrt(mse2*Rxx2Inv[j][j]/(m2-1)*ySd2*ySd2/(xSd2[j]*xSd2[j]||1)):1);
      const tStat2 = predictors.map((_,j)=>se2[j]>0?rawBeta2[j+1]/se2[j]:0);
      const pValue2 = tStat2.map(t=>{const z=Math.abs(t);return 2*(1-0.5*(1+erf(z/Math.SQRT2)));});
      const vif2 = predictors.map((_,j)=>Rxx2Inv?Rxx2Inv[j][j]:10);

      const ssReg2 = ssTot2 - ssRes2;
      const dfReg2 = predictors.length;
      const dfRes2 = m2 - predictors.length - 1;
      const dfTot2 = m2 - 1;
      const msReg2 = ssReg2 / dfReg2;
      const msRes2 = mse2;
      const fStat2 = msRes2 > 0 ? msReg2 / msRes2 : 0;
      const fPVal2 = computeFPValue(fStat2, dfReg2, dfRes2);
      const fSig2 = fPVal2 < 0.05;

      restHtml += `<h3>DV: ${dvKey}</h3>
      <table style="font-size:9pt"><tr><th>Chỉ tiêu</th><th>Giá trị</th><th>Đánh giá</th></tr>
      <tr><td>R²</td><td>${rSquared2.toFixed(3)}</td><td class="${c3(rSquared2,0.50,1.0,0.50,1.0)}">${rSquared2>=0.50?'Đạt':'Kém'}</td></tr>
      <tr><td>R² hiệu chỉnh</td><td>${adjRSq2.toFixed(3)}</td><td class="${c3(Math.abs(rSquared2-adjRSq2),0,0.05,0,0.08)}">Chênh ${Math.abs(rSquared2-adjRSq2).toFixed(3)}</td></tr>
      <tr><td>Durbin-Watson</td><td>${dw2.toFixed(3)}</td><td class="${c3(dw2,1.5,2.5,1.3,2.7)}">${dw2>=1.5&&dw2<=2.5?'Đạt':dw2>=1.3&&dw2<=2.7?'Chấp nhận':'Cần xem xét'}</td></tr>
      </table>`;

      restHtml += `<table style="font-size:8pt;margin-top:4pt">
        <tr><th>Nguồn</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>Sig.</th></tr>
        <tr><td>Hồi quy</td><td>${ssReg2.toFixed(3)}</td><td>${dfReg2}</td><td>${msReg2.toFixed(3)}</td>
          <td style="font-weight:700">${fStat2.toFixed(3)}</td>
          <td style="font-weight:600;color:${fSig2?'#059669':'#dc2626'}">${fPVal2.toFixed(4)}${fSig2?' ✅':''}</td></tr>
        <tr><td>Phần dư</td><td>${ssRes2.toFixed(3)}</td><td>${dfRes2}</td><td>${msRes2.toFixed(3)}</td><td></td><td></td></tr>
        <tr style="font-weight:600"><td>Tổng</td><td>${ssTot2.toFixed(3)}</td><td>${dfTot2}</td><td></td><td></td><td></td></tr>
      </table>
      <table style="font-size:8pt"><tr><th>Predictor</th><th>β chuẩn</th><th>β thô</th><th>t</th><th>Sig.</th><th>VIF</th><th>Tolerance</th></tr>`;
      predictors.forEach((p,idx) => {
        const sigP = pValue2[idx]<0.05;
        restHtml += `<tr><td style="font-weight:600">${p}</td>
          <td class="${c3(Math.abs(stdBeta2[idx]),0.1,0.65,0.05,0.75)}">${stdBeta2[idx].toFixed(3)}</td>
          <td>${(rawBeta2[idx+1]||0).toFixed(4)}</td>
          <td>${tStat2[idx].toFixed(3)}</td>
          <td class="${c3(pValue2[idx],-Infinity,0.05,-Infinity,0.10)}">${pValue2[idx].toFixed(4)}${sigP?' ✅':' ⚠️'}</td>
          <td class="${c3(vif2[idx],1,2.0,1,2.0)}">${vif2[idx].toFixed(2)}</td>
          <td class="${c3((1/vif2[idx]),0.20,1,0.10,1)}">${(1/vif2[idx]).toFixed(3)}</td>
        </tr>`;
      });
      restHtml += `</table>`;

      const nBins2 = Math.min(16, Math.max(6, Math.round(Math.sqrt(m2))));
      const minR2 = Math.min(...residuals2);
      const maxR2 = Math.max(...residuals2);
      const binW2 = (maxR2 - minR2) / nBins2 || 0.01;
      const bins2 = Array(nBins2).fill(0);
      residuals2.forEach(r => { const bi = Math.min(nBins2-1, Math.max(0, Math.floor((r - minR2) / binW2))); bins2[bi]++; });
      restHtml += `<table style="font-size:7pt;margin-top:4pt"><tr><th colspan="2">Phân phối phần dư (Residuals)</th></tr>`;
      bins2.forEach((c, i) => {
        const lo = (minR2 + i * binW2).toFixed(2);
        const hi = (minR2 + (i+1) * binW2).toFixed(2);
        const bar = '█'.repeat(Math.round(c / Math.max(...bins2) * 20));
        restHtml += `<tr><td style="text-align:right;padding:1pt 4pt">[${lo}, ${hi})</td><td style="text-align:left;padding:1pt 4pt">${bar} ${c}</td></tr>`;
      });
      restHtml += `</table>`;
    });
    restHtml += `</div>`;
  }

  const demoVars2 = variables.filter(v => v.type === 'demographic' && !v.construct);
  const twoGroupVars2 = demoVars2.filter(dv => {
    const vals = new Set(); (generatedData?.rawRows||[]).forEach(r => { const v = r[dv.name]; if (v != null) vals.add(v); });
    return vals.size === 2;
  });
  if (twoGroupVars2.length > 0 && Object.keys(cons).length > 0) {
    restHtml += `<div class="section"><h2>3. Independent Sample t-test</h2>`;
    twoGroupVars2.forEach(dv => {
      const grpLabels = [...new Set((generatedData?.rawRows||[]).map(r => r[dv.name]).filter(v => v != null))];
      const grp1 = grpLabels[0], grp2 = grpLabels[1];
      Object.keys(cons).forEach(ck => {
        const items = cons[ck].map(v => v.name);
        const g1vals = [], g2vals = [];
        (generatedData?.rawRows||[]).forEach(r => {
          const g = r[dv.name];
          if (g == null) return;
          let sum=0,cnt=0; items.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}});
          const cs = cnt>0 ? sum/cnt : null;
          if (cs === null) return;
          if (g === grp1) g1vals.push(cs); else if (g === grp2) g2vals.push(cs);
        });
        if (g1vals.length < 2 || g2vals.length < 2) return;
        const tt = independentTTest(g1vals, g2vals, grp1, grp2);
        if (!tt) return;
        const label = cons[ck][0]?.constructLabel || ck;
        const effSz = tt.cohensD >= 0.8 ? 'Lớn' : tt.cohensD >= 0.5 ? 'Trung bình' : tt.cohensD >= 0.2 ? 'Nhỏ' : 'Không';
        restHtml += `<div style="margin-top:6pt;padding:4pt 8pt;border:1px solid #e5e7eb;border-radius:4pt;font-size:9pt">
          <strong>${label} × ${dv.label}</strong><br>
          ${grp1}: N=${tt.n1}, TB=${tt.m1.toFixed(2)}, ĐLC=${Math.sqrt(tt.v1).toFixed(3)} &nbsp;|&nbsp;
          ${grp2}: N=${tt.n2}, TB=${tt.m2.toFixed(2)}, ĐLC=${Math.sqrt(tt.v2).toFixed(3)}<br>
          Levene F=${tt.fLevene.toFixed(3)} (p=${tt.leveneP.toFixed(4)}) → ${tt.equalVarAssumed?'Giả định bằng nhau':'Không bằng nhau'}<br>
          <strong>t(${tt.df.toFixed(1)}) = ${tt.tStat.toFixed(3)}, p = ${tt.pVal.toFixed(4)}${tt.pVal<0.05?' (có ý nghĩa)':''}</strong><br>
          Cohen's d = ${tt.cohensD.toFixed(3)} (${effSz})
        </div>`;
      });
    });
    restHtml += `</div>`;
  }

  const allCons = Object.keys(cons).filter(k => cons[k][0]?.role !== 'moderating');
  if (allCons.length > 1) {
    const compScores = {};
    allCons.forEach(k => {
      const its = cons[k].map(v => v.name);
      compScores[k] = (generatedData?.rawRows||[]).map(r => {
        let sum=0,cnt=0; its.forEach(n=>{const v=r[n];if(typeof v==='number'&&!isNaN(v)){sum+=v;cnt++;}}); return cnt>0?sum/cnt:null;
      });
    });
    const valid3 = [];
    for(let i=0;i<n;i++){if(allCons.every(k=>compScores[k][i]!==null))valid3.push(i);}
    if(valid3.length>3){
      const R = corrMatrixFromData(valid3.map(ri=>{const o={};allCons.forEach(k=>{o[k]=compScores[k][ri];});return o;}), allCons);
      restHtml += `<div class="section"><h2>4. Tương quan giữa các nhân tố</h2>
      <table><tr><th>Nhân tố</th>${allCons.map(k=>`<th>${k}</th>`).join('')}</tr>`;
      allCons.forEach((ki,i)=>{
        restHtml+=`<tr><td style="font-weight:600">${ki}</td>`;
        allCons.forEach((kj,j)=>{
          const r = R[i][j];
          restHtml+=`<td class="${c3(Math.abs(r),0.25,0.85,0.15,0.92)}">${r.toFixed(3)}</td>`;
        });
        restHtml+=`</tr>`;
      });
      restHtml+=`</table><div style="font-size:8pt;color:#6b7280">N = ${valid3.length}</div></div>`;
    }
  }

  const finalHtml = htmlWithRows + restHtml +
    `<div class="footer">Báo cáo được tạo tự động bởi Công cụ Mô phỏng Dữ liệu SPSS &mdash; ${now}</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    showToast('❌ Trình duyệt chặn mở cửa sổ mới khi chạy từ file://. Hãy dùng live server: npm install -g serve && serve .', 'error');
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bao-cao-spss.html';
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  win.document.write(finalHtml);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ====== QUALITY EDITOR (merged) ======
// ====== QUALITY EDITOR — fix ALL metrics by modifying raw data ======

// Per-construct custom targets (set via inputs in quality editor panel)
window.__customTargets = window.__customTargets || {
  alpha: {},   // constructKey -> number (e.g. 0.85)
  loading: {}, // constructKey -> number (e.g. 0.7)
  rsq: {},     // constructKey -> number (e.g. 0.6)
  corrMin: {}, // 'c1|c2' -> number (e.g. 0.3)
  corrMax: {}, // 'c1|c2' -> number (e.g. 0.6)
};
function _ct() { return window.__customTargets; }

function _getTargetAlpha(key) {
  const t = _ct();
  if (key && t.alpha[key] != null) return t.alpha[key];
  return parseFloat(document.getElementById('q-alpha')?.value) || 0.8;
}
function _getTargetLoading(key) {
  const t = _ct();
  if (key && t.loading[key] != null) return t.loading[key];
  return parseFloat(document.getElementById('q-loading')?.value) || 0.6;
}
function _getTargetRSq(key) {
  const t = _ct();
  if (key && t.rsq[key] != null) return t.rsq[key];
  return parseFloat(document.getElementById('q-rsq')?.value) || 0.5;
}
function _getTargetCorrMin(key) {
  const t = _ct();
  if (key && t.corrMin[key] != null) return t.corrMin[key];
  return parseFloat(document.getElementById('q-corr-min')?.value) || 0.30;
}
function _getTargetCorrMax(key) {
  const t = _ct();
  if (key && t.corrMax[key] != null) return t.corrMax[key];
  return parseFloat(document.getElementById('q-corr-max')?.value) || 0.60;
}

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

  for (let iter = 0; iter < 5; iter++) {
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

      // Fix: strongly pull item toward total score direction
      const name = itemNames[ii];
      valid.forEach(ri => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        const total = totalScores[ri];
        const item = itemScores[ri];
        const pullDir = (total/items.length - item) * 0.35;
        let newVal = Math.round(old + pullDir);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old) rows[ri][name] = newVal;
      });
    }
  }

  // Post-fix: reorder items to match composite ranking (same as construct internal)
  {
    const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
    if (valid.length >= 10) {
      const m = valid.length;
      const composite = valid.map(ri => itemNames.reduce((s,n)=>s+rows[ri][n],0)/itemNames.length);
      const sortedIdx = [...Array(m).keys()].sort((a,b) => composite[a] - composite[b]);
      const groups = Math.min(scale, 5);
      const groupSize = Math.floor(m / groups);
      itemNames.forEach(name => {
        sortedIdx.forEach((pos, p) => {
          const group = Math.min(groups-1, Math.floor(p / groupSize));
          const groupMin = Math.max(1, Math.round(1 + (scale-1) * group / groups));
          const groupMax = Math.min(scale, Math.round(1 + (scale-1) * (group+1) / groups));
          const ideal = Math.round(groupMin + (groupMax - groupMin) * Math.random());
          const ri = valid[pos];
          const old = rows[ri][name];
          if (typeof old !== 'number' || isNaN(old)) return;
          const pull = (ideal - old) * 0.4;
          let newVal = Math.round(old + pull);
          newVal = Math.min(scale, Math.max(1, newVal));
          if (newVal !== old) rows[ri][name] = newVal;
        });
      });
    }
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

  // Phase 1: Sort rows by composite, then assign items to match
  for (let bigIter = 0; bigIter < 3; bigIter++) {
    const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
    if (valid.length < 10) break;
    const m = valid.length;

    // Compute composite
    const composite = valid.map(ri => itemNames.reduce((s,n)=>s+rows[ri][n],0)/itemNames.length);

    // Sort row indices by composite
    const sortedIdx = [...Array(m).keys()].sort((a,b) => composite[a] - composite[b]);

    // Re-rank each item to match the composite ordering
    itemNames.forEach((name) => {
      const colIdx = itemNames.indexOf(name);
      const vals = valid.map(ri => scores[colIdx][ri]);

      // Sort values
      const sortedVals = [...vals].sort((a,b) => a - b);

      // Build quartile-based mapping: low composite rows get low item values
      const groups = Math.min(scale, 5);
      const groupSize = Math.floor(m / groups);
      sortedIdx.forEach((ri, pos) => {
        const group = Math.min(groups-1, Math.floor(pos / groupSize));
        const groupMin = Math.max(1, Math.round(1 + (scale-1) * group / groups));
        const groupMax = Math.min(scale, Math.round(1 + (scale-1) * (group+1) / groups));
        const ideal = Math.round(groupMin + (groupMax - groupMin) * Math.random());
        const old = rows[valid[ri]][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        const pull = (ideal - old) * 0.4;
        let newVal = Math.round(old + pull);
        newVal = Math.min(scale, Math.max(1, newVal));
        if (newVal !== old) rows[valid[ri]][name] = newVal;
      });
    });
  }

  // Phase 2: Fine-tune with composite pull (10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    const scores = itemNames.map(name => rows.map(r => (typeof r[name]==='number'&&!isNaN(r[name]))?r[name]:null));
    const valid = [];
    for (let i = 0; i < n; i++) { if (scores.every(col => col[i] !== null)) valid.push(i); }
    if (valid.length < 5) break;
    const m = valid.length;

    const composite = valid.map(ri => itemNames.reduce((s,n)=>s+rows[ri][n],0)/itemNames.length);

    let totalChanged = 0;
    valid.forEach((ri, idx) => {
      const comp = composite[idx];
      itemNames.forEach((name) => {
        const old = rows[ri][name];
        if (typeof old !== 'number' || isNaN(old)) return;
        const pull = (comp - old) * (iter < 5 ? 0.35 : 0.15);
        let newVal = Math.min(scale, Math.max(1, Math.round(old + pull)));
        if (newVal === old) {
          newVal = Math.min(scale, Math.max(1, old + (Math.random() < 0.5 ? 1 : -1)));
          if (Math.abs(newVal - old) > 1) newVal = old;
        }
        if (newVal !== old) { rows[ri][name] = newVal; totalChanged++; }
      });
    });
    if (totalChanged < 3) break;
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
  const targetR2 = _getTargetRSq(dvKey);
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
  const pk = `${c1}|${c2}`;
  const corrMin = _getTargetCorrMin(pk);
  const corrMax = _getTargetCorrMax(pk);
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
    <div style="font-size:.7rem;color:var(--gray-500);margin-bottom:.5rem;background:#fefce8;padding:.45rem .6rem;border-radius:6px;line-height:1.5">
      💡 <b>Hướng dẫn nhanh:</b><br>
      • <b>📊 Độ tin cậy</b> = sửa α (Cronbach) + λ (hệ số tải) + AVE + KMO<br>
      • <b>📊 Đồng nhất</b> = làm biến tương quan với tổng điểm nhân tố<br>
      • <b>🎯 R²</b> = tăng khả năng giải thích của mô hình hồi quy<br>
      • <b>📊 Đa cộng tuyến</b> = giảm tương quan giữa các biến độc lập (VIF)<br>
      • <b>📊 Phần dư</b> = chuẩn hoá phần dư hồi quy<br>
      • <b>📊 Chéo nhân tố</b> = gỡ biến tải lên nhiều nhân tố<br>
      • <b>📮 Chia sẻ</b> = tăng phương sai chung biến-nhân tố
    </div>
    <div style="font-size:.65rem;color:var(--gray-400);margin-bottom:.3rem;padding:0 .25rem">
      <span style="display:inline-block;min-width:80px"></span>
      <span style="display:inline-block;min-width:36px">α</span>
      <span style="display:inline-block;min-width:36px">λ</span>
      <span style="display:inline-block;min-width:35px">Mục tiêu α</span>
      <span style="display:inline-block;min-width:35px">Mục tiêu λ</span>
      <span style="display:inline-block;min-width:36px">AVE</span>
      <span style="display:inline-block;min-width:36px">KMO</span>
      <span style="display:inline-block;min-width:36px">r-total</span>
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

    // Read custom targets for this construct
    const ca = _getTargetAlpha(k);
    const cl = _getTargetLoading(k);

    // Single unified "Nội tại" button for alpha+loading+AVE+KMO
    const needsInternal = m.alpha < ca || m.avgLoading < cl || m.ave < 0.3 || m.kmo < 0.5;

    // R² for DV
    const isDV = c.role === 'dependent';
    let dvMetrics = null;
    if (isDV) dvMetrics = _computeRegressionMetrics(k);
    const crsq = _getTargetRSq(k);

    // Display row
    html += `<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;background:#fff;padding:.35rem .5rem;border-radius:6px;border:1px solid var(--gray-200)">
      <span style="font-weight:600;font-size:.8rem;color:${roleColor[c.role]||'#374151'};min-width:80px">${c.label}</span>`;

    // Alpha
    html += `<span style="font-size:.6rem;color:var(--gray-400)">α</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.alpha, v=>v>=ca)};min-width:36px">${m.alpha.toFixed(3)}</span>`;

    // Loading
    html += `<span style="font-size:.6rem;color:var(--gray-400)">λ</span>
      <span style="font-size:.75rem;font-weight:600;color:${_clr(m.avgLoading, v=>v>=cl)};min-width:36px">${m.avgLoading.toFixed(3)}</span>`;

    // Custom target inputs for α and λ (with labels)
    html += `<span style="font-size:.55rem;color:#7c3aed;font-weight:600;margin-left:.15rem">α></span>
      <input type="number" id="ta-${k}" value="${ca.toFixed(2)}" min="0.5" max="0.95" step="0.05"
        onchange="window.__customTargets.alpha['${k}']=parseFloat(this.value)||0.8"
        style="width:45px;font-size:.65rem;padding:.1rem .2rem;border:1.5px solid #7c3aed;border-radius:4px;text-align:center;background:#faf5ff"
        title="Nhập Cronbach's Alpha mục tiêu cho nhân tố này">`;
    html += `<span style="font-size:.55rem;color:#7c3aed;font-weight:600">λ></span>
      <input type="number" id="tl-${k}" value="${cl.toFixed(2)}" min="0.3" max="0.95" step="0.05"
        onchange="window.__customTargets.loading['${k}']=parseFloat(this.value)||0.6"
        style="width:45px;font-size:.65rem;padding:.1rem .2rem;border:1.5px solid #7c3aed;border-radius:4px;text-align:center;background:#faf5ff"
        title="Nhập Factor Loading mục tiêu cho nhân tố này">`;

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
      <button class="btn btn-sm" onclick="_execFixITC('${k}')" style="font-size:.6rem;padding:.15rem .35rem;background:${itcOk?'#d1fae5':'#7c3aed'};color:${itcOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer" title="Làm cho biến này tương quan với tổng điểm nhân tố">${itcOk?'✅':'📊 Đồng nhất'}</button>`;

    // Nút tổng hợp: α + λ + AVE + KMO
    const intLabel = needsInternal ? '📊 Độ tin cậy' : '✅';
    html += `<button class="btn btn-sm" onclick="_execFix('${k}')" style="font-size:.6rem;padding:.15rem .35rem;background:${needsInternal?'#7c3aed':'#d1fae5'};color:${needsInternal?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer" title="Cải thiện α + λ + AVE + KMO đồng thời">${intLabel}</button>`;

    // R² for DV
    if (isDV && dvMetrics) {
      const rsqOk = dvMetrics.rSquared >= crsq;
      html += `<span style="font-size:.6rem;color:var(--gray-400);margin-left:.1rem">R²</span>
        <span style="font-size:.75rem;font-weight:600;color:${_clr(dvMetrics.rSquared, v=>v>=crsq)};min-width:36px">${dvMetrics.rSquared.toFixed(3)}</span>
        <span style="font-size:.55rem;color:#059669;font-weight:600">R²></span>
        <input type="number" id="tr-${k}" value="${crsq.toFixed(2)}" min="0.1" max="0.9" step="0.05"
          onchange="window.__customTargets.rsq['${k}']=parseFloat(this.value)||0.5"
          style="width:42px;font-size:.65rem;padding:.1rem .2rem;border:1.5px solid #059669;border-radius:4px;text-align:center;background:#f0fdf4"
          title="Nhập R² mục tiêu cho biến phụ thuộc này">`;
      html += `<button class="btn btn-sm" onclick="_execFixDV('${k}')" style="font-size:.6rem;padding:.15rem .35rem;background:${rsqOk?'#d1fae5':'#059669'};color:${rsqOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${rsqOk?'✅':'🎯 R²'}</button>`;

      // VIF
      if (dvMetrics.vif && dvMetrics.vif.length > 0) {
        const maxVif = Math.max(...dvMetrics.vif);
        const vifOk = maxVif < 2;
        html += `<span style="font-size:.6rem;color:var(--gray-400)">VIF</span>
          <span style="font-size:.75rem;font-weight:600;color:${_clr(maxVif, v=>v<2)};min-width:36px">${maxVif.toFixed(2)}</span>
          <button class="btn btn-sm" onclick="_execFixVIF()" style="font-size:.6rem;padding:.15rem .35rem;background:${vifOk?'#d1fae5':'#dc2626'};color:${vifOk?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer" title="Giảm đa cộng tuyến giữa các IV">${vifOk?'✅':'📊 Đa cộng tuyến'}</button>`;

        // Residual normality fix
        html += `<span style="font-size:.6rem;color:var(--gray-400)">Phần dư</span>
          <button class="btn btn-sm" onclick="_execFixResidual('${k}')" style="font-size:.55rem;padding:.1rem .25rem;background:#7c3aed;color:#fff;border:none;border-radius:4px;cursor:pointer" title="Chuẩn hoá phần dư về N(0,1)">📊 Phần dư</button>`;
      }
    }

    html += `</div>`;
  });

  // IV Correlation row
  if (ivPairs.length > 0) {
    html += `<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;background:#fff;padding:.35rem .5rem;border-radius:6px;border:1px solid var(--gray-200);margin-top:.25rem">
      <span style="font-weight:600;font-size:.8rem;color:#2563eb;min-width:80px">📊 IV Tương quan</span>`;
    ivPairs.forEach(p => {
      const pk = `${p.c1}|${p.c2}`;
      const cMin = _getTargetCorrMin(pk);
      const cMax = _getTargetCorrMax(pk);
      const inRange = p.r >= cMin && p.r <= cMax;
      html += `<span style="font-size:.6rem;color:var(--gray-400)">${p.c1}↔${p.c2}</span>
        <span style="font-size:.7rem;font-weight:600;color:${_clr(p.r, v=>v>=cMin&&v<=cMax)};min-width:32px">${p.r.toFixed(3)}</span>
        <input type="number" value="${cMin.toFixed(2)}" min="0" max="0.8" step="0.05"
          onchange="window.__customTargets.corrMin['${pk}']=parseFloat(this.value)||0.3"
          style="width:38px;font-size:.6rem;padding:.08rem .15rem;border:1.5px solid #2563eb;border-radius:4px;text-align:center;background:#eff6ff"
          title="Tương quan tối thiểu">
        <span style="font-size:.5rem;color:#2563eb">→</span>
        <input type="number" value="${cMax.toFixed(2)}" min="0" max="0.8" step="0.05"
          onchange="window.__customTargets.corrMax['${pk}']=parseFloat(this.value)||0.6"
          style="width:38px;font-size:.6rem;padding:.08rem .15rem;border:1.5px solid #2563eb;border-radius:4px;text-align:center;background:#eff6ff"
          title="Tương quan tối đa">
        <button class="btn btn-sm" onclick="_execFixCorr('${p.c1}','${p.c2}')" style="font-size:.55rem;padding:.1rem .25rem;background:${inRange?'#d1fae5':'#2563eb'};color:${inRange?'#065f46':'#fff'};border:none;border-radius:4px;cursor:pointer">${inRange?'✅':'🔗'}</button>`;
    });
    html += `</div>`;
  }

  // EFA fix buttons
  const efa = computeEFA();
  if (efa && efa.nFactors > 0) {
    const hasCross = efa.crossLoadings.length > 0;
    const hasLowComm = efa.communalities.some(c => c < 0.3);
    html += `<div style="display:flex;gap:.35rem;margin-top:.25rem;flex-wrap:wrap">
      <span style="font-size:.7rem;font-weight:600;color:var(--gray-500);margin-right:.25rem">🔬 EFA:</span>
      <button class="btn btn-sm" onclick="fixEFA_CrossLoading()" style="font-size:.6rem;padding:.15rem .35rem;background:${hasCross?'#dc2626':'#d1fae5'};color:${hasCross?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer" title="Loại bỏ biến tải lên nhiều nhân tố cùng lúc">${hasCross?`📊 Chéo nhân tố (${efa.crossLoadings.length})`:'✅ Chéo nhân tố'}</button>
      <button class="btn btn-sm" onclick="fixEFA_Communality()" style="font-size:.6rem;padding:.15rem .35rem;background:${hasLowComm?'#d97706':'#d1fae5'};color:${hasLowComm?'#fff':'#065f46'};border:none;border-radius:4px;cursor:pointer" title="Tăng phương sai chia sẻ giữa biến và nhân tố">${hasLowComm?'📮 Chia sẻ':'✅ Chia sẻ'}</button>
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

// ====== AUTO FIX AFTER GENERATION (called from smartGenerate) ======
function _autoFixAfterGenerate() {
  if (!generatedData) return;
  const cKeys = Object.keys(
    variables.reduce((acc, v) => { if (v.construct) acc[v.construct] = true; return acc; }, {})
  );
  if (cKeys.length === 0) return;

  // Item-total + construct internal (α + λ)
  cKeys.forEach(k => {
    try { fixItemTotalCorrelation(k); } catch(e) {}
    try { fixConstructInternal(k); } catch(e) {}
  });

  // EFA
  try { fixEFA_CrossLoading(); } catch(e) {}
  try { fixEFA_Communality(); } catch(e) {}

  // DV R² + Residual
  cKeys.filter(k => variables.find(v => v.construct === k)?.role === 'dependent').forEach(dv => {
    try { fixDV_Rsquared(dv); } catch(e) {}
    try { fixResidualNormality(dv); } catch(e) {}
  });

  // IV correlation + VIF
  try { fixVIF(); } catch(e) {}

  // Refresh
  _refreshQEditor();
}
